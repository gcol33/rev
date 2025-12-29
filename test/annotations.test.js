/**
 * Tests for annotations.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseAnnotations,
  stripAnnotations,
  getComments,
  countAnnotations,
  applyDecision,
} from '../lib/annotations.js';

describe('parseAnnotations', () => {
  it('should parse insertions', () => {
    const text = 'Hello {++world++}!';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].type, 'insert');
    assert.strictEqual(annotations[0].content, 'world');
  });

  it('should parse deletions', () => {
    const text = 'Hello {--world--}!';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].type, 'delete');
    assert.strictEqual(annotations[0].content, 'world');
  });

  it('should parse substitutions', () => {
    const text = 'Hello {~~world~>universe~~}!';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].type, 'substitute');
    assert.strictEqual(annotations[0].content, 'world');
    assert.strictEqual(annotations[0].replacement, 'universe');
  });

  it('should parse comments', () => {
    const text = 'Hello {>>Author: this is a comment<<}!';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].type, 'comment');
    assert.strictEqual(annotations[0].author, 'Author');
    assert.strictEqual(annotations[0].content, 'this is a comment');
  });

  it('should parse comments without author', () => {
    const text = 'Hello {>>a comment<<}!';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 1);
    assert.strictEqual(annotations[0].type, 'comment');
    // Author is empty string when not specified
    assert.ok(annotations[0].author === null || annotations[0].author === '');
    assert.strictEqual(annotations[0].content, 'a comment');
  });

  it('should parse multiple annotations', () => {
    const text = '{++New++} {--old--} text {~~changed~>updated~~}';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations.length, 3);
  });

  it('should track line numbers', () => {
    const text = 'Line 1\n{++inserted++}\nLine 3';
    const annotations = parseAnnotations(text);
    assert.strictEqual(annotations[0].line, 2);
  });
});

describe('stripAnnotations', () => {
  it('should apply insertions', () => {
    const text = 'Hello {++world++}!';
    const result = stripAnnotations(text);
    assert.strictEqual(result, 'Hello world!');
  });

  it('should apply deletions', () => {
    const text = 'Hello {--world--}!';
    const result = stripAnnotations(text);
    assert.strictEqual(result, 'Hello !');
  });

  it('should apply substitutions', () => {
    const text = 'Hello {~~world~>universe~~}!';
    const result = stripAnnotations(text);
    assert.strictEqual(result, 'Hello universe!');
  });

  it('should strip comments', () => {
    const text = 'Hello{>>comment<<} world!';
    const result = stripAnnotations(text);
    assert.strictEqual(result, 'Hello world!');
  });

  it('should keep comments when option set', () => {
    const text = 'Hello{>>comment<<} world!';
    const result = stripAnnotations(text, { keepComments: true });
    assert.strictEqual(result, 'Hello{>>comment<<} world!');
  });
});

describe('getComments', () => {
  it('should extract comments with author', () => {
    const text = '{>>Reviewer: Please clarify<<}';
    const comments = getComments(text);
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].author, 'Reviewer');
    assert.strictEqual(comments[0].content, 'Please clarify');
  });

  it('should detect resolved comments', () => {
    const text = '{>>Author: Done [RESOLVED]<<}';
    const comments = getComments(text);
    assert.strictEqual(comments[0].resolved, true);
    assert.strictEqual(comments[0].content, 'Done');
  });

  it('should filter pending only', () => {
    const text = '{>>A: pending<<} {>>B: done [RESOLVED]<<}';
    const comments = getComments(text, { pendingOnly: true });
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].author, 'A');
  });

  it('should filter resolved only', () => {
    const text = '{>>A: pending<<} {>>B: done [RESOLVED]<<}';
    const comments = getComments(text, { resolvedOnly: true });
    assert.strictEqual(comments.length, 1);
    assert.strictEqual(comments[0].author, 'B');
  });
});

describe('countAnnotations', () => {
  it('should count all annotation types', () => {
    const text = '{++ins++} {--del--} {~~sub~>rep~~} {>>comment<<}';
    const counts = countAnnotations(text);
    assert.strictEqual(counts.inserts, 1);
    assert.strictEqual(counts.deletes, 1);
    assert.strictEqual(counts.substitutes, 1);
    assert.strictEqual(counts.comments, 1);
    assert.strictEqual(counts.total, 4);
  });
});

describe('applyDecision', () => {
  it('should accept insertions', () => {
    const text = 'Hello {++world++}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], true);
    assert.strictEqual(result, 'Hello world!');
  });

  it('should reject insertions', () => {
    const text = 'Hello {++world++}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], false);
    assert.strictEqual(result, 'Hello !');
  });

  it('should accept deletions', () => {
    const text = 'Hello {--world--}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], true);
    assert.strictEqual(result, 'Hello !');
  });

  it('should reject deletions', () => {
    const text = 'Hello {--world--}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], false);
    assert.strictEqual(result, 'Hello world!');
  });

  it('should accept substitutions', () => {
    const text = 'Hello {~~world~>universe~~}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], true);
    assert.strictEqual(result, 'Hello universe!');
  });

  it('should reject substitutions', () => {
    const text = 'Hello {~~world~>universe~~}!';
    const annotations = parseAnnotations(text);
    const result = applyDecision(text, annotations[0], false);
    assert.strictEqual(result, 'Hello world!');
  });
});
