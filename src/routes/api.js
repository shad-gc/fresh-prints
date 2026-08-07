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
