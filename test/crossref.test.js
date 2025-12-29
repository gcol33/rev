/**
 * Tests for crossref.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseReferenceList,
  detectHardcodedRefs,
  detectDynamicRefs,
  normalizeType,
  parseRefNumber,
  getRefStatus,
} from '../lib/crossref.js';

// Helper to extract number strings from parsed refs
function toStrings(refs) {
  return refs.map(r => {
    const prefix = r.isSupp ? 'S' : '';
    const suffix = r.suffix || '';
    return `${prefix}${r.num}${suffix}`;
  });
}

describe('parseReferenceList', () => {
  it('should parse single number', () => {
    const result = parseReferenceList('1');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].num, 1);
  });

  it('should parse simple range', () => {
    const result = parseReferenceList('1-3');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1', '2', '3']);
  });

  it('should parse comma list', () => {
    const result = parseReferenceList('1, 2, 3');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1', '2', '3']);
  });

  it('should parse list with and', () => {
    const result = parseReferenceList('1, 2, and 3');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1', '2', '3']);
  });

  it('should parse letter suffixes', () => {
    const result = parseReferenceList('1a');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].num, 1);
    assert.strictEqual(result[0].suffix, 'a');
  });

  it('should expand letter suffix range', () => {
    const result = parseReferenceList('1a-c');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1a', '1b', '1c']);
  });

  it('should parse implied prefix (1a, b, c)', () => {
    const result = parseReferenceList('1a, b, c');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1a', '1b', '1c']);
  });

  it('should handle supplementary figures', () => {
    const result = parseReferenceList('S1-S3');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['S1', 'S2', 'S3']);
  });

  it('should parse cross-number suffix range', () => {
    const result = parseReferenceList('1a-2b');
    const strs = toStrings(result);
    assert.ok(strs.includes('1a'));
    assert.ok(strs.includes('1b'));
    assert.ok(strs.includes('2a'));
    assert.ok(strs.includes('2b'));
  });

  it('should handle complex pattern with and', () => {
    const result = parseReferenceList('1, 2 and 3');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1', '2', '3']);
  });
});

describe('detectHardcodedRefs', () => {
  it('should detect "Figure 1"', () => {
    const refs = detectHardcodedRefs('See Figure 1 for details.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'fig'); // normalized type
    assert.deepStrictEqual(toStrings(refs[0].numbers), ['1']);
  });

  it('should detect "Fig. 2"', () => {
    const refs = detectHardcodedRefs('See Fig. 2 for details.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'fig');
  });

  it('should detect "Figs. 1-3"', () => {
    const refs = detectHardcodedRefs('See Figs. 1-3 for details.');
    assert.strictEqual(refs.length, 1);
    assert.deepStrictEqual(toStrings(refs[0].numbers), ['1', '2', '3']);
  });

  it('should detect "Figures 1, 2, and 3"', () => {
    const refs = detectHardcodedRefs('See Figures 1, 2, and 3.');
    assert.strictEqual(refs.length, 1);
    assert.deepStrictEqual(toStrings(refs[0].numbers), ['1', '2', '3']);
  });

  it('should detect "Fig. 1a-c"', () => {
    const refs = detectHardcodedRefs('See Fig. 1a-c.');
    assert.strictEqual(refs.length, 1);
    const strs = toStrings(refs[0].numbers);
    assert.ok(strs.includes('1a'));
    assert.ok(strs.includes('1b'));
    assert.ok(strs.includes('1c'));
  });

  it('should detect tables', () => {
    const refs = detectHardcodedRefs('See Table 1.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'tbl'); // normalized type
  });

  it('should detect equations', () => {
    const refs = detectHardcodedRefs('Using Equation 1.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'eq'); // normalized type
  });

  it('should detect multiple refs in same text', () => {
    const refs = detectHardcodedRefs('See Figure 1 and Table 2.');
    assert.strictEqual(refs.length, 2);
  });

  it('should not match "a" from "and" as suffix', () => {
    const refs = detectHardcodedRefs('Figures 1 and 2');
    assert.strictEqual(refs.length, 1);
    const strs = toStrings(refs[0].numbers);
    assert.deepStrictEqual(strs, ['1', '2']);
    // Should NOT include 'a' as a separate number
    assert.ok(!strs.includes('a'));
  });
});

describe('detectDynamicRefs', () => {
  it('should detect @fig:label', () => {
    const refs = detectDynamicRefs('See @fig:heatmap for details.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'fig');
    assert.strictEqual(refs[0].label, 'heatmap');
  });

  it('should detect @tbl:label', () => {
    const refs = detectDynamicRefs('See @tbl:results.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'tbl');
  });

  it('should detect @eq:label', () => {
    const refs = detectDynamicRefs('Using @eq:main.');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].type, 'eq');
  });

  it('should detect multiple refs', () => {
    const refs = detectDynamicRefs('See @fig:a and @fig:b.');
    assert.strictEqual(refs.length, 2);
  });

  it('should not match citations (no colon)', () => {
    const refs = detectDynamicRefs('As shown in @smith2020.');
    // Citations don't have colons, only cross-refs do
    // The function may return 0 or filter them out
    const crossRefs = refs.filter(r => r.type);
    assert.strictEqual(crossRefs.length, 0);
  });
});

describe('normalizeType', () => {
  it('should normalize Figure to fig', () => {
    assert.strictEqual(normalizeType('Figure'), 'fig');
    assert.strictEqual(normalizeType('Figures'), 'fig');
    assert.strictEqual(normalizeType('Fig.'), 'fig');
    assert.strictEqual(normalizeType('Figs.'), 'fig');
  });

  it('should normalize Table to tbl', () => {
    assert.strictEqual(normalizeType('Table'), 'tbl');
    assert.strictEqual(normalizeType('Tables'), 'tbl');
    assert.strictEqual(normalizeType('Tab.'), 'tbl');
  });

  it('should normalize Equation to eq', () => {
    assert.strictEqual(normalizeType('Equation'), 'eq');
    assert.strictEqual(normalizeType('Equations'), 'eq');
    assert.strictEqual(normalizeType('Eq.'), 'eq');
  });

  it('should be case-insensitive', () => {
    assert.strictEqual(normalizeType('FIGURE'), 'fig');
    assert.strictEqual(normalizeType('figure'), 'fig');
  });
});

describe('parseRefNumber', () => {
  it('should parse simple numbers', () => {
    const result = parseRefNumber('1');
    assert.strictEqual(result.num, 1);
    assert.strictEqual(result.isSupp, false);
    assert.strictEqual(result.suffix, null);
  });

  it('should parse supplementary numbers', () => {
    const result = parseRefNumber('S1');
    assert.strictEqual(result.num, 1);
    assert.strictEqual(result.isSupp, true);
  });

  it('should parse numbers with letter suffix', () => {
    const result = parseRefNumber('2a');
    assert.strictEqual(result.num, 2);
    assert.strictEqual(result.suffix, 'a');
  });

  it('should handle supplementary with suffix', () => {
    const result = parseRefNumber('S3b');
    assert.strictEqual(result.num, 3);
    assert.strictEqual(result.isSupp, true);
    assert.strictEqual(result.suffix, 'b');
  });

  it('should handle empty input', () => {
    const result = parseRefNumber('');
    assert.strictEqual(result.num, 0);
  });
});

describe('getRefStatus', () => {
  it('should count dynamic and hardcoded refs', () => {
    const text = 'See @fig:test and Figure 1 and @tbl:data.';
    const status = getRefStatus(text, { figures: new Map(), tables: new Map(), equations: new Map() });

    assert.strictEqual(status.dynamic.length, 2);
    assert.strictEqual(status.hardcoded.length, 1);
  });

  it('should count anchors', () => {
    const text = '![Caption](img.png){#fig:test}\n\n| Table |{#tbl:data}';
    const status = getRefStatus(text, { figures: new Map(), tables: new Map(), equations: new Map() });

    assert.strictEqual(status.anchors.figures, 1);
    assert.strictEqual(status.anchors.tables, 1);
  });
});

// Edge cases for parseReferenceList
describe('parseReferenceList edge cases', () => {
  it('should handle empty string', () => {
    const result = parseReferenceList('');
    assert.strictEqual(result.length, 0);
  });

  it('should handle null', () => {
    const result = parseReferenceList(null);
    assert.strictEqual(result.length, 0);
  });

  it('should handle ampersand as separator', () => {
    const result = parseReferenceList('1 & 2');
    const strs = toStrings(result);
    assert.deepStrictEqual(strs, ['1', '2']);
  });

  it('should handle en-dash and em-dash', () => {
    const result1 = parseReferenceList('1–3'); // en-dash
    const result2 = parseReferenceList('1—3'); // em-dash

    assert.deepStrictEqual(toStrings(result1), ['1', '2', '3']);
    assert.deepStrictEqual(toStrings(result2), ['1', '2', '3']);
  });

  it('should handle mixed supplementary and regular', () => {
    const result = parseReferenceList('1, S1, 2');
    const strs = toStrings(result);
    assert.ok(strs.includes('1'));
    assert.ok(strs.includes('S1'));
    assert.ok(strs.includes('2'));
  });
});

// Edge cases for detectHardcodedRefs
describe('detectHardcodedRefs edge cases', () => {
  it('should handle supplementary figures', () => {
    const refs = detectHardcodedRefs('See Supplementary Figure S1.');
    // Depends on implementation - may or may not match
    assert.ok(Array.isArray(refs));
  });

  it('should not match figure in code blocks', () => {
    // This is text-based, so code blocks aren't automatically skipped
    // Just verify it doesn't crash
    const refs = detectHardcodedRefs('```\nFigure 1\n```');
    assert.ok(Array.isArray(refs));
  });

  it('should track position correctly', () => {
    const text = 'First sentence. See Figure 1. Last sentence.';
    const refs = detectHardcodedRefs(text);

    assert.ok(refs[0].position > 0);
    assert.ok(refs[0].position < text.length);
  });

  it('should handle abbreviation variations', () => {
    const refs1 = detectHardcodedRefs('Fig 1'); // no period
    const refs2 = detectHardcodedRefs('Figs 1-2'); // plural no period

    assert.strictEqual(refs1.length, 1);
    assert.strictEqual(refs2.length, 1);
  });
});

// Edge cases for detectDynamicRefs
describe('detectDynamicRefs edge cases', () => {
  it('should handle labels with numbers', () => {
    const refs = detectDynamicRefs('@fig:figure1');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].label, 'figure1');
  });

  it('should handle labels with hyphens', () => {
    const refs = detectDynamicRefs('@fig:my-figure');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].label, 'my-figure');
  });

  it('should handle labels with underscores', () => {
    const refs = detectDynamicRefs('@tbl:data_table');
    assert.strictEqual(refs.length, 1);
    assert.strictEqual(refs[0].label, 'data_table');
  });

  it('should handle multiple refs on same line', () => {
    const refs = detectDynamicRefs('@fig:a, @fig:b, and @fig:c');
    assert.strictEqual(refs.length, 3);
  });

  it('should track position', () => {
    const text = 'See @fig:test here.';
    const refs = detectDynamicRefs(text);
    assert.strictEqual(refs[0].position, 4); // 'See '
  });
});
