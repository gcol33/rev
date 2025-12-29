/**
 * Tests for grammar checking module
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  checkGrammar,
  getGrammarSummary,
  loadDictionary,
  saveDictionary,
  addToDictionary,
  removeFromDictionary,
  listRules,
} from '../lib/grammar.js';

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrev-grammar-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('checkGrammar', () => {
  it('should detect passive voice', () => {
    // Use regular past participle (-ed ending) for reliable detection
    const issues = checkGrammar('The document was created by John.');
    assert.ok(issues.some(i => i.rule === 'passive-voice'));
  });

  it('should detect weasel words', () => {
    const issues = checkGrammar('This is very important and really significant.');
    assert.ok(issues.some(i => i.rule === 'weasel-words'));
  });

  it('should detect duplicate words', () => {
    const issues = checkGrammar('The the quick brown fox.');
    assert.ok(issues.some(i => i.rule === 'duplicate-words'));
  });

  it('should detect weak sentence starts', () => {
    const issues = checkGrammar('There is a problem with this approach.');
    assert.ok(issues.some(i => i.rule === 'weak-start'));
  });

  it('should detect cliches', () => {
    const issues = checkGrammar('At the end of the day, this is important.');
    assert.ok(issues.some(i => i.rule === 'cliches'));
  });

  it('should detect redundant phrases', () => {
    const issues = checkGrammar('The final outcome was positive.');
    assert.ok(issues.some(i => i.rule === 'redundancy'));
  });

  it('should return empty array for clean text', () => {
    const issues = checkGrammar('The quick brown fox jumps.');
    const errors = issues.filter(i => i.severity === 'error');
    assert.strictEqual(errors.length, 0);
  });

  it('should include line numbers', () => {
    const issues = checkGrammar('Line one.\nThis is very good.\nLine three.');
    const weasel = issues.find(i => i.rule === 'weasel-words');
    assert.ok(weasel);
    assert.strictEqual(weasel.line, 2);
  });

  it('should skip words in custom dictionary', () => {
    // Create dictionary with "very"
    saveDictionary(new Set(['very']), tempDir);

    const issues = checkGrammar('This is very important.', {
      directory: tempDir
    });
    const veryIssue = issues.find(i => i.match.toLowerCase() === 'very');
    assert.ok(!veryIssue);
  });
});

describe('scientific rules', () => {
  it('should detect first person pronouns', () => {
    const issues = checkGrammar('We found that I was correct.');
    assert.ok(issues.some(i => i.rule === 'first-person'));
  });

  it('should detect prove/proof in scientific context', () => {
    const issues = checkGrammar('This proves our hypothesis.');
    assert.ok(issues.some(i => i.rule === 'prove'));
  });

  it('should detect obviously/clearly', () => {
    const issues = checkGrammar('Obviously, this is correct.');
    assert.ok(issues.some(i => i.rule === 'obviously'));
  });

  it('should skip scientific rules when disabled', () => {
    const issues = checkGrammar('We found that I was correct.', {
      scientific: false
    });
    assert.ok(!issues.some(i => i.rule === 'first-person'));
  });
});

describe('getGrammarSummary', () => {
  it('should count issues by severity', () => {
    const issues = [
      { severity: 'error', rule: 'test' },
      { severity: 'warning', rule: 'test' },
      { severity: 'warning', rule: 'test' },
      { severity: 'info', rule: 'test' },
    ];

    const summary = getGrammarSummary(issues);
    assert.strictEqual(summary.total, 4);
    assert.strictEqual(summary.errors, 1);
    assert.strictEqual(summary.warnings, 2);
    assert.strictEqual(summary.info, 1);
  });

  it('should count issues by rule', () => {
    const issues = [
      { severity: 'warning', rule: 'weasel-words' },
      { severity: 'warning', rule: 'weasel-words' },
      { severity: 'error', rule: 'duplicate-words' },
    ];

    const summary = getGrammarSummary(issues);
    assert.strictEqual(summary.byRule['weasel-words'], 2);
    assert.strictEqual(summary.byRule['duplicate-words'], 1);
  });
});

describe('dictionary management', () => {
  it('should load empty dictionary when none exists', () => {
    const words = loadDictionary(tempDir);
    assert.strictEqual(words.size, 0);
  });

  it('should save and load dictionary', () => {
    const words = new Set(['word1', 'word2']);
    saveDictionary(words, tempDir);

    const loaded = loadDictionary(tempDir);
    assert.ok(loaded.has('word1'));
    assert.ok(loaded.has('word2'));
  });

  it('should add word to dictionary', () => {
    const added = addToDictionary('newword', tempDir);
    assert.strictEqual(added, true);

    const words = loadDictionary(tempDir);
    assert.ok(words.has('newword'));
  });

  it('should not add duplicate word', () => {
    addToDictionary('existing', tempDir);
    const added = addToDictionary('existing', tempDir);
    assert.strictEqual(added, false);
  });

  it('should remove word from dictionary', () => {
    addToDictionary('toremove', tempDir);

    const removed = removeFromDictionary('toremove', tempDir);
    assert.strictEqual(removed, true);

    const words = loadDictionary(tempDir);
    assert.ok(!words.has('toremove'));
  });

  it('should return false when removing non-existent word', () => {
    const removed = removeFromDictionary('nonexistent', tempDir);
    assert.strictEqual(removed, false);
  });

  it('should normalize words to lowercase', () => {
    addToDictionary('MixedCase', tempDir);

    const words = loadDictionary(tempDir);
    assert.ok(words.has('mixedcase'));
  });
});

describe('listRules', () => {
  it('should return grammar rules', () => {
    const rules = listRules(false);
    assert.ok(rules.length > 0);
    assert.ok(rules.some(r => r.id === 'passive-voice'));
  });

  it('should include scientific rules when enabled', () => {
    const rules = listRules(true);
    assert.ok(rules.some(r => r.id === 'first-person'));
    assert.ok(rules.some(r => r.id === 'prove'));
  });

  it('should exclude scientific rules when disabled', () => {
    const rules = listRules(false);
    assert.ok(!rules.some(r => r.id === 'first-person'));
  });
});
