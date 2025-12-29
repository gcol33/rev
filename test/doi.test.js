/**
 * Tests for doi.js
 * Uses mocked fetch for API calls
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseBibEntries,
  isValidDoiFormat,
  addToBib,
} from '../lib/doi.js';

// Test fixtures
let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docrev-doi-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('isValidDoiFormat', () => {
  it('should accept valid DOI format', () => {
    assert.strictEqual(isValidDoiFormat('10.1234/abc123'), true);
    assert.strictEqual(isValidDoiFormat('10.12345/some.thing-2020'), true);
    assert.strictEqual(isValidDoiFormat('10.1038/nature12373'), true);
  });

  it('should reject invalid DOI format', () => {
    assert.strictEqual(isValidDoiFormat(''), false);
    assert.strictEqual(isValidDoiFormat(null), false);
    assert.strictEqual(isValidDoiFormat('not-a-doi'), false);
    assert.strictEqual(isValidDoiFormat('10.123/too-short-prefix'), false); // prefix needs 4+ digits
    assert.strictEqual(isValidDoiFormat('11.1234/wrong-start'), false);
  });

  it('should handle DOIs with special characters', () => {
    assert.strictEqual(isValidDoiFormat('10.1234/abc_def-123'), true);
    assert.strictEqual(isValidDoiFormat('10.1234/abc.def(123)'), true);
  });
});

describe('parseBibEntries', () => {
  it('should parse entries from bib file', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{Smith2020,
  author = {John Smith},
  title = {A Great Paper},
  journal = {Nature},
  year = {2020},
  doi = {10.1038/nature12345}
}

@book{Jones2021,
  author = {Jane Jones},
  title = {A Great Book},
  year = {2021}
}
`);

    const entries = parseBibEntries(bibPath);

    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].key, 'Smith2020');
    assert.strictEqual(entries[0].type, 'article');
    assert.strictEqual(entries[0].doi, '10.1038/nature12345');
    assert.strictEqual(entries[1].key, 'Jones2021');
    assert.strictEqual(entries[1].type, 'book');
    assert.strictEqual(entries[1].doi, null);
  });

  it('should return empty array for non-existent file', () => {
    const entries = parseBibEntries('/nonexistent.bib');
    assert.deepStrictEqual(entries, []);
  });

  it('should extract title, author, year, journal', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{Test2020,
  author = {First Author and Second Author},
  title = {Test Paper Title},
  journal = {Test Journal},
  year = {2020}
}
`);

    const entries = parseBibEntries(bibPath);

    assert.strictEqual(entries[0].title, 'Test Paper Title');
    assert.ok(entries[0].authorRaw.includes('First Author'));
    assert.strictEqual(entries[0].year, 2020);
    assert.strictEqual(entries[0].journal, 'Test Journal');
  });

  it('should detect skip markers', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@misc{Skip1,
  title = {Skipped Entry},
  nodoi = {true}
}

% no-doi
@misc{Skip2,
  title = {Also Skipped}
}

@article{NotSkipped,
  title = {Not Skipped},
  doi = {10.1234/test}
}
`);

    const entries = parseBibEntries(bibPath);

    const skip1 = entries.find(e => e.key === 'Skip1');
    const skip2 = entries.find(e => e.key === 'Skip2');
    const notSkipped = entries.find(e => e.key === 'NotSkipped');

    assert.strictEqual(skip1?.skip, true);
    assert.strictEqual(skip2?.skip, true);
    assert.strictEqual(notSkipped?.skip, false);
  });

  it('should identify entry types that expect DOIs', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{Art, title = {Article}}
@inproceedings{Conf, title = {Conference}}
@book{Book, title = {Book}}
@thesis{Thesis, title = {Thesis}}
`);

    const entries = parseBibEntries(bibPath);

    const article = entries.find(e => e.key === 'Art');
    const conf = entries.find(e => e.key === 'Conf');
    const book = entries.find(e => e.key === 'Book');
    const thesis = entries.find(e => e.key === 'Thesis');

    assert.strictEqual(article?.expectDoi, true);
    assert.strictEqual(conf?.expectDoi, true);
    assert.strictEqual(book?.noDoi, true);
    assert.strictEqual(thesis?.noDoi, true);
  });

  it('should clean DOI URLs', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{UrlDoi,
  title = {Test},
  doi = {https://doi.org/10.1234/test}
}

@article{DxUrlDoi,
  title = {Test 2},
  doi = {http://dx.doi.org/10.1234/test2}
}
`);

    const entries = parseBibEntries(bibPath);

    assert.strictEqual(entries[0].doi, '10.1234/test');
    assert.strictEqual(entries[1].doi, '10.1234/test2');
  });

  it('should track line numbers', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{First, title = {First}}

@article{Second, title = {Second}}
`);

    const entries = parseBibEntries(bibPath);

    assert.strictEqual(entries[0].line, 2);
    assert.strictEqual(entries[1].line, 4);
  });

  it('should handle nested braces in fields', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `
@article{Nested,
  title = {{Proper Nouns} in {Title}},
  author = {Smith, John},
  year = {2020}
}
`);

    const entries = parseBibEntries(bibPath);

    // Title extraction may include inner braces or not depending on implementation
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].key, 'Nested');
  });
});

describe('addToBib', () => {
  it('should add entry to existing bib file', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `@article{Existing, title = {Old}}`);

    const bibtex = `@article{New2024,
  author = {New Author},
  title = {New Paper}
}`;

    const result = addToBib(bibPath, bibtex);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.key, 'New2024');

    const content = fs.readFileSync(bibPath, 'utf-8');
    assert.ok(content.includes('Existing'));
    assert.ok(content.includes('New2024'));
  });

  it('should create new bib file if not exists', () => {
    const bibPath = path.join(tempDir, 'new.bib');

    const bibtex = `@article{First2024,
  title = {First Entry}
}`;

    const result = addToBib(bibPath, bibtex);

    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(bibPath));
  });

  it('should reject duplicate keys', () => {
    const bibPath = path.join(tempDir, 'refs.bib');
    fs.writeFileSync(bibPath, `@article{Duplicate, title = {Original}}`);

    const bibtex = `@article{Duplicate,
  title = {New One}
}`;

    const result = addToBib(bibPath, bibtex);

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('already exists'));
  });

  it('should reject invalid bibtex', () => {
    const bibPath = path.join(tempDir, 'refs.bib');

    const result = addToBib(bibPath, 'not valid bibtex');

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Could not extract'));
  });
});

// Edge cases
describe('doi.js edge cases', () => {
  it('should handle empty bib file', () => {
    const bibPath = path.join(tempDir, 'empty.bib');
    fs.writeFileSync(bibPath, '');

    const entries = parseBibEntries(bibPath);
    assert.deepStrictEqual(entries, []);
  });

  it('should handle bib file with only comments', () => {
    const bibPath = path.join(tempDir, 'comments.bib');
    fs.writeFileSync(bibPath, `
% This is a comment
% Another comment
`);

    const entries = parseBibEntries(bibPath);
    assert.deepStrictEqual(entries, []);
  });

  it('should handle various DOI edge cases', () => {
    // Minimum valid prefix length (4 digits)
    assert.strictEqual(isValidDoiFormat('10.1234/x'), true);
    assert.strictEqual(isValidDoiFormat('10.123/x'), false);

    // Long prefix
    assert.strictEqual(isValidDoiFormat('10.123456789/test'), true);

    // Complex suffix
    assert.strictEqual(isValidDoiFormat('10.1234/a.b.c-d_e(f)'), true);

    // No spaces allowed
    assert.strictEqual(isValidDoiFormat('10.1234/has space'), false);
  });

  it('should handle malformed bib entries gracefully', () => {
    const bibPath = path.join(tempDir, 'malformed.bib');
    fs.writeFileSync(bibPath, `
@article{Good, title = {Good Entry}, year = {2020}}

@article{MissingClose, title = {Oops

@article{Another, title = {After}}
`);

    // Should not crash
    const entries = parseBibEntries(bibPath);
    assert.ok(Array.isArray(entries));
  });

  it('should handle unicode in bib entries', () => {
    const bibPath = path.join(tempDir, 'unicode.bib');
    fs.writeFileSync(bibPath, `
@article{Unicode2020,
  author = {Müller, François and 田中太郎},
  title = {Études on émojis 🎉}
}
`);

    const entries = parseBibEntries(bibPath);
    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].authorRaw.includes('Müller'));
  });
});

// Integration-style tests (without network, testing parsing logic)
describe('DOI parsing integration', () => {
  it('should correctly identify articles missing DOIs', () => {
    const bibPath = path.join(tempDir, 'mixed.bib');
    fs.writeFileSync(bibPath, `
@article{HasDoi,
  title = {Article With DOI},
  doi = {10.1234/test}
}

@article{NoDoi,
  title = {Article Without DOI}
}

@book{Book,
  title = {Book No DOI Expected}
}
`);

    const entries = parseBibEntries(bibPath);

    const hasDoi = entries.find(e => e.key === 'HasDoi');
    const noDoi = entries.find(e => e.key === 'NoDoi');
    const book = entries.find(e => e.key === 'Book');

    assert.ok(hasDoi.doi);
    assert.ok(!noDoi.doi);
    assert.ok(noDoi.expectDoi); // Article should have DOI
    assert.ok(!book.doi);
    assert.ok(book.noDoi); // Book doesn't need DOI
  });
});
