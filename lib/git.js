/**
 * Git integration utilities
 * Compare sections against git history
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { diffWords } from 'diff';

/**
 * Check if current directory is a git repository
 * @returns {boolean}
 */
export function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git branch
 * @returns {string|null}
 */
export function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/**
 * Get the default branch (main or master)
 * @returns {string}
 */
export function getDefaultBranch() {
  try {
    // Try to get the remote default branch
    const remote = execSync('git remote show origin', { stdio: 'pipe' })
      .toString();
    const match = remote.match(/HEAD branch:\s*(\S+)/);
    if (match) return match[1];
  } catch {
    // Fall through
  }

  // Check if main or master exists
  try {
    execSync('git rev-parse --verify main', { stdio: 'pipe' });
    return 'main';
  } catch {
    try {
      execSync('git rev-parse --verify master', { stdio: 'pipe' });
      return 'master';
    } catch {
      return 'main'; // Default fallback
    }
  }
}

/**
 * Get file content from a specific git ref
 * @param {string} filePath
 * @param {string} ref - Git reference (branch, tag, commit)
 * @returns {string|null}
 */
export function getFileAtRef(filePath, ref) {
  try {
    return execSync(`git show ${ref}:${filePath}`, { stdio: 'pipe' }).toString();
  } catch {
    return null; // File doesn't exist at that ref
  }
}

/**
 * Get list of changed files between refs
 * @param {string} fromRef
 * @param {string} toRef - Default: HEAD
 * @returns {Array<{file: string, status: string}>}
 */
export function getChangedFiles(fromRef, toRef = 'HEAD') {
  try {
    const output = execSync(`git diff --name-status ${fromRef}..${toRef}`, { stdio: 'pipe' })
      .toString()
      .trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [status, file] = line.split('\t');
      return {
        file,
        status: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get commit history for a file
 * @param {string} filePath
 * @param {number} limit
 * @returns {Array<{hash: string, date: string, message: string}>}
 */
export function getFileHistory(filePath, limit = 10) {
  try {
    const output = execSync(
      `git log --format="%h|%ci|%s" -n ${limit} -- "${filePath}"`,
      { stdio: 'pipe' }
    ).toString().trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });
  } catch {
    return [];
  }
}

/**
 * Compare file content between two refs
 * @param {string} filePath
 * @param {string} fromRef
 * @param {string} toRef
 * @returns {{added: number, removed: number, changes: Array}}
 */
export function compareFileVersions(filePath, fromRef, toRef = 'HEAD') {
  const oldContent = getFileAtRef(filePath, fromRef) || '';
  const newContent = toRef === 'HEAD'
    ? fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
    : getFileAtRef(filePath, toRef) || '';

  const diffs = diffWords(oldContent, newContent);

  let added = 0;
  let removed = 0;
  const changes = [];

  for (const part of diffs) {
    if (part.added) {
      added += part.value.split(/\s+/).filter(w => w).length;
      changes.push({ type: 'add', text: part.value });
    } else if (part.removed) {
      removed += part.value.split(/\s+/).filter(w => w).length;
      changes.push({ type: 'remove', text: part.value });
    }
  }

  return { added, removed, changes };
}

/**
 * Get word count difference between refs
 * @param {string[]} files
 * @param {string} fromRef
 * @param {string} toRef
 * @returns {{total: {added: number, removed: number}, byFile: Object}}
 */
export function getWordCountDiff(files, fromRef, toRef = 'HEAD') {
  let totalAdded = 0;
  let totalRemoved = 0;
  const byFile = {};

  for (const file of files) {
    const { added, removed } = compareFileVersions(file, fromRef, toRef);
    totalAdded += added;
    totalRemoved += removed;
    byFile[file] = { added, removed };
  }

  return {
    total: { added: totalAdded, removed: totalRemoved },
    byFile,
  };
}

/**
 * Get recent commits
 * @param {number} limit
 * @returns {Array<{hash: string, date: string, message: string, author: string}>}
 */
export function getRecentCommits(limit = 10) {
  try {
    const output = execSync(
      `git log --format="%h|%ci|%an|%s" -n ${limit}`,
      { stdio: 'pipe' }
    ).toString().trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [hash, date, author, message] = line.split('|');
      return { hash, date, author, message };
    });
  } catch {
    return [];
  }
}

/**
 * Check if there are uncommitted changes
 * @returns {boolean}
 */
export function hasUncommittedChanges() {
  try {
    const output = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get tags
 * @returns {string[]}
 */
export function getTags() {
  try {
    return execSync('git tag --sort=-creatordate', { stdio: 'pipe' })
      .toString()
      .trim()
      .split('\n')
      .filter(t => t);
  } catch {
    return [];
  }
}

/**
 * Get blame information for a file
 * Returns author and commit info for each line
 * @param {string} filePath
 * @returns {Array<{line: number, author: string, date: string, hash: string, content: string}>}
 */
export function getFileBlame(filePath) {
  try {
    const output = execSync(
      `git blame --line-porcelain "${filePath}"`,
      { stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 }
    ).toString();

    const lines = output.split('\n');
    const result = [];
    let current = {};
    let lineNumber = 0;

    for (const line of lines) {
      if (/^[0-9a-f]{40}/.test(line)) {
        // New blame entry: hash original-line final-line [count]
        const parts = line.split(' ');
        current.hash = parts[0].slice(0, 7);
        lineNumber = parseInt(parts[2], 10);
      } else if (line.startsWith('author ')) {
        current.author = line.slice(7);
      } else if (line.startsWith('author-time ')) {
        const timestamp = parseInt(line.slice(12), 10);
        current.date = new Date(timestamp * 1000).toISOString().slice(0, 10);
      } else if (line.startsWith('\t')) {
        // Actual content line (prefixed with tab)
        current.content = line.slice(1);
        current.line = lineNumber;
        result.push({ ...current });
        current = {};
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Get author statistics for a file
 * @param {string} filePath
 * @returns {Object<string, {lines: number, percentage: number}>}
 */
export function getAuthorStats(filePath) {
  const blame = getFileBlame(filePath);
  if (blame.length === 0) return {};

  const counts = {};
  for (const entry of blame) {
    counts[entry.author] = (counts[entry.author] || 0) + 1;
  }

  const total = blame.length;
  const stats = {};
  for (const [author, lines] of Object.entries(counts)) {
    stats[author] = {
      lines,
      percentage: Math.round((lines / total) * 100),
    };
  }

  return stats;
}

/**
 * Get contributors across multiple files
 * @param {string[]} files
 * @returns {Object<string, {lines: number, files: number}>}
 */
export function getContributors(files) {
  const contributors = {};

  for (const file of files) {
    const stats = getAuthorStats(file);
    for (const [author, data] of Object.entries(stats)) {
      if (!contributors[author]) {
        contributors[author] = { lines: 0, files: 0 };
      }
      contributors[author].lines += data.lines;
      contributors[author].files += 1;
    }
  }

  return contributors;
}
