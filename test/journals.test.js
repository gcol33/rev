/**
 * Tests for journals.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  listJournals,
  getJournalProfile,
  validateManuscript,
} from '../lib/journals.js';

describe('listJournals', () => {
  it('should return array of journals', () => {
    const journals = listJournals();
    assert.ok(Array.isArray(journals));
    assert.ok(journals.length > 0);
  });

  it('should include nature', () => {
    const journals = listJournals();
    const nature = journals.find(j => j.id === 'nature');
    assert.ok(nature);
    assert.strictEqual(nature.name, 'Nature');
  });

  it('should have id, name, and url for each journal', () => {
    const journals = listJournals();
    for (const j of journals) {
      assert.ok(j.id);
      assert.ok(j.name);
      assert.ok(j.url);
    }
  });
});

describe('getJournalProfile', () => {
  it('should return profile for valid journal', () => {
    const profile = getJournalProfile('nature');
    assert.ok(profile);
    assert.strictEqual(profile.name, 'Nature');
  });

  it('should handle case-insensitive lookup', () => {
    const profile = getJournalProfile('NATURE');
    assert.ok(profile);
  });

  it('should handle spaces as hyphens', () => {
    const profile = getJournalProfile('plos one');
    assert.ok(profile);
    assert.strictEqual(profile.name, 'PLOS ONE');
  });

  it('should return null for unknown journal', () => {
    const profile = getJournalProfile('not-a-journal');
    assert.strictEqual(profile, null);
  });
});

describe('validateManuscript', () => {
  const shortManuscript = `---
title: Test Paper
---

# Abstract

This is a short abstract.

# Introduction

Short intro.

# Methods

Methods here.

# Results

Results here.

# Discussion

Discussion here.
`;

  const longManuscript = `---
title: ${'A '.repeat(100)}Very Long Title
---

# Abstract

${'Word '.repeat(200)}

# Introduction

${'Content '.repeat(5000)}
`;

  it('should validate manuscript structure', () => {
    const result = validateManuscript(shortManuscript, 'nature');
    assert.ok(result);
    assert.ok(result.stats);
    assert.strictEqual(result.journal, 'Nature');
  });

  it('should return unknown journal error', () => {
    const result = validateManuscript(shortManuscript, 'fake-journal');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].includes('Unknown journal'));
  });

  it('should detect word count over limit', () => {
    const result = validateManuscript(longManuscript, 'nature');
    const wordCountError = result.errors.find(e => e.includes('words'));
    assert.ok(wordCountError);
  });

  it('should track figure count', () => {
    const textWithFigures = `
# Results

![Figure 1](fig1.png){#fig:one}
![Figure 2](fig2.png){#fig:two}
`;
    const result = validateManuscript(textWithFigures, 'plos-one');
    assert.strictEqual(result.stats.figures, 2);
  });

  it('should warn about missing sections', () => {
    const incompleteText = `
# Introduction

Just intro, no other sections.
`;
    const result = validateManuscript(incompleteText, 'nature');
    const sectionWarning = result.warnings.find(w => w.includes('Missing required section'));
    assert.ok(sectionWarning);
  });

  it('should count references', () => {
    const textWithRefs = `
As shown by @smith2020 and @jones2021, the results confirm @brown2019.
`;
    const result = validateManuscript(textWithRefs, 'plos-one');
    assert.strictEqual(result.stats.references, 3);
  });
});
