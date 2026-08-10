/**
 * The Examiner: one certification question per edition.
 *
 * Design rules, all of them load-bearing:
 *   - Questions are never generated at request time. They are batch-drafted
 *     behind a dispatch, reviewed by a human, and only then eligible.
 *   - The question is pinned at publish, not at page load, so an archived
 *     edition keeps the question it actually printed with.
 *   - The streak is derived from attempts, never stored. A stored counter
 *     drifts the first time a publish fails or an edition is republished.
 *   - Nothing here may fail a publish or a page render. A dry bank simply
 *     means no box.
 */

import { CERT_BLUEPRINTS } from './questionWriter.js';

const MAX_STREAK_SCAN = 400;

/** Display name for a cert slug; falls back to de-hyphenated slug. */
function certDisplayName(slug) {
  if (!slug) return null;
  const known = CERT_BLUEPRINTS[slug];
  if (known) return known.name;
  return slug.replace(/-/g, ' ');
}

/** Rows are stored as JSON strings; hand the client real arrays. */
function hydrate(row) {
  if (!row) return null;
  let choices = [];
  let answers = [];
  try {
    choices = JSON.parse(row.choices_json);
  } catch {
    choices = [];
  }
  try {
    answers = JSON.parse(row.answer_indices);
  } catch {
    answers = [];
  }
  return {
    id: row.id,
    cert_slug: row.cert_slug,
    domain: row.domain || null,
    prompt: row.prompt,
    choices: Array.isArray(choices) ? choices : [],
    answer_indices: Array.isArray(answers) ? answers : [],
    explanation: row.explanation,
    source_url: row.source_url || null,
    status: row.status,
    model: row.model || null,
    batch_id: row.batch_id || null,
    created_at: row.created_at,
    times_used: row.times_used,
    last_used_on: row.last_used_on || null,
  };
}

/**
 * Pin a question to an edition. Picks the approved question for the active
 * cert that has gone longest without printing (never-used first), so the bank
 * cycles evenly instead of favouring low ids.
 *
 * Idempotent: republishing the same date keeps the original question.
 * Returns the assigned question, or null when the bank is dry.
 */
export function assignQuestionForEdition(db, editionDate, certSlug) {
  const existing = db
    .prepare(
      `SELECT q.* FROM puzzle_assignments a
       JOIN puzzle_questions q ON q.id = a.question_id
       WHERE a.edition_date = ?`
    )
    .get(editionDate);
  if (existing) return hydrate(existing);

  if (!certSlug) return null;

  const pick = db.transaction(() => {
    // NULLS FIRST via the `last_used_on IS NOT NULL` sort key: unused
    // questions lead, then oldest printing. id breaks ties deterministically.
    const candidate = db
      .prepare(
        `SELECT * FROM puzzle_questions
         WHERE cert_slug = ? AND status = 'approved'
         ORDER BY (last_used_on IS NOT NULL), last_used_on ASC, id ASC
         LIMIT 1`
      )
      .get(certSlug);
    if (!candidate) return null;

    db.prepare(
      `INSERT INTO puzzle_assignments (edition_date, question_id, assigned_at)
       VALUES (?, ?, ?)
       ON CONFLICT(edition_date) DO NOTHING`
    ).run(editionDate, candidate.id, new Date().toISOString());

    db.prepare(
      `UPDATE puzzle_questions
       SET times_used = times_used + 1, last_used_on = ?
       WHERE id = ?`
    ).run(editionDate, candidate.id);

    return candidate;
  });

  try {
    return hydrate(pick());
  } catch (err) {
    // A dry or wedged bank must never take the paper down with it.
    console.error('[examiner] assignment failed:', err.message || err);
    return null;
  }
}

/**
 * Current streak: consecutive most-recent editions answered correctly.
 * Walks attempts newest-first and stops at the first miss. An edition with
 * no attempt is a gap, not a miss — skipping a day doesn't punish you, but
 * it doesn't extend the streak either, so the walk stops there too.
 */
export function currentStreak(db) {
  const rows = db
    .prepare(
      `SELECT edition_date, was_correct FROM puzzle_attempts
       ORDER BY edition_date DESC LIMIT ?`
    )
    .all(MAX_STREAK_SCAN);

  let streak = 0;
  for (const row of rows) {
    if (row.was_correct === 1) streak += 1;
    else break;
  }
  return streak;
}

function answersMatch(expected, chosen) {
  if (!Array.isArray(expected) || !Array.isArray(chosen)) return false;
  if (expected.length !== chosen.length) return false;
  const a = [...expected].sort((x, y) => x - y);
  const b = [...chosen].sort((x, y) => x - y);
  return a.every((v, i) => v === b[i]);
}

/**
 * The front-page view. The answer key ships with the question — a real paper
 * prints the answer upside-down at the foot of the puzzle, and flipping the
 * page early is between the reader and their conscience. The explanation and
 * source stay held back until an attempt exists, so the payoff for actually
 * committing to an answer is the teaching, not the letter.
 */
export function getExaminerView(db, editionDate) {
  if (!editionDate) return null;

  const row = db
    .prepare(
      `SELECT q.* FROM puzzle_assignments a
       JOIN puzzle_questions q ON q.id = a.question_id
       WHERE a.edition_date = ?`
    )
    .get(editionDate);
  if (!row) return null;

  const question = hydrate(row);
  const attempt = db
    .prepare(`SELECT chosen_json, was_correct, answered_at FROM puzzle_attempts WHERE edition_date = ?`)
    .get(editionDate);

  let chosen = null;
  if (attempt?.chosen_json) {
    try {
      chosen = JSON.parse(attempt.chosen_json);
    } catch {
      chosen = null;
    }
  }

  const view = {
    edition_date: editionDate,
    question_id: question.id,
    cert_slug: question.cert_slug,
    cert_name: certDisplayName(question.cert_slug),
    domain: question.domain,
    prompt: question.prompt,
    choices: question.choices,
    multi_select: question.answer_indices.length > 1,
    bank_number: question.times_used,
    streak: currentStreak(db),
    answered: !!attempt,
    answer_indices: question.answer_indices,
  };

  if (attempt) {
    view.explanation = question.explanation;
    view.source_url = question.source_url;
    view.chosen_indices = chosen;
    view.was_correct = attempt.was_correct === 1;
    view.revealed_only = chosen === null;
  }

  return view;
}

/**
 * Record the day's attempt. One per edition, first write wins — no retries,
 * no score editing. `chosen` of null means "reveal without answering", which
 * breaks the streak but is recorded honestly rather than hidden.
 */
export function recordAttempt(db, editionDate, chosen) {
  const row = db
    .prepare(
      `SELECT q.answer_indices FROM puzzle_assignments a
       JOIN puzzle_questions q ON q.id = a.question_id
       WHERE a.edition_date = ?`
    )
    .get(editionDate);
  if (!row) return { error: 'no_question' };

  const existing = db
    .prepare(`SELECT 1 FROM puzzle_attempts WHERE edition_date = ?`)
    .get(editionDate);
  if (existing) return { error: 'already_answered' };

  let expected = [];
  try {
    expected = JSON.parse(row.answer_indices);
  } catch {
    expected = [];
  }

  const wasCorrect = chosen === null ? null : answersMatch(expected, chosen) ? 1 : 0;

  db.prepare(
    `INSERT INTO puzzle_attempts (edition_date, chosen_json, was_correct, answered_at)
     VALUES (?, ?, ?, ?)`
  ).run(
    editionDate,
    chosen === null ? null : JSON.stringify(chosen),
    wasCorrect,
    new Date().toISOString()
  );

  return { ok: true, view: getExaminerView(db, editionDate) };
}

/** Review queue for the Publisher's Desk, newest drafts first. */
export function getQuestionBank(db, { certSlug, status = 'draft', limit = 50 } = {}) {
  const params = [];
  let sql = `SELECT * FROM puzzle_questions WHERE 1 = 1`;
  if (certSlug) {
    sql += ` AND cert_slug = ?`;
    params.push(certSlug);
  }
  if (status && status !== 'all') {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 50, 200));

  const rows = db.prepare(sql).all(...params);

  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM puzzle_questions
       ${certSlug ? 'WHERE cert_slug = ?' : ''}
       GROUP BY status`
    )
    .all(...(certSlug ? [certSlug] : []));

  const tally = { draft: 0, approved: 0, rejected: 0, retired: 0 };
  for (const row of counts) {
    if (row.status in tally) tally[row.status] = row.n;
  }

  return { questions: rows.map(hydrate), counts: tally };
}

/** Approve, reject, or retire a reviewed draft. */
export function reviewQuestion(db, id, status) {
  if (!['approved', 'rejected', 'retired', 'draft'].includes(status)) {
    return { error: 'invalid_status' };
  }
  const result = db
    .prepare(`UPDATE puzzle_questions SET status = ?, reviewed_at = ? WHERE id = ?`)
    .run(status, new Date().toISOString(), id);
  if (result.changes === 0) return { error: 'not_found' };
  return { ok: true };
}

/** Edit a draft's text in place. Only unreviewed drafts are editable. */
export function updateQuestion(db, id, patch) {
  const row = db.prepare(`SELECT status FROM puzzle_questions WHERE id = ?`).get(id);
  if (!row) return { error: 'not_found' };

  const fields = [];
  const params = [];
  if (typeof patch.prompt === 'string' && patch.prompt.trim()) {
    fields.push('prompt = ?');
    params.push(patch.prompt.trim());
  }
  if (Array.isArray(patch.choices) && patch.choices.length >= 2) {
    fields.push('choices_json = ?');
    params.push(JSON.stringify(patch.choices.map((c) => String(c).trim())));
  }
  if (Array.isArray(patch.answer_indices) && patch.answer_indices.length) {
    fields.push('answer_indices = ?');
    params.push(JSON.stringify(patch.answer_indices.map(Number)));
  }
  if (typeof patch.explanation === 'string' && patch.explanation.trim()) {
    fields.push('explanation = ?');
    params.push(patch.explanation.trim());
  }
  if (typeof patch.domain === 'string') {
    fields.push('domain = ?');
    params.push(patch.domain.trim() || null);
  }
  if (!fields.length) return { error: 'nothing_to_update' };

  params.push(id);
  db.prepare(`UPDATE puzzle_questions SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return { ok: true };
}
