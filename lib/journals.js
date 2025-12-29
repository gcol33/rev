/**
 * Journal validation profiles
 * Check manuscripts against journal-specific requirements
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Journal requirement profiles
 * Based on publicly available author guidelines
 */
export const JOURNAL_PROFILES = {
  nature: {
    name: 'Nature',
    url: 'https://www.nature.com/nature/for-authors',
    requirements: {
      wordLimit: { main: 3000, abstract: 150, title: 90 },
      references: { max: 50, doiRequired: true },
      figures: { max: 6, combinedWithTables: true },
      sections: {
        required: ['Abstract', 'Introduction', 'Results', 'Discussion', 'Methods'],
        methodsPosition: 'end',
      },
      authors: { maxInitial: null, correspondingRequired: true },
    },
  },

  science: {
    name: 'Science',
    url: 'https://www.science.org/content/page/instructions-preparing-initial-manuscript',
    requirements: {
      wordLimit: { main: 2500, abstract: 125, title: 120 },
      references: { max: 40, doiRequired: true },
      figures: { max: 4, combinedWithTables: true },
      sections: {
        required: ['Abstract', 'Introduction', 'Results', 'Discussion'],
        supplementary: true,
      },
      authors: { maxInitial: null, correspondingRequired: true },
    },
  },

  'plos-one': {
    name: 'PLOS ONE',
    url: 'https://journals.plos.org/plosone/s/submission-guidelines',
    requirements: {
      wordLimit: { main: null, abstract: 300, title: 250 },
      references: { max: null, doiRequired: false },
      figures: { max: null, combinedWithTables: false },
      sections: {
        required: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
        methodsPosition: 'before-results',
      },
      authors: { maxInitial: null, correspondingRequired: true },
      dataAvailability: true,
    },
  },

  'pnas': {
    name: 'PNAS',
    url: 'https://www.pnas.org/author-center/submitting-your-manuscript',
    requirements: {
      wordLimit: { main: 4500, abstract: 250, title: null },
      references: { max: 50, doiRequired: true },
      figures: { max: 6, combinedWithTables: true },
      sections: {
        required: ['Abstract', 'Introduction', 'Results', 'Discussion'],
        significanceStatement: true,
      },
      authors: { maxInitial: null, correspondingRequired: true },
    },
  },

  'ecology-letters': {
    name: 'Ecology Letters',
    url: 'https://onlinelibrary.wiley.com/page/journal/14610248/homepage/forauthors.html',
    requirements: {
      wordLimit: { main: 5000, abstract: 150, title: null },
      references: { max: 50, doiRequired: true },
      figures: { max: 6, combinedWithTables: true },
      sections: {
        required: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
      },
      authors: { maxInitial: null, correspondingRequired: true },
      keywords: { min: 3, max: 10 },
    },
  },

  'ecological-applications': {
    name: 'Ecological Applications',
    url: 'https://esajournals.onlinelibrary.wiley.com/hub/journal/19395582/author-guidelines',
    requirements: {
      wordLimit: { main: 7000, abstract: 350, title: null },
      references: { max: null, doiRequired: true },
      figures: { max: null, combinedWithTables: false },
      sections: {
        required: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
      },
      dataAvailability: true,
    },
  },

  'molecular-ecology': {
    name: 'Molecular Ecology',
    url: 'https://onlinelibrary.wiley.com/page/journal/1365294x/homepage/forauthors.html',
    requirements: {
      wordLimit: { main: 8000, abstract: 250, title: null },
      references: { max: null, doiRequired: true },
      figures: { max: 8, combinedWithTables: false },
      sections: {
        required: ['Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
      },
      dataAvailability: true,
      keywords: { min: 4, max: 8 },
    },
  },

  'elife': {
    name: 'eLife',
    url: 'https://reviewer.elifesciences.org/author-guide/full',
    requirements: {
      wordLimit: { main: null, abstract: 150, title: null },
      references: { max: null, doiRequired: true },
      figures: { max: null, combinedWithTables: false },
      sections: {
        required: ['Abstract', 'Introduction', 'Results', 'Discussion', 'Methods'],
        methodsPosition: 'end',
      },
      impactStatement: true,
    },
  },
};

/**
 * List all available journal profiles
 * @returns {Array<{id: string, name: string, url: string}>}
 */
export function listJournals() {
  return Object.entries(JOURNAL_PROFILES).map(([id, profile]) => ({
    id,
    name: profile.name,
    url: profile.url,
  }));
}

/**
 * Get a specific journal profile
 * @param {string} journalId
 * @returns {Object|null}
 */
export function getJournalProfile(journalId) {
  const normalized = journalId.toLowerCase().replace(/\s+/g, '-');
  return JOURNAL_PROFILES[normalized] || null;
}

/**
 * Count words in text (excluding markdown syntax)
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  // Remove markdown syntax
  let clean = text
    .replace(/^---[\s\S]*?---/m, '') // YAML frontmatter
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/#+\s*/g, '') // Headers
    .replace(/\*\*|__/g, '') // Bold
    .replace(/\*|_/g, '') // Italic
    .replace(/`[^`]+`/g, '') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\{[^}]+\}/g, '') // CriticMarkup and attributes
    .replace(/@\w+:\w+/g, '') // Cross-references
    .replace(/@\w+/g, '') // Citations
    .replace(/\|[^|]+\|/g, ' ') // Table cells
    .replace(/[-=]{3,}/g, '') // Horizontal rules
    .replace(/\n+/g, ' ') // Newlines
    .replace(/\s+/g, ' ') // Multiple spaces
    .trim();

  return clean.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extract abstract from markdown
 * @param {string} text
 * @returns {string|null}
 */
function extractAbstract(text) {
  // Try to find abstract section
  const patterns = [
    /^#+\s*Abstract\s*\n([\s\S]*?)(?=^#+|\Z)/mi,
    /^Abstract[:\s]*\n([\s\S]*?)(?=^#+|\n\n)/mi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract title from markdown
 * @param {string} text
 * @returns {string|null}
 */
function extractTitle(text) {
  // Try YAML frontmatter
  const yamlMatch = text.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?[\s\S]*?\n---/m);
  if (yamlMatch) {
    return yamlMatch[1].trim();
  }

  // Try first H1
  const h1Match = text.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Extract sections from markdown
 * @param {string} text
 * @returns {string[]}
 */
function extractSections(text) {
  const sections = [];
  const headerPattern = /^#+\s+(.+)$/gm;
  let match;

  while ((match = headerPattern.exec(text)) !== null) {
    sections.push(match[1].trim());
  }

  return sections;
}

/**
 * Count figures in markdown
 * @param {string} text
 * @returns {number}
 */
function countFigures(text) {
  // Count images with figure captions
  const figurePattern = /!\[.*?\]\(.*?\)(\{#fig:[^}]+\})?/g;
  const matches = text.match(figurePattern) || [];
  return matches.length;
}

/**
 * Count tables in markdown
 * @param {string} text
 * @returns {number}
 */
function countTables(text) {
  // Count tables (lines starting with |)
  const tablePattern = /^\|[^|]+\|/gm;
  const matches = text.match(tablePattern) || [];
  // Divide by approximate rows per table
  return Math.ceil(matches.length / 5);
}

/**
 * Count references/citations in markdown
 * @param {string} text
 * @returns {number}
 */
function countReferences(text) {
  // Count unique citation keys
  const citationPattern = /@(\w+)/g;
  const citations = new Set();
  let match;

  while ((match = citationPattern.exec(text)) !== null) {
    // Exclude cross-refs like @fig:label
    if (!match[0].includes(':')) {
      citations.add(match[1]);
    }
  }

  return citations.size;
}

/**
 * Validate manuscript against journal requirements
 * @param {string} text - Markdown content
 * @param {string} journalId - Journal profile ID
 * @returns {{valid: boolean, errors: string[], warnings: string[], stats: Object}}
 */
export function validateManuscript(text, journalId) {
  const profile = getJournalProfile(journalId);

  if (!profile) {
    return {
      valid: false,
      errors: [`Unknown journal: ${journalId}`],
      warnings: [],
      stats: null,
    };
  }

  const req = profile.requirements;
  const errors = [];
  const warnings = [];

  // Extract content
  const abstract = extractAbstract(text);
  const title = extractTitle(text);
  const sections = extractSections(text);
  const mainWordCount = countWords(text);
  const figureCount = countFigures(text);
  const tableCount = countTables(text);
  const refCount = countReferences(text);

  const stats = {
    wordCount: mainWordCount,
    abstractWords: abstract ? countWords(abstract) : 0,
    titleChars: title ? title.length : 0,
    figures: figureCount,
    tables: tableCount,
    references: refCount,
    sections: sections.length,
  };

  // Word limits
  if (req.wordLimit) {
    if (req.wordLimit.main && mainWordCount > req.wordLimit.main) {
      errors.push(`Main text exceeds ${req.wordLimit.main} words (current: ${mainWordCount})`);
    }
    if (req.wordLimit.abstract && abstract) {
      const absWords = countWords(abstract);
      if (absWords > req.wordLimit.abstract) {
        errors.push(`Abstract exceeds ${req.wordLimit.abstract} words (current: ${absWords})`);
      }
    }
    if (req.wordLimit.title && title) {
      if (title.length > req.wordLimit.title) {
        warnings.push(`Title exceeds ${req.wordLimit.title} characters (current: ${title.length})`);
      }
    }
  }

  // References
  if (req.references) {
    if (req.references.max && refCount > req.references.max) {
      errors.push(`References exceed ${req.references.max} (current: ${refCount})`);
    }
    if (req.references.doiRequired) {
      warnings.push('DOI required for all references - run "rev doi check" to verify');
    }
  }

  // Figures/tables
  if (req.figures) {
    const totalVisual = req.figures.combinedWithTables
      ? figureCount + tableCount
      : figureCount;
    const label = req.figures.combinedWithTables ? 'figures + tables' : 'figures';

    if (req.figures.max && totalVisual > req.figures.max) {
      errors.push(`${label} exceed ${req.figures.max} (current: ${totalVisual})`);
    }
  }

  // Required sections
  if (req.sections?.required) {
    for (const reqSection of req.sections.required) {
      const found = sections.some(s =>
        s.toLowerCase().includes(reqSection.toLowerCase())
      );
      if (!found) {
        warnings.push(`Missing required section: ${reqSection}`);
      }
    }
  }

  // Data availability
  if (req.dataAvailability) {
    const hasDataStatement = sections.some(s =>
      s.toLowerCase().includes('data') ||
      text.toLowerCase().includes('data availability') ||
      text.toLowerCase().includes('data statement')
    );
    if (!hasDataStatement) {
      warnings.push('Data availability statement may be required');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
    journal: profile.name,
    url: profile.url,
  };
}

/**
 * Validate multiple files against journal requirements
 * @param {string[]} files - Markdown file paths
 * @param {string} journalId - Journal profile ID
 * @returns {Object}
 */
export function validateProject(files, journalId) {
  // Combine all file contents
  const combined = files
    .filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf-8'))
    .join('\n\n');

  return validateManuscript(combined, journalId);
}
