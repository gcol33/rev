/**
 * Multi-reviewer merge utilities
 * Combine feedback from multiple Word documents with conflict detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { diffWords } from 'diff';
import { extractFromWord, extractWordComments } from './import.js';

/**
 * Represents a change from a reviewer
 * @typedef {Object} ReviewerChange
 * @property {string} reviewer - Reviewer name/identifier
 * @property {string} type - 'insert' | 'delete' | 'replace'
 * @property {number} start - Start position in original text
 * @property {number} end - End position in original text
 * @property {string} oldText - Original text (for delete/replace)
 * @property {string} newText - New text (for insert/replace)
 */

/**
 * Represents a conflict between reviewers
 * @typedef {Object} Conflict
 * @property {number} start - Start position in original
 * @property {number} end - End position in original
 * @property {string} original - Original text
 * @property {ReviewerChange[]} changes - Conflicting changes from different reviewers
 */

/**
 * Extract changes from a Word document compared to original
 * @param {string} originalText - Original markdown text
 * @param {string} wordText - Text extracted from Word
 * @param {string} reviewer - Reviewer identifier
 * @returns {ReviewerChange[]}
 */
export function extractChanges(originalText, wordText, reviewer) {
  const changes = [];
  const diffs = diffWords(originalText, wordText);

  let originalPos = 0;
  let i = 0;

  while (i < diffs.length) {
    const part = diffs[i];

    if (!part.added && !part.removed) {
      // Unchanged
      originalPos += part.value.length;
      i++;
    } else if (part.removed && diffs[i + 1]?.added) {
      // Replacement: removed followed by added
      changes.push({
        reviewer,
        type: 'replace',
        start: originalPos,
        end: originalPos + part.value.length,
        oldText: part.value,
        newText: diffs[i + 1].value,
      });
      originalPos += part.value.length;
      i += 2;
    } else if (part.removed) {
      // Pure deletion
      changes.push({
        reviewer,
        type: 'delete',
        start: originalPos,
        end: originalPos + part.value.length,
        oldText: part.value,
        newText: '',
      });
      originalPos += part.value.length;
      i++;
    } else if (part.added) {
      // Pure insertion
      changes.push({
        reviewer,
        type: 'insert',
        start: originalPos,
        end: originalPos,
        oldText: '',
        newText: part.value,
      });
      i++;
    }
  }

  return changes;
}

/**
 * Check if two changes overlap
 * @param {ReviewerChange} a
 * @param {ReviewerChange} b
 * @returns {boolean}
 */
function changesOverlap(a, b) {
  // Insertions at same point conflict
  if (a.type === 'insert' && b.type === 'insert' && a.start === b.start) {
    return a.newText !== b.newText; // Same insertion is not a conflict
  }

  // Check range overlap
  const aStart = a.start;
  const aEnd = a.type === 'insert' ? a.start : a.end;
  const bStart = b.start;
  const bEnd = b.type === 'insert' ? b.start : b.end;

  // Ranges overlap if neither ends before the other starts
  if (aEnd <= bStart || bEnd <= aStart) {
    return false;
  }

  // They overlap - but is it a conflict?
  // Same change from different reviewers is not a conflict
  if (a.type === b.type && a.oldText === b.oldText && a.newText === b.newText) {
    return false;
  }

  return true;
}

/**
 * Detect conflicts between changes from multiple reviewers
 * @param {ReviewerChange[][]} allChanges - Array of change arrays, one per reviewer
 * @returns {{conflicts: Conflict[], nonConflicting: ReviewerChange[]}}
 */
export function detectConflicts(allChanges) {
  // Flatten and sort all changes by position
  const flat = allChanges.flat().sort((a, b) => a.start - b.start || a.end - b.end);

  const conflicts = [];
  const nonConflicting = [];
  const usedIndices = new Set();

  for (let i = 0; i < flat.length; i++) {
    if (usedIndices.has(i)) continue;

    const change = flat[i];
    const conflictingChanges = [change];

    // Find all changes that conflict with this one
    for (let j = i + 1; j < flat.length; j++) {
      if (usedIndices.has(j)) continue;

      const other = flat[j];

      // Stop if we're past the range
      if (other.start > change.end && change.type !== 'insert') break;

      if (changesOverlap(change, other)) {
        conflictingChanges.push(other);
        usedIndices.add(j);
      }
    }

    if (conflictingChanges.length > 1) {
      // Multiple reviewers changed the same region
      const start = Math.min(...conflictingChanges.map(c => c.start));
      const end = Math.max(...conflictingChanges.map(c => c.end));

      conflicts.push({
        start,
        end,
        original: conflictingChanges[0].oldText || '',
        changes: conflictingChanges,
      });
      usedIndices.add(i);
    } else {
      // No conflict
      nonConflicting.push(change);
      usedIndices.add(i);
    }
  }

  // Deduplicate identical non-conflicting changes
  const seen = new Map();
  const dedupedNonConflicting = [];

  for (const change of nonConflicting) {
    const key = `${change.start}:${change.end}:${change.type}:${change.newText}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      dedupedNonConflicting.push(change);
    }
  }

  return { conflicts, nonConflicting: dedupedNonConflicting };
}

/**
 * Apply non-conflicting changes to text
 * @param {string} originalText
 * @param {ReviewerChange[]} changes - Must be sorted by position
 * @returns {string}
 */
export function applyChanges(originalText, changes) {
  // Sort by position descending to apply from end to start
  const sorted = [...changes].sort((a, b) => b.start - a.start);

  let result = originalText;

  for (const change of sorted) {
    if (change.type === 'insert') {
      result = result.slice(0, change.start) + change.newText + result.slice(change.start);
    } else if (change.type === 'delete') {
      result = result.slice(0, change.start) + result.slice(change.end);
    } else if (change.type === 'replace') {
      result = result.slice(0, change.start) + change.newText + result.slice(change.end);
    }
  }

  return result;
}

/**
 * Apply changes as CriticMarkup annotations
 * @param {string} originalText
 * @param {ReviewerChange[]} changes
 * @returns {string}
 */
export function applyChangesAsAnnotations(originalText, changes) {
  const sorted = [...changes].sort((a, b) => b.start - a.start);

  let result = originalText;

  for (const change of sorted) {
    const reviewer = change.reviewer;

    if (change.type === 'insert') {
      const annotation = `{++${change.newText}++}`;
      result = result.slice(0, change.start) + annotation + result.slice(change.start);
    } else if (change.type === 'delete') {
      const annotation = `{--${change.oldText}--}`;
      result = result.slice(0, change.start) + annotation + result.slice(change.end);
    } else if (change.type === 'replace') {
      const annotation = `{~~${change.oldText}~>${change.newText}~~}`;
      result = result.slice(0, change.start) + annotation + result.slice(change.end);
    }
  }

  return result;
}

/**
 * Format a conflict for display
 * @param {Conflict} conflict
 * @param {string} originalText
 * @returns {string}
 */
export function formatConflict(conflict, originalText) {
  const lines = [];
  const context = 30;

  // Show context
  const beforeStart = Math.max(0, conflict.start - context);
  const afterEnd = Math.min(originalText.length, conflict.end + context);

  const before = originalText.slice(beforeStart, conflict.start);
  const original = originalText.slice(conflict.start, conflict.end);
  const after = originalText.slice(conflict.end, afterEnd);

  lines.push(`Context: ...${before}[CONFLICT]${after}...`);
  lines.push(`Original: "${original || '(insertion point)'}"`);
  lines.push('');
  lines.push('Options:');

  conflict.changes.forEach((change, i) => {
    const label = change.type === 'insert'
      ? `Insert: "${change.newText}"`
      : change.type === 'delete'
        ? `Delete: "${change.oldText}"`
        : `Replace "${change.oldText}" → "${change.newText}"`;
    lines.push(`  ${i + 1}. [${change.reviewer}] ${label}`);
  });

  return lines.join('\n');
}

/**
 * Merge multiple Word documents against an original
 * @param {string} originalPath - Path to original markdown
 * @param {Array<{path: string, name: string}>} reviewerDocs - Reviewer Word docs
 * @param {Object} options
 * @returns {Promise<{merged: string, conflicts: Conflict[], stats: Object}>}
 */
export async function mergeReviewerDocs(originalPath, reviewerDocs, options = {}) {
  const { autoResolve = false } = options;

  if (!fs.existsSync(originalPath)) {
    throw new Error(`Original file not found: ${originalPath}`);
  }

  const originalText = fs.readFileSync(originalPath, 'utf-8');

  // Extract changes from each reviewer
  const allChanges = [];
  const allComments = [];

  for (const doc of reviewerDocs) {
    if (!fs.existsSync(doc.path)) {
      throw new Error(`Reviewer file not found: ${doc.path}`);
    }

    const { text: wordText } = await extractFromWord(doc.path);
    const changes = extractChanges(originalText, wordText, doc.name);
    allChanges.push(changes);

    // Also extract comments
    try {
      const comments = await extractWordComments(doc.path);
      allComments.push(...comments.map(c => ({ ...c, reviewer: doc.name })));
    } catch {
      // Comments extraction failed, continue without
    }
  }

  // Detect conflicts
  const { conflicts, nonConflicting } = detectConflicts(allChanges);

  // Apply non-conflicting changes as annotations
  let merged = applyChangesAsAnnotations(originalText, nonConflicting);

  // Add comments
  for (const comment of allComments) {
    // Append comments at the end for now (position tracking is complex)
    merged += `\n{>>${comment.reviewer}: ${comment.text}<<}`;
  }

  const stats = {
    reviewers: reviewerDocs.length,
    totalChanges: allChanges.flat().length,
    nonConflicting: nonConflicting.length,
    conflicts: conflicts.length,
    comments: allComments.length,
  };

  return { merged, conflicts, stats, originalText };
}

/**
 * Resolve a conflict by choosing one option
 * @param {string} text - Current merged text
 * @param {Conflict} conflict
 * @param {number} choice - Index of chosen change (0-based)
 * @param {string} originalText - Original text for position reference
 * @returns {string}
 */
export function resolveConflict(text, conflict, choice, originalText) {
  const chosen = conflict.changes[choice];

  // Find the conflict region in the current text
  // This is simplified - real implementation would track positions
  const annotation = chosen.type === 'insert'
    ? `{++${chosen.newText}++}`
    : chosen.type === 'delete'
      ? `{--${chosen.oldText}--}`
      : `{~~${chosen.oldText}~>${chosen.newText}~~}`;

  // For now, append resolved conflicts at marker position
  // A more sophisticated approach would track exact positions
  return text + `\n<!-- Resolved: ${annotation} -->`;
}
