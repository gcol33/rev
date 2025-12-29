/**
 * Tests for trackchanges.js
 * Tests XML generation for Word track changes
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import {
  prepareForTrackChanges,
  applyTrackChangesToDocx,
} from '../lib/trackchanges.js';

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrev-tc-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Create a minimal valid DOCX for testing
 */
function createTestDocx(content = 'Test content') {
  const zip = new AdmZip();

  zip.addFile('[Content_Types].xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`));

  zip.addFile('_rels/.rels', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`));

  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${content}</w:t></w:r></w:p>
  </w:body>
</w:document>`));

  zip.addFile('word/settings.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
</w:settings>`));

  const docxPath = path.join(tempDir, 'test.docx');
  zip.writeZip(docxPath);
  return docxPath;
}

describe('prepareForTrackChanges', () => {
  it('should replace insertions with markers', () => {
    const text = 'Hello {++world++} there';
    const { text: result, markers } = prepareForTrackChanges(text);

    assert.ok(result.includes('{{TC_'));
    assert.ok(!result.includes('{++'));
    assert.strictEqual(markers.length, 1);
    assert.strictEqual(markers[0].type, 'insert');
    assert.strictEqual(markers[0].content, 'world');
  });

  it('should replace deletions with markers', () => {
    const text = 'Hello {--old--} there';
    const { text: result, markers } = prepareForTrackChanges(text);

    assert.ok(result.includes('{{TC_'));
    assert.strictEqual(markers.length, 1);
    assert.strictEqual(markers[0].type, 'delete');
    assert.strictEqual(markers[0].content, 'old');
  });

  it('should replace substitutions with markers', () => {
    const text = 'Hello {~~old~>new~~} there';
    const { text: result, markers } = prepareForTrackChanges(text);

    assert.ok(result.includes('{{TC_'));
    assert.strictEqual(markers.length, 1);
    assert.strictEqual(markers[0].type, 'substitute');
    assert.strictEqual(markers[0].content, 'old');
    assert.strictEqual(markers[0].replacement, 'new');
  });

  it('should handle multiple annotations', () => {
    const text = 'The {++quick++} brown {--slow--} fox {~~jumps~>leaps~~} over.';
    const { text: result, markers } = prepareForTrackChanges(text);

    assert.strictEqual(markers.length, 3);
    assert.ok(markers.some(m => m.type === 'insert'));
    assert.ok(markers.some(m => m.type === 'delete'));
    assert.ok(markers.some(m => m.type === 'substitute'));
  });

  it('should preserve comments', () => {
    const text = 'Hello {>>Author: comment<<} world';
    const { text: result, markers } = prepareForTrackChanges(text);

    // Comments should also be converted to markers
    assert.ok(markers.some(m => m.type === 'comment'));
  });

  it('should assign default author', () => {
    const text = 'Hello {++world++}';
    const { markers } = prepareForTrackChanges(text);

    assert.strictEqual(markers[0].author, 'Reviewer');
  });

  it('should return empty markers for text without annotations', () => {
    const text = 'Plain text without annotations';
    const { text: result, markers } = prepareForTrackChanges(text);

    assert.strictEqual(result, text);
    assert.strictEqual(markers.length, 0);
  });
});

describe('applyTrackChangesToDocx', () => {
  it('should replace markers with track changes XML', async () => {
    const docxPath = createTestDocx('Hello {{TC_0}} there');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [
      { id: 0, type: 'insert', content: 'world', author: 'Test Author' },
    ];

    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(outputPath));

    // Check the output contains track changes markup
    const zip = new AdmZip(outputPath);
    const documentXml = zip.readAsText('word/document.xml');
    assert.ok(documentXml.includes('w:ins'));
    assert.ok(documentXml.includes('Test Author'));
  });

  it('should handle deletions', async () => {
    const docxPath = createTestDocx('Hello {{TC_0}} there');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [
      { id: 0, type: 'delete', content: 'removed', author: 'Reviewer' },
    ];

    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);

    const zip = new AdmZip(outputPath);
    const documentXml = zip.readAsText('word/document.xml');
    assert.ok(documentXml.includes('w:del'));
    assert.ok(documentXml.includes('w:delText'));
  });

  it('should handle substitutions', async () => {
    const docxPath = createTestDocx('Hello {{TC_0}} there');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [
      { id: 0, type: 'substitute', content: 'old', replacement: 'new', author: 'Reviewer' },
    ];

    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);

    const zip = new AdmZip(outputPath);
    const documentXml = zip.readAsText('word/document.xml');
    // Substitution should have both deletion and insertion
    assert.ok(documentXml.includes('w:del'));
    assert.ok(documentXml.includes('w:ins'));
  });

  it('should enable track revisions in settings', async () => {
    const docxPath = createTestDocx('Content');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [];
    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);

    const zip = new AdmZip(outputPath);
    const settingsXml = zip.readAsText('word/settings.xml');
    assert.ok(settingsXml.includes('w:trackRevisions'));
  });

  it('should return error for non-existent file', async () => {
    const result = await applyTrackChangesToDocx('/nonexistent.docx', [], 'out.docx');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('not found'));
  });

  it('should return error for invalid DOCX', async () => {
    const fakePath = path.join(tempDir, 'fake.docx');
    fs.writeFileSync(fakePath, 'not a zip file');

    const result = await applyTrackChangesToDocx(fakePath, [], path.join(tempDir, 'out.docx'));

    assert.strictEqual(result.success, false);
  });

  it('should handle multiple markers', async () => {
    const docxPath = createTestDocx('A {{TC_0}} B {{TC_1}} C');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [
      { id: 0, type: 'insert', content: 'first', author: 'R1' },
      { id: 1, type: 'delete', content: 'second', author: 'R2' },
    ];

    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);

    const zip = new AdmZip(outputPath);
    const documentXml = zip.readAsText('word/document.xml');
    assert.ok(documentXml.includes('w:ins'));
    assert.ok(documentXml.includes('w:del'));
  });

  it('should escape XML special characters', async () => {
    const docxPath = createTestDocx('Hello {{TC_0}}');
    const outputPath = path.join(tempDir, 'output.docx');

    const markers = [
      { id: 0, type: 'insert', content: '<tag> & "quotes"', author: "O'Brien" },
    ];

    const result = await applyTrackChangesToDocx(docxPath, markers, outputPath);

    assert.strictEqual(result.success, true);

    const zip = new AdmZip(outputPath);
    const documentXml = zip.readAsText('word/document.xml');
    // Content should be XML-escaped
    assert.ok(documentXml.includes('&lt;tag&gt;'));
    assert.ok(documentXml.includes('&amp;'));
  });
});
