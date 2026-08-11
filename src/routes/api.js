import { Router } from 'express';
import { requireIdentityToken } from '../middleware/requireIdentityToken.js';
import { runIngest } from '../services/ingest.js';
import {
  runPublish,
  getLatestEdition,
  getEditionByDate,
  getAdjacentDates,
} from '../services/edition.js';
import { getDb } from '../db/index.js';
import {
  getDeskSettings,
  setDeskSettings,
  refreshStudyEvents,
  getStudyDeskView,
  DEFAULT_CERT_LIST,
} from '../services/studyDesk.js';

const router = Router();

router.post('/ingest', requireIdentityToken, async (req, res) => {
  try {
    const result = await runIngest();
    const failed = result.results.filter((r) => r.error);
    // Partial source failures are OK — job succeeds if at least one source worked
    // and we didn't hard-crash. Actions can inspect the body.
    res.json({ ok: true, ...result, failed_sources: failed.length });
  } catch (err) {
    console.error('[api/ingest]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/publish', requireIdentityToken, async (req, res) => {
  try {
    const editionDate = req.body?.edition_date || req.query?.edition_date || undefined;
    const sendEmail = req.body?.send_email !== false && req.query?.send_email !== 'false';
    const result = await runPublish({ editionDate, sendEmail });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/publish]', err);
    // Fail loudly — Actions job must go red
    res.status(500).json({ ok: false, error: err.message });
  }
});

const ARCHIVE_PAGE_SIZE = 30;

router.get('/editions', (req, res) => {
  const db = getDb();
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM editions`).get().c;
  const rows = db
    .prepare(
      `SELECT edition_number, edition_date,
              json_extract(payload_json, '$.edition_title') AS deck
       FROM editions
       ORDER BY edition_date DESC
       LIMIT ? OFFSET ?`
    )
    .all(ARCHIVE_PAGE_SIZE, (page - 1) * ARCHIVE_PAGE_SIZE);
  res.json({
    editions: rows,
    page,
    per_page: ARCHIVE_PAGE_SIZE,
    total,
    total_pages: Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE)),
  });
});

router.get('/editions/latest', (req, res) => {
  const db = getDb();
  const row = getLatestEdition(db);
  if (!row) return res.status(404).json({ error: 'no_editions' });
  res.json(serializeEdition(row, db));
});

router.get('/editions/:date', (req, res) => {
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  const db = getDb();
  const row = getEditionByDate(db, date);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(serializeEdition(row, db));
});

// ---------- Publisher's Desk ----------
// Session-authed like the reader routes (requireAuth runs upstream);
// deliberately NOT on the identity-token path — this is a human surface.

const MAX_FIELD = 500;

router.get('/study-desk', (req, res) => {
  res.json(getStudyDeskView(getDb()));
});

router.get('/desk', (req, res) => {
  const db = getDb();
  const settings = getDeskSettings(db);
  let certList = DEFAULT_CERT_LIST;
  try {
    const parsed = JSON.parse(settings.cert_list || 'null');
    if (Array.isArray(parsed) && parsed.length) certList = parsed.map(String);
  } catch {
    /* fall back to defaults */
  }
  const grades = db
    .prepare(`SELECT id, assignment, score, created_at FROM grades ORDER BY id DESC LIMIT 50`)
    .all();
  const today = new Date().toISOString().slice(0, 10);
  const events = db
    .prepare(`SELECT title, due_at FROM study_events WHERE due_at >= ? ORDER BY due_at LIMIT 10`)
    .all(today);
  res.json({ settings, cert_list: certList, grades, events });
});

router.put('/desk/settings', async (req, res) => {
  const body = req.body || {};
  const patch = {};

  for (const key of ['active_cert', 'current_class', 'canvas_ics_url']) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value != null && typeof value !== 'string') {
      return res.status(400).json({ error: `invalid_${key}` });
    }
    if (value && value.length > MAX_FIELD) {
      return res.status(400).json({ error: `${key}_too_long` });
    }
    patch[key] = value ? value.trim() : value;
  }

  if (patch.canvas_ics_url) {
    let parsed;
    try {
      parsed = new URL(patch.canvas_ics_url);
    } catch {
      return res.status(400).json({ error: 'invalid_canvas_ics_url' });
    }
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'ics_url_must_be_https' });
    }
  }

  if ('cert_list' in body) {
    const list = body.cert_list;
    if (
      !Array.isArray(list) ||
      list.length > 25 ||
      list.some((c) => typeof c !== 'string' || !c.trim() || c.length > MAX_FIELD)
    ) {
      return res.status(400).json({ error: 'invalid_cert_list' });
    }
    patch.cert_list = JSON.stringify(list.map((c) => c.trim()));
  }

  const db = getDb();
  const icsChanged = 'canvas_ics_url' in patch;
  const settings = setDeskSettings(db, patch);
  // Refresh immediately on ICS change so the box comes alive without
  // waiting for the next hourly ingest.
  const refresh = icsChanged ? await refreshStudyEvents(db) : undefined;
  res.json({ ok: true, settings, ...(refresh ? { ics_refresh: refresh } : {}) });
});

router.post('/desk/grades', (req, res) => {
  const assignment = (req.body?.assignment || '').trim();
  const score = (req.body?.score || '').trim();
  if (!assignment || !score || assignment.length > MAX_FIELD || score.length > 50) {
    return res.status(400).json({ error: 'invalid_grade' });
  }
  const db = getDb();
  const row = db
    .prepare(`INSERT INTO grades (assignment, score, created_at) VALUES (?, ?, ?) RETURNING *`)
    .get(assignment, score, new Date().toISOString());
  res.json({ ok: true, grade: row });
});

router.delete('/desk/grades/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid_id' });
  const result = getDb().prepare(`DELETE FROM grades WHERE id = ?`).run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

function serializeEdition(row, db) {
  const adj = getAdjacentDates(db, row.edition_date);
  return {
    edition_date: row.edition_date,
    edition_number: row.edition_number,
    model: row.model,
    created_at: row.created_at,
    payload: JSON.parse(row.payload_json),
    ticker: row.ticker_json ? JSON.parse(row.ticker_json) : null,
    weather: row.weather_json ? JSON.parse(row.weather_json) : null,
    prev_date: adj.prev,
    next_date: adj.next,
  };
}

export default router;
