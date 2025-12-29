/**
 * Tests for format.js
 * Tests CLI formatting utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  table,
  simpleTable,
  box,
  stats,
  progress,
  status,
  setEmoji,
  diff,
  inlineDiffPreview,
  header,
} from '../lib/format.js';

describe('table', () => {
  it('should create a bordered table', () => {
    const result = table(
      ['Name', 'Value'],
      [['foo', '123'], ['bar', '456']]
    );

    assert.ok(result.includes('Name'));
    assert.ok(result.includes('Value'));
    assert.ok(result.includes('foo'));
    assert.ok(result.includes('123'));
    assert.ok(result.includes('│')); // border character
  });

  it('should handle empty rows', () => {
    const result = table(['Col1', 'Col2'], []);
    assert.ok(result.includes('Col1'));
    assert.ok(result.includes('Col2'));
  });

  it('should handle alignment options', () => {
    const result = table(
      ['Left', 'Right', 'Center'],
      [['a', 'b', 'c']],
      { align: ['left', 'right', 'center'] }
    );

    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });
});

describe('simpleTable', () => {
  it('should create a borderless table', () => {
    const result = simpleTable(
      ['Name', 'Value'],
      [['foo', '123']]
    );

    assert.ok(result.includes('Name'));
    assert.ok(result.includes('foo'));
    assert.ok(!result.includes('│')); // no vertical borders
  });

  it('should support custom indent', () => {
    const result = simpleTable(
      ['Col'],
      [['val']],
      { indent: '    ' }
    );

    assert.ok(result.startsWith('    '));
  });
});

describe('box', () => {
  it('should wrap content in a box', () => {
    const result = box('Hello World');

    assert.ok(result.includes('Hello World'));
    assert.ok(result.includes('╭')); // top-left corner
    assert.ok(result.includes('╯')); // bottom-right corner
  });

  it('should support title option', () => {
    const result = box('Content', { title: 'Title' });

    assert.ok(result.includes('Title'));
    assert.ok(result.includes('Content'));
  });

  it('should handle multiline content', () => {
    const result = box('Line 1\nLine 2\nLine 3');

    assert.ok(result.includes('Line 1'));
    assert.ok(result.includes('Line 2'));
    assert.ok(result.includes('Line 3'));
  });
});

describe('stats', () => {
  it('should format stats object', () => {
    const result = stats({
      'Total': 100,
      'Valid': 80,
      'Invalid': 20,
    });

    assert.ok(result.includes('Total'));
    assert.ok(result.includes('100'));
    assert.ok(result.includes('Valid'));
    assert.ok(result.includes('80'));
  });

  it('should support title option', () => {
    const result = stats({ Count: 5 }, { title: 'Statistics' });

    assert.ok(result.includes('Statistics'));
    assert.ok(result.includes('Count'));
  });
});

describe('progress', () => {
  it('should show progress bar', () => {
    const result = progress(50, 100);

    assert.ok(result.includes('50%'));
    assert.ok(result.includes('50/100'));
  });

  it('should handle 0%', () => {
    const result = progress(0, 100);

    assert.ok(result.includes('0%'));
  });

  it('should handle 100%', () => {
    const result = progress(100, 100);

    assert.ok(result.includes('100%'));
  });

  it('should support label option', () => {
    const result = progress(50, 100, { label: 'Loading: ' });

    assert.ok(result.startsWith('Loading:'));
  });
});

describe('status', () => {
  it('should format success status', () => {
    const result = status('success', 'Done');

    assert.ok(result.includes('Done'));
    assert.ok(result.includes('✓'));
  });

  it('should format error status', () => {
    const result = status('error', 'Failed');

    assert.ok(result.includes('Failed'));
    assert.ok(result.includes('✗'));
  });

  it('should format warning status', () => {
    const result = status('warning', 'Caution');

    assert.ok(result.includes('Caution'));
  });

  it('should format info status', () => {
    const result = status('info', 'Note');

    assert.ok(result.includes('Note'));
  });
});

describe('setEmoji', () => {
  it('should toggle emoji mode', () => {
    setEmoji(false);
    const result1 = status('success', 'Done');

    setEmoji(true);
    const result2 = status('success', 'Done');

    // Both should work without errors
    assert.ok(result1.includes('Done'));
    assert.ok(result2.includes('Done'));

    // Reset to default
    setEmoji(false);
  });
});

describe('diff', () => {
  it('should format diff stats', () => {
    const result = diff(5, 3, 2);

    assert.ok(result.includes('5 insertion'));
    assert.ok(result.includes('3 deletion'));
    assert.ok(result.includes('2 substitution'));
  });

  it('should handle singular forms', () => {
    const result = diff(1, 1, 1);

    assert.ok(result.includes('1 insertion'));
    assert.ok(!result.includes('insertions'));
  });

  it('should handle zero counts', () => {
    const result = diff(0, 0, 0);

    assert.strictEqual(result, '');
  });

  it('should only show non-zero counts', () => {
    const result = diff(5, 0, 0);

    assert.ok(result.includes('insertion'));
    assert.ok(!result.includes('deletion'));
    assert.ok(!result.includes('substitution'));
  });
});

describe('inlineDiffPreview', () => {
  it('should show insertion previews', () => {
    const text = 'Hello {++world++} there';
    const result = inlineDiffPreview(text);

    assert.ok(result.includes('+'));
    assert.ok(result.includes('world'));
  });

  it('should show deletion previews', () => {
    const text = 'Hello {--old--} there';
    const result = inlineDiffPreview(text);

    assert.ok(result.includes('-'));
    assert.ok(result.includes('old'));
  });

  it('should show substitution previews', () => {
    const text = 'Hello {~~old~>new~~} there';
    const result = inlineDiffPreview(text);

    assert.ok(result.includes('~'));
  });

  it('should limit number of previews', () => {
    const changes = Array(20).fill('{++insert++}').join(' ');
    const result = inlineDiffPreview(changes, { maxLines: 5 });

    // Should show "and X more changes" message
    assert.ok(result.includes('more changes'));
  });

  it('should handle text without changes', () => {
    const text = 'Plain text without any changes';
    const result = inlineDiffPreview(text);

    assert.strictEqual(result, '');
  });
});

describe('header', () => {
  it('should create a section header', () => {
    const result = header('Section Title');

    assert.ok(result.includes('Section Title'));
    assert.ok(result.includes('─'));
  });

  it('should respect width option', () => {
    const result = header('Title', { width: 40 });

    // Should have padding characters
    assert.ok(result.includes('─'));
  });
});
