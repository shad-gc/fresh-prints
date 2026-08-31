import { config } from '../config.js';
import { getDeskContent, DEFAULT_ACTIVE_CERT } from './content.js';

/**
 * Study Desk: the Canvas ICS feed plus class/cert/grades from repo content.
 *
 * The desk_settings table and the /desk admin page are gone — the feed URL
 * comes from config (Secret Manager) and everything else from
 * content/desk.json, edited via pull request.
 *
 * The ICS feed is the source of truth for deadlines — refresh is
 * replace-on-fetch inside a transaction (no sync logic, no stale events).
 * A failed fetch keeps the previous rows: same never-throw posture as the
 * ticker and weather snapshots.
 */

export { DEFAULT_ACTIVE_CERT };

/**
 * Stable slug for a cert's display name, used as the question bank's
 * partition key. Renaming a cert in the desk list would orphan its bank,
 * so this stays a pure function of the name — no stored ids to migrate.
 */
export function certSlug(certName) {
  const name = (certName || DEFAULT_ACTIVE_CERT).trim();
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Keep future events plus a month of history; hard cap for pathological feeds.
const PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

/** Unescape ICS TEXT values (RFC 5545 §3.3.11). */
function unescapeIcsText(value) {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * DTSTART value → ISO string.
 * - `20260906T035900Z`  → exact UTC instant
 * - `20260906T235900`   → no zone (rare in Canvas); treated as UTC, best effort
 * - `20260906`          → all-day; stored date-only, client renders without time
 */
function parseIcsDate(raw) {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (!h) return `${y}-${mo}-${d}`;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

/**
 * Minimal VEVENT parser — UID, SUMMARY, DTSTART are all the desk needs.
 * Handles RFC 5545 line folding. Deliberately not a general ICS library.
 */
export function parseIcs(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.uid && current.title && current.due_at) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === 'UID') current.uid = value.trim();
    else if (name === 'SUMMARY') current.title = unescapeIcsText(value);
    else if (name === 'DTSTART') current.due_at = parseIcsDate(value.trim());
  }
  return events;
}

/**
 * Fetch the Canvas feed and replace study_events. Never throws.
 * No-op when no ICS URL is configured.
 */
export async function refreshStudyEvents(db) {
  const url = config.studyDeskIcsUrl;
  if (!url) return { ok: true, skipped: true };

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': config.userAgent, Accept: 'text/calendar, */*' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`ICS fetch: HTTP ${res.status}`);
    const events = parseIcs(await res.text());

    const cutoff = new Date(Date.now() - PAST_WINDOW_MS).toISOString().slice(0, 10);
    const kept = events
      .filter((e) => e.due_at >= cutoff)
      .sort((a, b) => (a.due_at < b.due_at ? -1 : 1))
      .slice(0, MAX_EVENTS);

    const fetchedAt = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO study_events (uid, title, due_at, fetched_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        title = excluded.title, due_at = excluded.due_at, fetched_at = excluded.fetched_at
    `);
    const replace = db.transaction(() => {
      db.prepare(`DELETE FROM study_events`).run();
      for (const e of kept) insert.run(e.uid, e.title, e.due_at, fetchedAt);
    });
    replace();
    return { ok: true, count: kept.length };
  } catch (err) {
    console.error('[study-desk] ICS refresh failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Everything the front-page box needs, in one shot. */
export function getStudyDeskView(db) {
  const desk = getDeskContent();
  const today = new Date().toISOString().slice(0, 10);
  // Date-only strings sort before same-day datetimes, so `>= today` keeps
  // anything due later today either way.
  const nextEvent = db
    .prepare(`SELECT title, due_at FROM study_events WHERE due_at >= ? ORDER BY due_at LIMIT 1`)
    .get(today);
  // Last entry in the file is the most recent — grades append at the bottom.
  const latestGrade = desk.grades.length ? desk.grades[desk.grades.length - 1] : null;
  return {
    current_class: desk.current_class,
    ics_configured: Boolean(config.studyDeskIcsUrl),
    next_event: nextEvent || null,
    latest_grade: latestGrade
      ? { assignment: latestGrade.assignment, score: String(latestGrade.score) }
      : null,
  };
}
