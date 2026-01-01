/**
 * PDF comment extraction for docrev
 *
 * Extracts annotations (comments, highlights, sticky notes) from PDF files
 * and converts them to CriticMarkup format for insertion into markdown.
 */

import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Annotation types we care about
 */
const COMMENT_TYPES = [
  'Text',      // Sticky notes
  'FreeText',  // Text boxes
  'Highlight', // Highlighted text with comment
  'Underline', // Underlined text with comment
  'StrikeOut', // Strikethrough (deletion suggestion)
  'Squiggly',  // Squiggly underline
  'Popup',     // Popup comments (attached to other annotations)
];

/**
 * Extract raw annotations from a PDF file
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<Array<{type: string, page: number, contents: string, author: string, date: string, rect: number[], quadPoints: number[]}>>}
 */
export async function extractPdfAnnotations(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const annotations = [];
  const pages = pdfDoc.getPages();

  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const page = pages[pageNum];
    const annots = page.node.Annots();

    if (!annots) continue;

    const annotRefs = annots.asArray();

    for (const annotRef of annotRefs) {
      try {
        const annot = annotRef.dict || annotRef;
        if (!annot) continue;

        // Get annotation type
        const subtypeName = annot.get(pdfDoc.context.obj('Subtype'));
        const subtype = subtypeName?.toString?.()?.replace('/', '') || '';

        if (!COMMENT_TYPES.includes(subtype)) continue;

        // Extract contents (the comment text)
        const contentsObj = annot.get(pdfDoc.context.obj('Contents'));
        const contents = contentsObj?.toString?.() || contentsObj?.decodeText?.() || '';

        // Extract author (T field in PDF spec)
        const authorObj = annot.get(pdfDoc.context.obj('T'));
        const author = authorObj?.toString?.() || authorObj?.decodeText?.() || 'Unknown';

        // Extract modification date
        const dateObj = annot.get(pdfDoc.context.obj('M'));
        const dateStr = dateObj?.toString?.() || '';
        const date = parsePdfDate(dateStr);

        // Extract rectangle (position on page)
        const rectObj = annot.get(pdfDoc.context.obj('Rect'));
        const rect = rectObj?.asArray?.()?.map(n => n?.asNumber?.() || 0) || [0, 0, 0, 0];

        // Extract QuadPoints for highlights (the actual text bounds)
        const quadObj = annot.get(pdfDoc.context.obj('QuadPoints'));
        const quadPoints = quadObj?.asArray?.()?.map(n => n?.asNumber?.() || 0) || [];

        // Skip empty annotations
        if (!contents.trim() && subtype !== 'StrikeOut') continue;

        annotations.push({
          type: subtype,
          page: pageNum + 1,
          contents: cleanPdfString(contents),
          author: cleanPdfString(author),
          date,
          rect,
          quadPoints,
        });
      } catch (err) {
        // Skip malformed annotations
        continue;
      }
    }
  }

  // Sort by page, then by vertical position (top to bottom)
  annotations.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    // Higher Y = higher on page in PDF coords
    return (b.rect[1] || 0) - (a.rect[1] || 0);
  });

  return annotations;
}

/**
 * Parse PDF date string (D:YYYYMMDDHHmmSS format)
 * @param {string} dateStr
 * @returns {string} ISO date string
 */
function parsePdfDate(dateStr) {
  if (!dateStr) return '';

  // Remove D: prefix and timezone info
  const clean = dateStr.replace(/^D:/, '').replace(/[Z+-].*$/, '');

  if (clean.length >= 8) {
    const year = clean.slice(0, 4);
    const month = clean.slice(4, 6);
    const day = clean.slice(6, 8);
    return `${year}-${month}-${day}`;
  }

  return '';
}

/**
 * Clean PDF string (remove parentheses, decode escape sequences)
 * @param {string} str
 * @returns {string}
 */
function cleanPdfString(str) {
  if (!str) return '';

  return str
    .replace(/^\(/, '')  // Remove leading paren
    .replace(/\)$/, '')  // Remove trailing paren
    .replace(/\\n/g, '\n')  // Newlines
    .replace(/\\r/g, '')    // Carriage returns
    .replace(/\\t/g, ' ')   // Tabs
    .replace(/\\\(/g, '(')  // Escaped parens
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\') // Escaped backslash
    .trim();
}

/**
 * Convert PDF annotations to CriticMarkup comments
 * @param {Array} annotations - From extractPdfAnnotations
 * @returns {Array<{author: string, text: string, page: number, type: string}>}
 */
export function annotationsToComments(annotations) {
  return annotations
    .filter(a => a.contents.trim())
    .map(a => ({
      author: a.author || 'Reviewer',
      text: a.contents,
      page: a.page,
      type: a.type,
      date: a.date,
    }));
}

/**
 * Extract comments from PDF and format for display
 * @param {string} pdfPath
 * @returns {Promise<Array<{author: string, text: string, page: number, type: string, date: string}>>}
 */
export async function extractPdfComments(pdfPath) {
  const annotations = await extractPdfAnnotations(pdfPath);
  return annotationsToComments(annotations);
}

/**
 * Insert PDF comments into markdown based on page/position heuristics
 * Since PDFs don't have direct text anchors like Word, we use page numbers
 * and append comments to the end of corresponding sections
 *
 * @param {string} markdown - The markdown content
 * @param {Array} comments - Comments from extractPdfComments
 * @param {object} options - { sectionPerPage: boolean }
 * @returns {string} Markdown with comments inserted
 */
export function insertPdfCommentsIntoMarkdown(markdown, comments, options = {}) {
  if (comments.length === 0) return markdown;

  // Group comments by page
  const commentsByPage = new Map();
  for (const c of comments) {
    if (!commentsByPage.has(c.page)) {
      commentsByPage.set(c.page, []);
    }
    commentsByPage.get(c.page).push(c);
  }

  // Strategy: Append all comments at the end with page references
  // This is the safest approach since we can't reliably map PDF positions to markdown
  const lines = markdown.split('\n');
  const commentBlock = [];

  commentBlock.push('');
  commentBlock.push('<!-- PDF Comments -->');

  for (const [page, pageComments] of commentsByPage) {
    for (const c of pageComments) {
      const authorPrefix = c.author ? `${c.author}: ` : '';
      const pageRef = `[p.${page}]`;
      commentBlock.push(`{>>${authorPrefix}${pageRef} ${c.text}<<}`);
    }
  }

  return lines.join('\n') + commentBlock.join('\n');
}

/**
 * Format PDF comments for CLI display
 * @param {Array} comments
 * @returns {string}
 */
export function formatPdfComments(comments) {
  if (comments.length === 0) {
    return 'No comments found in PDF.';
  }

  const lines = [];
  let currentPage = 0;

  for (const c of comments) {
    if (c.page !== currentPage) {
      if (currentPage > 0) lines.push('');
      lines.push(`Page ${c.page}:`);
      currentPage = c.page;
    }

    const typeIcon = getTypeIcon(c.type);
    const author = c.author || 'Unknown';
    lines.push(`  ${typeIcon} [${author}] ${c.text}`);
  }

  return lines.join('\n');
}

/**
 * Get icon for annotation type
 * @param {string} type
 * @returns {string}
 */
function getTypeIcon(type) {
  switch (type) {
    case 'Text': return '📝';      // Sticky note
    case 'FreeText': return '💬';  // Text box
    case 'Highlight': return '🖍️'; // Highlight
    case 'Underline': return '📍'; // Underline
    case 'StrikeOut': return '❌'; // Strikethrough
    case 'Squiggly': return '〰️';  // Squiggly
    default: return '💬';
  }
}

/**
 * Get statistics about PDF comments
 * @param {Array} comments
 * @returns {{total: number, byType: object, byAuthor: object, byPage: object}}
 */
export function getPdfCommentStats(comments) {
  const stats = {
    total: comments.length,
    byType: {},
    byAuthor: {},
    byPage: {},
  };

  for (const c of comments) {
    stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;
    stats.byAuthor[c.author] = (stats.byAuthor[c.author] || 0) + 1;
    stats.byPage[c.page] = (stats.byPage[c.page] || 0) + 1;
  }

  return stats;
}
