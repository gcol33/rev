/**
 * Import functionality - convert Word docs to annotated Markdown
 */

import * as fs from 'fs';
import * as path from 'path';
import { diffWords } from 'diff';

/**
 * Extract text from Word document using mammoth
 * @param {string} docxPath
 * @returns {Promise<{text: string, comments: Array}>}
 */
export async function extractFromWord(docxPath) {
  const mammoth = await import('mammoth');

  // Extract raw text
  const textResult = await mammoth.extractRawText({ path: docxPath });

  // Try to extract with messages (may include comments info)
  const htmlResult = await mammoth.convertToHtml({ path: docxPath });

  // Parse comments from HTML if present (mammoth includes them as spans)
  const comments = [];
  const commentMatches = htmlResult.value.matchAll(
    /<span class="comment-reference"[^>]*data-comment-id="(\d+)"[^>]*>/g
  );
  for (const match of commentMatches) {
    comments.push({ id: match[1] });
  }

  return {
    text: textResult.value,
    comments,
    messages: [...textResult.messages, ...htmlResult.messages],
  };
}

/**
 * Normalize text for comparison (handle whitespace differences)
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, '    ') // Tabs to spaces
    .replace(/ +/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Strip markdown syntax to get plain text (for comparison with Word output)
 * @param {string} md
 * @returns {string}
 */
function stripMarkdownSyntax(md) {
  return md
    // Remove YAML front matter
    .replace(/^---[\s\S]*?---\n*/m, '')
    // Headers: # Title → Title
    .replace(/^#{1,6}\s+/gm, '')
    // Bold/italic: **text** or *text* or __text__ or _text_ → text
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Images: ![alt](url) → (remove entirely or keep alt)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Inline code: `code` → code
    .replace(/`([^`]+)`/g, '$1')
    // Code blocks: ```...``` → (remove)
    .replace(/```[\s\S]*?```/g, '')
    // Blockquotes: > text → text
    .replace(/^>\s*/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // List markers: - item or * item or 1. item → item
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Citations: [@Author2020] → (keep as-is, Word might have them)
    // Tables: simplified handling
    .replace(/\|/g, ' ')
    .replace(/^[-:]+$/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate annotated markdown by diffing original MD against Word text
 * @param {string} originalMd - Original markdown content
 * @param {string} wordText - Text extracted from Word
 * @param {string} author - Author name for the changes
 * @returns {string} Annotated markdown with CriticMarkup
 */
export function generateAnnotatedDiff(originalMd, wordText, author = 'Reviewer') {
  // Normalize both texts
  const normalizedOriginal = normalizeText(originalMd);
  const normalizedWord = normalizeText(wordText);

  // Compute word-level diff
  const changes = diffWords(normalizedOriginal, normalizedWord);

  let result = '';

  for (const part of changes) {
    if (part.added) {
      // Insertion
      result += `{++${part.value}++}`;
    } else if (part.removed) {
      // Deletion
      result += `{--${part.value}--}`;
    } else {
      // Unchanged
      result += part.value;
    }
  }

  return result;
}

/**
 * Extract markdown prefix (headers, list markers) from a line
 * @param {string} line
 * @returns {{prefix: string, content: string}}
 */
function extractMarkdownPrefix(line) {
  // Headers
  const headerMatch = line.match(/^(#{1,6}\s+)/);
  if (headerMatch) {
    return { prefix: headerMatch[1], content: line.slice(headerMatch[1].length) };
  }

  // List items
  const listMatch = line.match(/^(\s*[-*+]\s+|\s*\d+\.\s+)/);
  if (listMatch) {
    return { prefix: listMatch[1], content: line.slice(listMatch[1].length) };
  }

  // Blockquotes
  const quoteMatch = line.match(/^(>\s*)/);
  if (quoteMatch) {
    return { prefix: quoteMatch[1], content: line.slice(quoteMatch[1].length) };
  }

  return { prefix: '', content: line };
}

/**
 * Smart paragraph-level diff that preserves markdown structure
 * @param {string} originalMd
 * @param {string} wordText
 * @param {string} author
 * @returns {string}
 */
export function generateSmartDiff(originalMd, wordText, author = 'Reviewer') {
  // Split into paragraphs
  const originalParas = originalMd.split(/\n\n+/);
  const wordParas = wordText.split(/\n\n+/);

  const result = [];

  // Try to match paragraphs intelligently
  let wordIdx = 0;

  for (let i = 0; i < originalParas.length; i++) {
    const orig = originalParas[i] || '';
    const { prefix: mdPrefix, content: origContent } = extractMarkdownPrefix(orig.split('\n')[0]);

    // Find best matching word paragraph
    let bestMatch = -1;
    let bestScore = 0;

    for (let j = wordIdx; j < Math.min(wordIdx + 3, wordParas.length); j++) {
      const wordPara = wordParas[j] || '';
      // Simple similarity: count common words
      const origWords = new Set(origContent.toLowerCase().split(/\s+/));
      const wordWords = wordPara.toLowerCase().split(/\s+/);
      const common = wordWords.filter((w) => origWords.has(w)).length;
      const score = common / Math.max(origWords.size, wordWords.length);

      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = j;
      }
    }

    if (bestMatch === -1) {
      // No match found - paragraph was deleted or heavily modified
      // Check if it's just a header that Word converted
      if (mdPrefix && wordIdx < wordParas.length) {
        const wordPara = wordParas[wordIdx];
        if (wordPara.toLowerCase().includes(origContent.toLowerCase().slice(0, 20))) {
          // Word paragraph contains the header content - match them
          bestMatch = wordIdx;
        }
      }
    }

    if (bestMatch >= 0) {
      const word = wordParas[bestMatch];

      // Strip markdown from original for clean comparison
      const origStripped = stripMarkdownSyntax(orig);
      const wordNormalized = normalizeText(word);

      if (origStripped === wordNormalized) {
        // Unchanged (ignoring markdown syntax)
        result.push(orig);
      } else {
        // Modified - diff the content, preserve markdown prefix
        const changes = diffWords(origStripped, wordNormalized);
        let annotated = mdPrefix; // Preserve header/list marker

        for (const part of changes) {
          if (part.added) {
            annotated += `{++${part.value}++}`;
          } else if (part.removed) {
            annotated += `{--${part.value}--}`;
          } else {
            annotated += part.value;
          }
        }

        result.push(annotated);
      }

      wordIdx = bestMatch + 1;
    } else {
      // Paragraph deleted entirely
      result.push(`{--${orig}--}`);
    }
  }

  // Any remaining word paragraphs are additions
  for (let j = wordIdx; j < wordParas.length; j++) {
    const word = wordParas[j];
    if (word.trim()) {
      result.push(`{++${word}++}`);
    }
  }

  return result.join('\n\n');
}

/**
 * Clean up redundant adjacent annotations
 * e.g., {--old--}{++new++} → {~~old~>new~~}
 * @param {string} text
 * @returns {string}
 */
export function cleanupAnnotations(text) {
  // Convert adjacent delete+insert to substitution (with possible whitespace between)
  // Pattern: {--something--} {++something else++}
  text = text.replace(/\{--(.+?)--\}\s*\{\+\+(.+?)\+\+\}/g, '{~~$1~>$2~~}');

  // Also handle insert+delete (less common but possible)
  text = text.replace(/\{\+\+(.+?)\+\+\}\s*\{--(.+?)--\}/g, '{~~$2~>$1~~}');

  // Fix malformed patterns where {-- got merged with ~>
  // {--key~>critical~~} → {~~key~>critical~~}
  text = text.replace(/\{--([^}]+?)~>([^}]+?)~~\}/g, '{~~$1~>$2~~}');

  // Fix malformed substitutions that got split
  // {~~word --} ... {++other~~} patterns
  text = text.replace(/\{~~([^~]+)\s*--\}/g, '{--$1--}');
  text = text.replace(/\{\+\+([^+]+)~~\}/g, '{++$1++}');

  // Clean up empty annotations
  text = text.replace(/\{--\s*--\}/g, '');
  text = text.replace(/\{\+\+\s*\+\+\}/g, '');

  // Clean up double spaces
  text = text.replace(/  +/g, ' ');

  return text;
}

/**
 * Parse visible comment markers from Word text
 * Format: [Author: comment text]
 * @param {string} text
 * @returns {Array<{author: string, text: string, position: number}>}
 */
export function parseVisibleComments(text) {
  const comments = [];
  const pattern = /\[([^\]:]+):\s*([^\]]+)\]/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    comments.push({
      author: match[1].trim(),
      text: match[2].trim(),
      position: match.index,
    });
  }

  return comments;
}

/**
 * Convert visible comments to CriticMarkup format
 * @param {string} text
 * @returns {string}
 */
export function convertVisibleComments(text) {
  return text.replace(/\[([^\]:]+):\s*([^\]]+)\]/g, '{>>$1: $2<<}');
}

/**
 * Full import pipeline: Word doc → annotated MD
 * @param {string} docxPath - Path to Word document
 * @param {string} originalMdPath - Path to original markdown
 * @param {{author?: string, sectionContent?: string}} options
 * @returns {Promise<{annotated: string, stats: object}>}
 */
export async function importFromWord(docxPath, originalMdPath, options = {}) {
  const { author = 'Reviewer', sectionContent } = options;

  // Use provided section content or extract from Word
  let wordText;
  if (sectionContent !== undefined) {
    wordText = sectionContent;
  } else {
    const extracted = await extractFromWord(docxPath);
    wordText = extracted.text;
  }

  // Read original markdown
  const originalMd = fs.readFileSync(originalMdPath, 'utf-8');

  // Generate diff
  let annotated = generateSmartDiff(originalMd, wordText, author);

  // Clean up adjacent del/ins to substitutions
  annotated = cleanupAnnotations(annotated);

  // Convert any visible comments
  annotated = convertVisibleComments(annotated);

  // Count changes
  const insertions = (annotated.match(/\{\+\+/g) || []).length;
  const deletions = (annotated.match(/\{--/g) || []).length;
  const substitutions = (annotated.match(/\{~~/g) || []).length;
  const comments = (annotated.match(/\{>>/g) || []).length;

  return {
    annotated,
    stats: {
      insertions,
      deletions,
      substitutions,
      comments,
      total: insertions + deletions + substitutions + comments,
    },
  };
}
