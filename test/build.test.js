/**
 * Tests for build.js
 * Tests configuration loading and helper functions (not pandoc execution)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  DEFAULT_CONFIG,
  loadConfig,
  findSections,
  combineSections,
  buildPandocArgs,
  hasPandoc,
  hasPandocCrossref,
} from '../lib/build.js';

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrev-build-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('DEFAULT_CONFIG', () => {
  it('should have required default fields', () => {
    assert.ok(DEFAULT_CONFIG.title);
    assert.ok(Array.isArray(DEFAULT_CONFIG.authors));
    assert.ok(Array.isArray(DEFAULT_CONFIG.sections));
    assert.ok(DEFAULT_CONFIG.crossref);
    assert.ok(DEFAULT_CONFIG.pdf);
    assert.ok(DEFAULT_CONFIG.docx);
  });

  it('should have sensible PDF defaults', () => {
    assert.strictEqual(DEFAULT_CONFIG.pdf.documentclass, 'article');
    assert.strictEqual(DEFAULT_CONFIG.pdf.fontsize, '12pt');
  });
});

describe('loadConfig', () => {
  it('should return default config when no rev.yaml exists', () => {
    const config = loadConfig(tempDir);
    assert.strictEqual(config.title, DEFAULT_CONFIG.title);
    assert.strictEqual(config._configPath, null);
  });

  it('should load and merge rev.yaml with defaults', () => {
    fs.writeFileSync(path.join(tempDir, 'rev.yaml'), `
title: "My Paper"
authors:
  - name: John Doe
pdf:
  fontsize: 11pt
`);

    const config = loadConfig(tempDir);
    assert.strictEqual(config.title, 'My Paper');
    assert.strictEqual(config.authors[0].name, 'John Doe');
    assert.strictEqual(config.pdf.fontsize, '11pt');
    // Should still have defaults for unspecified fields
    assert.strictEqual(config.pdf.documentclass, 'article');
  });

  it('should throw for invalid YAML', () => {
    fs.writeFileSync(path.join(tempDir, 'rev.yaml'), `
title: "Valid
  invalid: yaml: here
`);

    assert.throws(() => loadConfig(tempDir), /Failed to parse rev.yaml/);
  });

  it('should deep merge nested configs', () => {
    fs.writeFileSync(path.join(tempDir, 'rev.yaml'), `
crossref:
  figureTitle: "Fig."
`);

    const config = loadConfig(tempDir);
    assert.strictEqual(config.crossref.figureTitle, 'Fig.');
    // Other crossref defaults should be preserved
    assert.strictEqual(config.crossref.tableTitle, 'Table');
  });
});

describe('findSections', () => {
  it('should use sections from config if provided', () => {
    fs.writeFileSync(path.join(tempDir, 'intro.md'), '# Intro');
    fs.writeFileSync(path.join(tempDir, 'methods.md'), '# Methods');
    fs.writeFileSync(path.join(tempDir, 'extra.md'), '# Extra');

    const sections = findSections(tempDir, ['intro.md', 'methods.md']);
    assert.deepStrictEqual(sections, ['intro.md', 'methods.md']);
  });

  it('should warn for missing section files', () => {
    fs.writeFileSync(path.join(tempDir, 'intro.md'), '# Intro');

    // This should not throw but skip missing files
    const sections = findSections(tempDir, ['intro.md', 'nonexistent.md']);
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0], 'intro.md');
  });

  it('should auto-detect .md files when no config sections', () => {
    fs.writeFileSync(path.join(tempDir, 'alpha.md'), '# Alpha');
    fs.writeFileSync(path.join(tempDir, 'beta.md'), '# Beta');
    fs.writeFileSync(path.join(tempDir, 'paper.md'), '# Paper'); // Should be excluded

    const sections = findSections(tempDir, []);
    assert.ok(sections.includes('alpha.md'));
    assert.ok(sections.includes('beta.md'));
    assert.ok(!sections.includes('paper.md'));
  });

  it('should exclude special files', () => {
    fs.writeFileSync(path.join(tempDir, 'readme.md'), '# README');
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude');
    fs.writeFileSync(path.join(tempDir, 'content.md'), '# Content');

    const sections = findSections(tempDir, []);
    assert.ok(!sections.includes('readme.md'));
    assert.ok(!sections.includes('CLAUDE.md'));
    assert.ok(sections.includes('content.md'));
  });

  it('should read from sections.yaml if exists', () => {
    fs.writeFileSync(path.join(tempDir, 'sections.yaml'), `
sections:
  methods.md:
    order: 2
  intro.md:
    order: 1
`);
    fs.writeFileSync(path.join(tempDir, 'intro.md'), '# Intro');
    fs.writeFileSync(path.join(tempDir, 'methods.md'), '# Methods');

    const sections = findSections(tempDir, []);
    assert.strictEqual(sections[0], 'intro.md');
    assert.strictEqual(sections[1], 'methods.md');
  });
});

describe('combineSections', () => {
  it('should combine section files into paper.md', () => {
    fs.writeFileSync(path.join(tempDir, 'intro.md'), '# Introduction\n\nText here.');
    fs.writeFileSync(path.join(tempDir, 'methods.md'), '# Methods\n\nMore text.');

    const config = {
      ...DEFAULT_CONFIG,
      title: 'Test Paper',
      sections: ['intro.md', 'methods.md'],
    };

    const paperPath = combineSections(tempDir, config);

    assert.strictEqual(paperPath, path.join(tempDir, 'paper.md'));
    assert.ok(fs.existsSync(paperPath));

    const content = fs.readFileSync(paperPath, 'utf-8');
    assert.ok(content.includes('title: Test Paper'));
    assert.ok(content.includes('# Introduction'));
    assert.ok(content.includes('# Methods'));
  });

  it('should strip frontmatter from section files', () => {
    fs.writeFileSync(path.join(tempDir, 'intro.md'), `---
title: Section Title
---

# Introduction

Content here.`);

    const config = {
      ...DEFAULT_CONFIG,
      sections: ['intro.md'],
    };

    const paperPath = combineSections(tempDir, config);
    const content = fs.readFileSync(paperPath, 'utf-8');

    // Should not have nested frontmatter
    const matches = content.match(/---/g);
    assert.strictEqual(matches.length, 2); // Only the main frontmatter
  });

  it('should throw if no sections found', () => {
    const config = { ...DEFAULT_CONFIG, sections: [] };

    assert.throws(() => combineSections(tempDir, config), /No section files found/);
  });

  it('should include bibliography in frontmatter', () => {
    fs.writeFileSync(path.join(tempDir, 'content.md'), '# Content');

    const config = {
      ...DEFAULT_CONFIG,
      sections: ['content.md'],
      bibliography: 'refs.bib',
    };

    const paperPath = combineSections(tempDir, config);
    const content = fs.readFileSync(paperPath, 'utf-8');

    assert.ok(content.includes('bibliography: refs.bib'));
  });
});

describe('buildPandocArgs', () => {
  it('should build PDF arguments', () => {
    const args = buildPandocArgs('pdf', DEFAULT_CONFIG, 'output.pdf');

    assert.ok(args.includes('-t'));
    assert.ok(args.includes('pdf'));
    assert.ok(args.includes('-o'));
    assert.ok(args.includes('output.pdf'));
  });

  it('should build DOCX arguments', () => {
    const args = buildPandocArgs('docx', DEFAULT_CONFIG, 'output.docx');

    assert.ok(args.includes('-t'));
    assert.ok(args.includes('docx'));
  });

  it('should build TEX arguments with standalone', () => {
    const args = buildPandocArgs('tex', DEFAULT_CONFIG, 'output.tex');

    assert.ok(args.includes('-t'));
    assert.ok(args.includes('latex'));
    assert.ok(args.includes('-s')); // standalone
  });

  it('should include bibliography flag when configured', () => {
    const config = { ...DEFAULT_CONFIG, bibliography: 'refs.bib' };
    const args = buildPandocArgs('pdf', config, 'output.pdf');

    assert.ok(args.includes('--citeproc'));
  });

  it('should include PDF-specific variables', () => {
    const args = buildPandocArgs('pdf', DEFAULT_CONFIG, 'output.pdf');

    assert.ok(args.some(a => a.includes('documentclass=article')));
    assert.ok(args.some(a => a.includes('fontsize=12pt')));
    assert.ok(args.some(a => a.includes('geometry:')));
  });

  it('should include reference doc for DOCX when configured', () => {
    const config = {
      ...DEFAULT_CONFIG,
      docx: { ...DEFAULT_CONFIG.docx, reference: 'template.docx' },
    };
    const args = buildPandocArgs('docx', config, 'output.docx');

    assert.ok(args.includes('--reference-doc'));
    assert.ok(args.includes('template.docx'));
  });

  it('should include TOC when configured', () => {
    const config = {
      ...DEFAULT_CONFIG,
      pdf: { ...DEFAULT_CONFIG.pdf, toc: true },
    };
    const args = buildPandocArgs('pdf', config, 'output.pdf');

    assert.ok(args.includes('--toc'));
  });

  it('should include number-sections when configured', () => {
    const config = {
      ...DEFAULT_CONFIG,
      pdf: { ...DEFAULT_CONFIG.pdf, numbersections: true },
    };
    const args = buildPandocArgs('pdf', config, 'output.pdf');

    assert.ok(args.includes('--number-sections'));
  });
});

describe('hasPandoc', () => {
  it('should return boolean', () => {
    const result = hasPandoc();
    assert.strictEqual(typeof result, 'boolean');
  });
});

describe('hasPandocCrossref', () => {
  it('should return boolean', () => {
    const result = hasPandocCrossref();
    assert.strictEqual(typeof result, 'boolean');
  });
});
