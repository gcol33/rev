/**
 * Tests for pdf-import.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  annotationsToComments,
  insertPdfCommentsIntoMarkdown,
  formatPdfComments,
  getPdfCommentStats,
} from '../lib/pdf-import.js';

describe('annotationsToComments', () => {
  it('should convert annotations to comments', () => {
    const annotations = [
      { type: 'Text', page: 1, contents: 'Fix this typo', author: 'Reviewer 1', date: '2024-03-15' },
      { type: 'Highlight', page: 2, contents: 'Clarify this section', author: 'Reviewer 2', date: '2024-03-16' },
    ];

    const comments = annotationsToComments(annotations);
    assert.strictEqual(comments.length, 2);
    assert.strictEqual(comments[0].author, 'Reviewer 1');
    assert.strictEqual(comments[0].text, 'Fix this typo');
    assert.strictEqual(comments[0].page, 1);
    assert.strictEqual(comments[1].author, 'Reviewer 2');
  });

  it('should filter out empty annotations', () => {
    const annotations = [
      { type: 'Text', page: 1, contents: 'Has content', author: 'R1', date: '' },
      { type: 'Highlight', page: 2, contents: '', author: 'R2', date: '' },
      { type: 'Text', page: 3, contents: '   ', author: 'R3', date: '' },
    ];

    const comments = annotationsToComments(annotations);
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].text, 'Has content');
  });
});

describe('insertPdfCommentsIntoMarkdown', () => {
  it('should append comments to markdown', () => {
    const markdown = '# Introduction\n\nThis is the intro.';
    const comments = [
      { author: 'Reviewer 1', text: 'Needs more detail', page: 1, type: 'Text' },
    ];

    const result = insertPdfCommentsIntoMarkdown(markdown, comments);
    assert.ok(result.includes('# Introduction'));
    assert.ok(result.includes('{>>Reviewer 1: [p.1] Needs more detail<<}'));
  });

  it('should group comments by page', () => {
    const markdown = '# Content';
    const comments = [
      { author: 'R1', text: 'Comment 1', page: 1, type: 'Text' },
      { author: 'R2', text: 'Comment 2', page: 1, type: 'Text' },
      { author: 'R1', text: 'Comment 3', page: 2, type: 'Text' },
    ];

    const result = insertPdfCommentsIntoMarkdown(markdown, comments);
    assert.ok(result.includes('[p.1]'));
    assert.ok(result.includes('[p.2]'));
  });

  it('should return unchanged markdown if no comments', () => {
    const markdown = '# Content\n\nText here.';
    const result = insertPdfCommentsIntoMarkdown(markdown, []);
    assert.strictEqual(result, markdown);
  });
});

describe('formatPdfComments', () => {
  it('should format comments by page', () => {
    const comments = [
      { author: 'Reviewer 1', text: 'First comment', page: 1, type: 'Text' },
      { author: 'Reviewer 2', text: 'Second comment', page: 2, type: 'Highlight' },
    ];

    const formatted = formatPdfComments(comments);
    assert.ok(formatted.includes('Page 1:'));
    assert.ok(formatted.includes('Page 2:'));
    assert.ok(formatted.includes('Reviewer 1'));
    assert.ok(formatted.includes('First comment'));
  });

  it('should return message for empty comments', () => {
    const formatted = formatPdfComments([]);
    assert.strictEqual(formatted, 'No comments found in PDF.');
  });
});

describe('getPdfCommentStats', () => {
  it('should calculate statistics', () => {
    const comments = [
      { author: 'Reviewer 1', text: 'C1', page: 1, type: 'Text' },
      { author: 'Reviewer 1', text: 'C2', page: 1, type: 'Highlight' },
      { author: 'Reviewer 2', text: 'C3', page: 2, type: 'Text' },
    ];

    const stats = getPdfCommentStats(comments);
    assert.strictEqual(stats.total, 3);
    assert.strictEqual(stats.byAuthor['Reviewer 1'], 2);
    assert.strictEqual(stats.byAuthor['Reviewer 2'], 1);
    assert.strictEqual(stats.byPage[1], 2);
    assert.strictEqual(stats.byPage[2], 1);
    assert.strictEqual(stats.byType['Text'], 2);
    assert.strictEqual(stats.byType['Highlight'], 1);
  });
});
