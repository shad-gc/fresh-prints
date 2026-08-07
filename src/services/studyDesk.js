import { config } from '../config.js';

/**
 * Study Desk: desk settings, the Canvas ICS feed, and the grade ledger.
 *
 * The ICS feed is the source of truth for deadlines — refresh is
 * replace-on-fetch inside a transaction (no sync logic, no stale events).
 * A failed fetch keeps the previous rows: same never-throw posture as the
 * ticker and weather snapshots.
 */

const SETTING_KEYS = ['active_cert', 'cert_list', 'current_class', 'canvas_ics_url'];

/** Certs seeded into the selector until the user saves their own list. */
export const DEFAULT_CERT_LIST = [
  'GCP Associate Cloud Engineer',
  'Okta Certified Professional',
  'Okta Certified Administrator',
  'GCP Professional Cloud Architect',
  'Jamf 100',
];

// Keep future events plus a month of history; hard cap for pathological feeds.
const PAST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 500;

export function getDeskSettings(db) {
  const rows = db.prepare(`SELECT key, value FROM desk_settings`).all();
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export function setDeskSettings(db, patch) {
  const upsert = db.prepare(`
    INSERT INTO desk_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const del = db.prepare(`DELETE FROM desk_settings WHERE key = ?`);
  const now = new Date().toISOString();
  const apply = db.transaction(() => {
    for (const key of SETTING_KEYS) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value == null || value === '') del.run(key);
      else upsert.run(key, String(value), now);
    }
  });
  apply();
  return getDeskSettings(db);
}

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
  const settings = getDeskSettings(db);
  const url = settings.canvas_ics_url;
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
  const settings = getDeskSettings(db);
  const today = new Date().toISOString().slice(0, 10);
  // Date-only strings sort before same-day datetimes, so `>= today` keeps
  // anything due later today either way.
  const nextEvent = db
    .prepare(`SELECT title, due_at FROM study_events WHERE due_at >= ? ORDER BY due_at LIMIT 1`)
    .get(today);
  const latestGrade = db
    .prepare(`SELECT assignment, score FROM grades ORDER BY id DESC LIMIT 1`)
    .get();
  return {
    current_class: settings.current_class || null,
    ics_configured: Boolean(settings.canvas_ics_url),
    next_event: nextEvent || null,
    latest_grade: latestGrade || null,
  };
}
