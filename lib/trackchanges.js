/**
 * Track Changes export utilities
 * Convert CriticMarkup annotations to Word track changes format
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { parseAnnotations } from './annotations.js';

/**
 * Generate a unique revision ID
 * @returns {number}
 */
let revisionId = 0;
function getNextRevId() {
  return revisionId++;
}

/**
 * Format date for Word revision
 * @returns {string}
 */
function getRevisionDate() {
  return new Date().toISOString().replace('Z', '');
}

/**
 * Escape XML special characters
 * @param {string} text
 * @returns {string}
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create Word insertion markup
 * @param {string} text - Text to insert
 * @param {string} author - Author name
 * @returns {string}
 */
function createInsertionXml(text, author = 'Author') {
  const id = getNextRevId();
  const date = getRevisionDate();

  return `<w:ins w:id="${id}" w:author="${escapeXml(author)}" w:date="${date}"><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:ins>`;
}

/**
 * Create Word deletion markup
 * @param {string} text - Text to delete
 * @param {string} author - Author name
 * @returns {string}
 */
function createDeletionXml(text, author = 'Author') {
  const id = getNextRevId();
  const date = getRevisionDate();

  return `<w:del w:id="${id}" w:author="${escapeXml(author)}" w:date="${date}"><w:r><w:delText>${escapeXml(text)}</w:delText></w:r></w:del>`;
}

/**
 * Convert CriticMarkup to Word track changes in markdown
 * This creates a special markdown format that can be processed after pandoc
 *
 * @param {string} text - Markdown with CriticMarkup
 * @returns {{text: string, annotations: Array}}
 */
export function prepareForTrackChanges(text) {
  const annotations = parseAnnotations(text);
  const markers = [];

  // Sort by position descending to replace from end
  const sorted = [...annotations].sort((a, b) => b.position - a.position);

  let result = text;

  for (const ann of sorted) {
    const marker = `{{TC_${markers.length}}}`;

    markers.push({
      id: markers.length,
      type: ann.type,
      content: ann.content,
      replacement: ann.replacement,
      author: ann.author || 'Reviewer',
    });

    // Replace annotation with marker
    result = result.slice(0, ann.position) + marker + result.slice(ann.position + ann.match.length);
  }

  return { text: result, markers };
}

/**
 * Post-process a DOCX file to convert markers to track changes
 *
 * @param {string} docxPath - Path to DOCX file
 * @param {Array} markers - Markers from prepareForTrackChanges
 * @param {string} outputPath - Output path
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function applyTrackChangesToDocx(docxPath, markers, outputPath) {
  if (!fs.existsSync(docxPath)) {
    return { success: false, message: `File not found: ${docxPath}` };
  }

  try {
    const zip = new AdmZip(docxPath);
    const documentEntry = zip.getEntry('word/document.xml');

    if (!documentEntry) {
      return { success: false, message: 'Invalid DOCX: no document.xml' };
    }

    let documentXml = zip.readAsText(documentEntry);

    // Enable track changes in settings
    const settingsEntry = zip.getEntry('word/settings.xml');
    if (settingsEntry) {
      let settingsXml = zip.readAsText(settingsEntry);
      // Add trackRevisions setting if not present
      if (!settingsXml.includes('w:trackRevisions')) {
        settingsXml = settingsXml.replace(
          '</w:settings>',
          '<w:trackRevisions/></w:settings>'
        );
        zip.updateFile('word/settings.xml', Buffer.from(settingsXml, 'utf-8'));
      }
    }

    // Replace markers with track changes XML
    for (const marker of markers) {
      const markerText = `{{TC_${marker.id}}}`;

      // Find the marker in document.xml (may be split across runs)
      // First try simple replacement
      if (documentXml.includes(markerText)) {
        let replacement;

        switch (marker.type) {
          case 'insert':
            replacement = createInsertionXml(marker.content, marker.author);
            break;
          case 'delete':
            replacement = createDeletionXml(marker.content, marker.author);
            break;
          case 'substitute':
            // Substitution = deletion + insertion
            replacement =
              createDeletionXml(marker.content, marker.author) +
              createInsertionXml(marker.replacement, marker.author);
            break;
          case 'comment':
            // Comments are handled differently - skip for track changes
            replacement = '';
            break;
          default:
            replacement = '';
        }

        documentXml = documentXml.replace(markerText, replacement);
      } else {
        // Marker might be split across <w:t> elements
        // Try to find and reconstruct
        const markerPattern = markerText.split('').join('(?:</w:t></w:r><w:r><w:t>)?');
        const regex = new RegExp(markerPattern, 'g');

        if (regex.test(documentXml)) {
          let replacement;

          switch (marker.type) {
            case 'insert':
              replacement = `</w:t></w:r>${createInsertionXml(marker.content, marker.author)}<w:r><w:t>`;
              break;
            case 'delete':
              replacement = `</w:t></w:r>${createDeletionXml(marker.content, marker.author)}<w:r><w:t>`;
              break;
            case 'substitute':
              replacement =
                `</w:t></w:r>${createDeletionXml(marker.content, marker.author)}` +
                `${createInsertionXml(marker.replacement, marker.author)}<w:r><w:t>`;
              break;
            default:
              replacement = '';
          }

          documentXml = documentXml.replace(regex, replacement);
        }
      }
    }

    // Clean up empty runs created by replacements
    documentXml = documentXml.replace(/<w:r><w:t><\/w:t><\/w:r>/g, '');

    zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
    zip.writeZip(outputPath);

    return { success: true, message: `Created ${outputPath} with track changes` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Build DOCX with track changes visible
 * This is the main entry point for the audit export feature
 *
 * @param {string} markdownPath - Path to markdown with annotations
 * @param {string} outputPath - Output DOCX path
 * @param {Object} options
 * @returns {Promise<{success: boolean, message: string, stats: Object}>}
 */
export async function buildWithTrackChanges(markdownPath, outputPath, options = {}) {
  const { author = 'Reviewer' } = options;

  if (!fs.existsSync(markdownPath)) {
    return { success: false, message: `File not found: ${markdownPath}`, stats: null };
  }

  const text = fs.readFileSync(markdownPath, 'utf-8');
  const { text: preparedText, markers } = prepareForTrackChanges(text);

  // Assign author to markers that don't have one
  for (const marker of markers) {
    if (!marker.author || marker.author === 'Reviewer') {
      marker.author = author;
    }
  }

  // Write temporary markdown
  const tempMd = outputPath.replace('.docx', '.tmp.md');
  const tempDocx = outputPath.replace('.docx', '.tmp.docx');

  fs.writeFileSync(tempMd, preparedText, 'utf-8');

  // Run pandoc to create initial DOCX
  const { execSync } = await import('child_process');

  try {
    execSync(`pandoc "${tempMd}" -o "${tempDocx}"`, { stdio: 'pipe' });
  } catch (err) {
    fs.unlinkSync(tempMd);
    return { success: false, message: `Pandoc failed: ${err.message}`, stats: null };
  }

  // Apply track changes
  const result = await applyTrackChangesToDocx(tempDocx, markers, outputPath);

  // Cleanup
  try {
    fs.unlinkSync(tempMd);
    fs.unlinkSync(tempDocx);
  } catch {
    // Ignore cleanup errors
  }

  const stats = {
    insertions: markers.filter(m => m.type === 'insert').length,
    deletions: markers.filter(m => m.type === 'delete').length,
    substitutions: markers.filter(m => m.type === 'substitute').length,
    total: markers.length,
  };

  return { ...result, stats };
}
