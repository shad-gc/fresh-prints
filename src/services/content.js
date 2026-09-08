import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo-reviewed content, replacing the Publisher's Desk UI.
 *
 * desk.json lives in content/ and ships inside the image, so "editing"
 * it is a pull request — keeping the standing rule that no model writes
 * content at runtime and nothing reaches the paper without a human
 * approving it.
 *
 * The file is static for the life of the container, so reads are cached.
 * The loader never throws: a broken file logs loudly and degrades to
 * the same empty state the desk-backed version had.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../../content');

/** Cert shown when content/desk.json doesn't name one. */

let deskCache;

function readJson(name) {
  const file = path.join(CONTENT_DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

/** { current_class, calendar_filter, grades: [{assignment, score}, ...] } */
export function getDeskContent() {
  if (deskCache !== undefined) return deskCache;
  try {
    const data = readJson('desk.json');
    deskCache = {
      current_class:
        typeof data.current_class === 'string' && data.current_class.trim()
          ? data.current_class.trim()
          : null,
      calendar_filter:
        typeof data.calendar_filter === 'string' && data.calendar_filter.trim()
          ? data.calendar_filter.trim()
          : null,
      grades: Array.isArray(data.grades)
        ? data.grades.filter(
            (g) =>
              g &&
              typeof g.assignment === 'string' &&
              g.assignment.trim() &&
              (typeof g.score === 'string' || typeof g.score === 'number')
          )
        : [],
    };
  } catch (err) {
    console.error('[content] desk.json unreadable, using defaults:', err.message);
    deskCache = {
      current_class: null,
      calendar_filter: null,
      grades: [],
    };
  }
  return deskCache;
}

/** Test hook. */
export function clearContentCache() {
  deskCache = undefined;
}
