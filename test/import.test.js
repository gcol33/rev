#!/usr/bin/env node

/**
 * Comprehensive test suite for rev import functionality
 * Tests protection of: citations, math, figure anchors, cross-references
 * Tests comment extraction and placement
 */

import { strict as assert } from 'assert';

// Import functions from import.js
const importModule = await import('../lib/import.js');
const {
  generateSmartDiff,
  cleanupAnnotations,
  insertCommentsIntoMarkdown,
} = importModule;

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assertContains(text, substring, msg = '') {
  if (!text.includes(substring)) {
    throw new Error(`Expected to contain "${substring}"${msg ? ': ' + msg : ''}\nGot: ${text.slice(0, 200)}`);
  }
}

function assertNotContains(text, substring, msg = '') {
  if (text.includes(substring)) {
    throw new Error(`Expected NOT to contain "${substring}"${msg ? ': ' + msg : ''}\nGot: ${text.slice(0, 200)}`);
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`Expected: "${expected}"\nActual: "${actual}"${msg ? '\n' + msg : ''}`);
  }
}

// ============================================================================
// CITATION PROTECTION TESTS
// ============================================================================

console.log('\n📚 Citation Protection Tests\n');

test('Simple citation preserved when unchanged', () => {
  const original = 'This is cited [@Smith2021].';
  const word = 'This is cited (Smith 2021).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021]');
  assertNotContains(result, '{--[@Smith2021]--}');
});

test('Multiple citations preserved', () => {
  const original = 'As shown [@Smith2021; @Jones2020] and [@Brown2019].';
  const word = 'As shown (Smith 2021; Jones 2020) and (Brown 2019).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021; @Jones2020]');
  assertContains(result, '[@Brown2019]');
});

test('Citation with surrounding text changes', () => {
  const original = 'Previous work [@Smith2021] showed results.';
  const word = 'Earlier research (Smith 2021) demonstrated outcomes.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021]');
});

test('Citation with et al. author', () => {
  const original = 'According to [@Pyšek2020].';
  const word = 'According to (Pyšek et al. 2020).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Pyšek2020]');
});

test('Citation with letter suffix', () => {
  const original = 'In [@Chytry2008a; @Chytry2008b].';
  const word = 'In (Chytry 2008a; Chytry 2008b).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Chytry2008a; @Chytry2008b]');
});

// ============================================================================
// MATH PROTECTION TESTS
// ============================================================================

console.log('\n🔢 Math Protection Tests\n');

test('Inline math preserved: $p$', () => {
  const original = 'The p-value was $p < 0.05$.';
  const word = 'The p-value was p < 0.05.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$p < 0.05$');
});

test('Inline math with subscript: $p_d$', () => {
  const original = 'Let $p_d$ denote the proportion.';
  const word = 'Let pd denote the proportion.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$p_d$');
});

test('Display math preserved', () => {
  const original = 'The equation is:\n\n$$\\hat{p} = \\frac{\\sum_d w_d}{N}$$\n\nwhere N is total.';
  const word = 'The equation is:\n\np = Σd wd/N\n\nwhere N is total.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$$\\hat{p} = \\frac{\\sum_d w_d}{N}$$');
});

test('Multiple inline math expressions', () => {
  const original = 'Both $p$ and $q$ where $p + q = 1$.';
  const word = 'Both p and q where p + q = 1.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$p$');
  assertContains(result, '$q$');
  assertContains(result, '$p + q = 1$');
});

test('Math with text command', () => {
  const original = 'Calculate $\\text{Var}(X)$.';
  const word = 'Calculate Var(X).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$\\text{Var}(X)$');
});

test('Math NOT protected in code blocks', () => {
  const original = '```\n$variable = 5$\n```';
  const word = '```\nvariable = 5\n```';
  // Code block math should NOT be treated as LaTeX
  const result = generateSmartDiff(original, word);
  // This is a known limitation - document it
  // For now, just ensure no crash
  assert.ok(result.length > 0);
});

test('Escaped dollar sign', () => {
  const original = 'The price is \\$50.';
  const word = 'The price is $50.';
  const result = generateSmartDiff(original, word);
  // Should not crash, escaped $ should be handled
  assert.ok(result.length > 0);
});

// ============================================================================
// FIGURE ANCHOR PROTECTION TESTS
// ============================================================================

console.log('\n🖼️ Figure Anchor Protection Tests\n');

test('Figure anchor preserved: {#fig:label}', () => {
  const original = '![Caption](image.png){#fig:heatmap}';
  const word = 'Caption';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#fig:heatmap}');
});

test('Table anchor preserved: {#tbl:label}', () => {
  const original = 'Table caption {#tbl:results}';
  const word = 'Table caption';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#tbl:results}');
});

test('Multiple anchors preserved', () => {
  const original = '![Fig A](a.png){#fig:first}\n\n![Fig B](b.png){#fig:second}';
  const word = 'Fig A\n\nFig B';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#fig:first}');
  assertContains(result, '{#fig:second}');
});

test('Anchor with width attribute', () => {
  const original = '![Caption](img.png){#fig:test width=50%}';
  const word = 'Caption';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#fig:test');
});

// ============================================================================
// CROSS-REFERENCE PROTECTION TESTS
// ============================================================================

console.log('\n🔗 Cross-Reference Protection Tests\n');

test('Figure reference preserved: @fig:label', () => {
  const original = 'See @fig:heatmap for details.';
  const word = 'See Figure 1 for details.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@fig:heatmap');
});

test('Table reference preserved: @tbl:label', () => {
  const original = 'Results in @tbl:summary show.';
  const word = 'Results in Table 1 show.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@tbl:summary');
});

test('Multiple cross-references', () => {
  const original = 'As shown in @fig:first and @fig:second, and @tbl:data.';
  const word = 'As shown in Figure 1 and Figure 2, and Table 1.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@fig:first');
  assertContains(result, '@fig:second');
  assertContains(result, '@tbl:data');
});

test('Section reference preserved: @sec:label', () => {
  const original = 'Discussed in @sec:methods.';
  const word = 'Discussed in Section 2.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@sec:methods');
});

test('Equation reference preserved: @eq:label', () => {
  const original = 'From @eq:variance we derive.';
  const word = 'From Equation 1 we derive.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@eq:variance');
});

// ============================================================================
// COMMENT INSERTION TESTS
// ============================================================================

console.log('\n💬 Comment Insertion Tests\n');

test('Single comment inserted at correct position', () => {
  const markdown = 'The results were significant.';
  const comments = [{ id: '1', author: 'Reviewer', text: 'Add p-value' }];
  const anchors = new Map([['1', 'significant']]);

  const result = insertCommentsIntoMarkdown(markdown, comments, anchors);
  assertContains(result, '{>>Reviewer: Add p-value<<}');
  // Comment should be after "significant"
  const sigPos = result.indexOf('significant');
  const commentPos = result.indexOf('{>>');
  assert.ok(commentPos > sigPos, 'Comment should be after anchor text');
});

test('Multiple comments inserted correctly', () => {
  const markdown = 'First point. Second point. Third point.';
  const comments = [
    { id: '1', author: 'Alice', text: 'Check first' },
    { id: '2', author: 'Bob', text: 'Check second' },
  ];
  const anchors = new Map([
    ['1', 'First'],
    ['2', 'Second'],
  ]);

  const result = insertCommentsIntoMarkdown(markdown, comments, anchors);
  assertContains(result, '{>>Alice: Check first<<}');
  assertContains(result, '{>>Bob: Check second<<}');
});

test('Comment with no matching anchor is skipped', () => {
  const markdown = 'Some text here.';
  const comments = [{ id: '1', author: 'Reviewer', text: 'Cannot find this' }];
  const anchors = new Map([['1', 'nonexistent anchor text']]);

  const result = insertCommentsIntoMarkdown(markdown, comments, anchors);
  // Comment should not appear since anchor doesn't match
  assertNotContains(result, '{>>Reviewer:');
});

test('Comment anchor with special characters', () => {
  const markdown = 'The p-value (p < 0.05) was significant.';
  const comments = [{ id: '1', author: 'Reviewer', text: 'Good' }];
  const anchors = new Map([['1', 'p < 0.05']]);

  const result = insertCommentsIntoMarkdown(markdown, comments, anchors);
  // Should handle regex special chars in anchor
  assertContains(result, '{>>Reviewer: Good<<}');
});

// ============================================================================
// CLEANUP ANNOTATION TESTS
// ============================================================================

console.log('\n🧹 Annotation Cleanup Tests\n');

test('Adjacent delete+insert becomes substitution', () => {
  const input = '{--old--}{++new++}';
  const result = cleanupAnnotations(input);
  assertEqual(result, '{~~old~>new~~}');
});

test('Delete+insert with space becomes substitution', () => {
  const input = '{--old--} {++new++}';
  const result = cleanupAnnotations(input);
  assertEqual(result, '{~~old~>new~~}');
});

test('Empty annotations removed', () => {
  const input = 'Text {--  --} more {++  ++} end.';
  const result = cleanupAnnotations(input);
  assertEqual(result, 'Text more end.');
});

test('Malformed {-- with ~> fixed', () => {
  const input = '{--key~>critical~~}';
  const result = cleanupAnnotations(input);
  assertEqual(result, '{~~key~>critical~~}');
});

// ============================================================================
// EDGE CASES
// ============================================================================

console.log('\n⚠️ Edge Case Tests\n');

test('Empty original document', () => {
  const original = '';
  const word = 'New content added.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{++New content added.++}');
});

test('Empty word document', () => {
  const original = 'Original content.';
  const word = '';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{--Original content.--}');
});

test('Document with only citations', () => {
  const original = '[@Smith2021]';
  const word = '(Smith 2021)';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021]');
});

test('Document with only math', () => {
  const original = '$x^2 + y^2 = z^2$';
  const word = 'x² + y² = z²';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$x^2 + y^2 = z^2$');
});

test('Very long paragraph', () => {
  const longText = 'Word '.repeat(500);
  const original = longText + '[@Smith2021]';
  const word = longText + '(Smith 2021)';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021]');
});

test('Unicode characters in text', () => {
  const original = 'Données écologiques [@Müller2021].';
  const word = 'Données écologiques (Müller 2021).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Müller2021]');
  assertContains(result, 'écologiques');
});

test('Nested braces in math', () => {
  const original = '$\\frac{a}{b}$ and $\\sqrt{x^{2}}$.';
  const word = 'a/b and √(x²).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$\\frac{a}{b}$');
  assertContains(result, '$\\sqrt{x^{2}}$');
});

test('Citation inside parentheses', () => {
  const original = 'Known effect (see [@Smith2021]).';
  const word = 'Known effect (see Smith 2021).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@Smith2021]');
});

test('Multiple figure refs in same sentence', () => {
  const original = 'See @fig:a, @fig:b, and @fig:c.';
  const word = 'See Figure 1, Figure 2, and Figure 3.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@fig:a');
  assertContains(result, '@fig:b');
  assertContains(result, '@fig:c');
});

test('Mixed citations and math', () => {
  const original = 'The equation $E = mc^2$ was proven [@Einstein1905].';
  const word = 'The equation E = mc² was proven (Einstein 1905).';
  const result = generateSmartDiff(original, word);
  assertContains(result, '$E = mc^2$');
  assertContains(result, '[@Einstein1905]');
});

test('Table with citations', () => {
  const original = '| Study | Result |\n|-------|--------|\n| [@A2020] | Good |';
  const word = 'Study Result\n(A 2020) Good';
  const result = generateSmartDiff(original, word);
  assertContains(result, '[@A2020]');
});

// ============================================================================
// ANCHOR DELETION PROTECTION TESTS
// ============================================================================

console.log('\n🛡️ Anchor Deletion Protection Tests\n');

test('Figure anchor NOT deleted when Word removes it', () => {
  // This is the critical test - Word doesn't preserve {#fig:label}
  const original = '![Caption text](image.png){#fig:heatmap}\n\nSome paragraph.';
  const word = 'Caption text\n\nSome paragraph.';
  const result = generateSmartDiff(original, word);
  // Anchor must be preserved, not inside {--deletion--}
  assertContains(result, '{#fig:heatmap}');
  assertNotContains(result, '{--{#fig:heatmap}--}');
});

test('Table anchor NOT deleted when Word removes it', () => {
  const original = '| A | B |\n|---|---|\n| 1 | 2 |\n\nTable: Caption {#tbl:data}';
  const word = 'A B\n1 2\n\nTable: Caption';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#tbl:data}');
  assertNotContains(result, '{--{#tbl:data}--}');
});

test('Cross-ref NOT substituted with rendered form', () => {
  // @fig:heatmap should not become {~~@fig:heatmap~>Figure 1~~}
  const original = 'See @fig:heatmap for details.';
  const word = 'See Figure 1 for details.';
  const result = generateSmartDiff(original, word);
  assertContains(result, '@fig:heatmap');
  assertNotContains(result, '{~~@fig:heatmap');
});

test('Multiple anchors all preserved when Word removes them', () => {
  const original = `![Fig A](a.png){#fig:a}

![Fig B](b.png){#fig:b}

See @fig:a and @fig:b.`;
  const word = `Fig A

Fig B

See Figure 1 and Figure 2.`;
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#fig:a}');
  assertContains(result, '{#fig:b}');
  assertContains(result, '@fig:a');
  assertContains(result, '@fig:b');
});

test('Anchor with attributes preserved', () => {
  const original = '![Caption](img.png){#fig:wide width=100%}';
  const word = 'Caption';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#fig:wide width=100%}');
});

test('Equation anchor preserved', () => {
  const original = '$$E = mc^2$$ {#eq:einstein}';
  const word = 'E = mc²';
  const result = generateSmartDiff(original, word);
  assertContains(result, '{#eq:einstein}');
});

// ============================================================================
// STRESS TESTS
// ============================================================================

console.log('\n🏋️ Stress Tests\n');

test('Many citations (20+)', () => {
  let original = '';
  let word = '';
  for (let i = 1; i <= 25; i++) {
    original += `Reference [@Author${2000 + i}]. `;
    word += `Reference (Author ${2000 + i}). `;
  }
  const result = generateSmartDiff(original, word);
  // Check first, middle, and last citations
  assertContains(result, '[@Author2001]');
  assertContains(result, '[@Author2013]');
  assertContains(result, '[@Author2025]');
});

test('Many math expressions (20+)', () => {
  let original = '';
  let word = '';
  for (let i = 1; i <= 25; i++) {
    original += `Value $x_${i}$. `;
    word += `Value x${i}. `;
  }
  const result = generateSmartDiff(original, word);
  assertContains(result, '$x_1$');
  assertContains(result, '$x_13$');
  assertContains(result, '$x_25$');
});

test('Many figure references (10+)', () => {
  let original = '';
  let word = '';
  for (let i = 1; i <= 15; i++) {
    original += `See @fig:fig${i}. `;
    word += `See Figure ${i}. `;
  }
  const result = generateSmartDiff(original, word);
  assertContains(result, '@fig:fig1');
  assertContains(result, '@fig:fig8');
  assertContains(result, '@fig:fig15');
});

test('Large document (50 paragraphs)', () => {
  let original = '';
  let word = '';
  for (let i = 1; i <= 50; i++) {
    original += `## Section ${i}\n\nParagraph ${i} with citation [@Auth${i}] and math $x_${i}$.\n\n`;
    word += `Section ${i}\n\nParagraph ${i} with citation (Auth ${i}) and math x${i}.\n\n`;
  }
  const result = generateSmartDiff(original, word);
  // Should handle without crashing
  assert.ok(result.length > original.length * 0.5, 'Result should be substantial');
  assertContains(result, '[@Auth1]');
  assertContains(result, '[@Auth50]');
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failures.length > 0) {
  console.log('Failed tests:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}

console.log('✅ All tests passed!\n');
