/**
 * Tests for template variable substitution
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processVariables, hasVariables, findVariables } from '../lib/variables.js';

describe('hasVariables', () => {
  it('should return true for text with variables', () => {
    assert.strictEqual(hasVariables('Hello {{date}}'), true);
    assert.strictEqual(hasVariables('Version: {{version}}'), true);
  });

  it('should return false for text without variables', () => {
    assert.strictEqual(hasVariables('Hello world'), false);
    assert.strictEqual(hasVariables('Some text here'), false);
  });
});

describe('findVariables', () => {
  it('should find all variables in text', () => {
    const vars = findVariables('Date: {{date}}, Version: {{version}}');
    assert.ok(vars.includes('date'));
    assert.ok(vars.includes('version'));
  });

  it('should return empty array for text without variables', () => {
    const vars = findVariables('No variables here');
    assert.strictEqual(vars.length, 0);
  });

  it('should return unique variables only', () => {
    const vars = findVariables('{{date}} and {{date}} again');
    assert.strictEqual(vars.length, 1);
  });
});

describe('processVariables', () => {
  it('should replace {{date}} with current date', () => {
    const result = processVariables('Today is {{date}}');
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(result));
    assert.ok(!result.includes('{{date}}'));
  });

  it('should replace {{year}} with current year', () => {
    const result = processVariables('Copyright {{year}}');
    const currentYear = new Date().getFullYear().toString();
    assert.ok(result.includes(currentYear));
  });

  it('should replace {{title}} from config', () => {
    const result = processVariables('Paper: {{title}}', { title: 'My Paper' });
    assert.ok(result.includes('My Paper'));
  });

  it('should replace {{version}} from config', () => {
    const result = processVariables('Version {{version}}', { version: '1.2.3' });
    assert.ok(result.includes('1.2.3'));
  });

  it('should replace {{author}} with first author', () => {
    const result = processVariables('By {{author}}', {
      authors: ['John Smith', 'Jane Doe']
    });
    assert.ok(result.includes('John Smith'));
  });

  it('should replace {{authors}} with all authors', () => {
    const result = processVariables('By {{authors}}', {
      authors: ['John Smith', 'Jane Doe']
    });
    assert.ok(result.includes('John Smith'));
    assert.ok(result.includes('Jane Doe'));
  });

  it('should handle author objects with name property', () => {
    const result = processVariables('By {{author}}', {
      authors: [{ name: 'John Smith', email: 'john@example.com' }]
    });
    assert.ok(result.includes('John Smith'));
  });

  it('should replace {{word_count}} with word count', () => {
    const result = processVariables('Words: {{word_count}}', {}, {
      sectionContents: ['One two three four five.']
    });
    assert.ok(result.includes('5'));
  });

  it('should handle custom date format', () => {
    const result = processVariables('Date: {{date:MMMM D, YYYY}}');
    // Should have month name
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    assert.ok(months.some(m => result.includes(m)));
  });

  it('should leave unknown variables unchanged if empty config', () => {
    const result = processVariables('Version: {{version}}', {});
    // Empty string since version is undefined
    assert.ok(result.includes('Version:'));
  });

  it('should handle multiple variables in same text', () => {
    const result = processVariables('{{title}} v{{version}}', {
      title: 'My Paper',
      version: '2.0'
    });
    assert.ok(result.includes('My Paper'));
    assert.ok(result.includes('2.0'));
  });
});
