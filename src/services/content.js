import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo-reviewed content, replacing the Publisher's Desk UI.
 *
 * Both files live in content/ and ship inside the image, so "editing"
 * them is a pull request — the review step for Examiner questions is the
 * PR diff, keeping the standing rule that no model writes content at
 * runtime and nothing reaches the paper without a human approving it.
 *
 * Files are static for the life of the container, so reads are cached.
 * Both loaders never throw: a broken file logs loudly and degrades to
 * the same empty state the desk-backed version had.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../../content');

/** Cert shown when content/desk.json doesn't name one. */
export const DEFAULT_ACTIVE_CERT = 'Associate Google Workspace Administrator';

let deskCache;
let questionsCache;

function readJson(name) {
  const file = path.join(CONTENT_DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

/** { active_cert, current_class, grades: [{assignment, score}, ...] } */
export function getDeskContent() {
  if (deskCache !== undefined) return deskCache;
  try {
    const data = readJson('desk.json');
    deskCache = {
      active_cert:
        typeof data.active_cert === 'string' && data.active_cert.trim()
          ? data.active_cert.trim()
          : DEFAULT_ACTIVE_CERT,
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
      active_cert: DEFAULT_ACTIVE_CERT,
      current_class: null,
      calendar_filter: null,
      grades: [],
    };
  }
  return deskCache;
}

/**
 * Validate one question entry. Returns a string describing the problem,
 * or null when the entry is sound. Exported for scripts/validate-content.js.
 */
export function questionProblem(q) {
  if (!q || typeof q !== 'object') return 'not an object';
  if (typeof q.key !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(q.key)) {
    return 'key must be a lowercase slug (3-64 chars)';
  }
  if (typeof q.cert_slug !== 'string' || !q.cert_slug.trim()) return 'cert_slug missing';
  if (typeof q.domain !== 'string' || !q.domain.trim()) return 'domain missing';
  if (typeof q.prompt !== 'string' || q.prompt.trim().length < 20) return 'prompt too short';
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return 'choices must have 4 items';
  if (q.choices.some((c) => typeof c !== 'string' || !c.trim())) return 'empty choice';
  if (
    !Array.isArray(q.answer_indices) ||
    q.answer_indices.length < 1 ||
    q.answer_indices.some((i) => !Number.isInteger(i) || i < 0 || i > 3)
  ) {
    return 'answer_indices must be integers 0-3';
  }
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) {
    return 'explanation too short';
  }
  return null;
}

/** Valid entries from content/examiner-questions.json; invalid ones log and drop. */
export function getExaminerQuestions() {
  if (questionsCache !== undefined) return questionsCache;
  try {
    const data = readJson('examiner-questions.json');
    if (!Array.isArray(data)) throw new Error('top level must be an array');
    const seen = new Set();
    const valid = [];
    for (const q of data) {
      const problem = questionProblem(q);
      if (problem) {
        console.error(`[content] dropping question ${q?.key || '(no key)'}: ${problem}`);
        continue;
      }
      if (seen.has(q.key)) {
        console.error(`[content] dropping duplicate question key ${q.key}`);
        continue;
      }
      seen.add(q.key);
      valid.push(q);
    }
    questionsCache = valid;
  } catch (err) {
    console.error('[content] examiner-questions.json unreadable:', err.message);
    questionsCache = [];
  }
  return questionsCache;
}

/** Test hook. */
export function clearContentCache() {
  deskCache = undefined;
  questionsCache = undefined;
}
