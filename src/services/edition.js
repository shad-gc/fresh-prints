import { getDb } from '../db/index.js';
import { generateEdition } from './anthropic.js';
import { sendEditionEmail } from './email.js';

/**
 * Build candidate clusters for the last 24h for the Claude prompt.
 */
export function loadCandidates(db, sinceIso) {
  const rows = db
    .prepare(
      `SELECT
         i.id,
         i.title,
         i.url,
         i.canonical_url,
         i.points,
         i.comments,
         i.published_at,
         i.cluster_id,
         s.name AS source_name,
         s.type AS source_type,
         s.is_vendor
       FROM items i
       JOIN sources s ON s.id = i.source_id
       WHERE COALESCE(i.published_at, i.fetched_at) >= ?
       ORDER BY i.cluster_id, i.fetched_at DESC`
    )
    .all(sinceIso);

  const clusters = new Map();
  for (const row of rows) {
    const cid = row.cluster_id ?? row.id;
    if (!clusters.has(cid)) {
      clusters.set(cid, {
        cluster_id: cid,
        titles: [],
        urls: [],
        sources: [],
        max_points: 0,
        max_comments: 0,
        is_vendor: false,
        source_count: 0,
      });
    }
    const c = clusters.get(cid);
    if (!c.titles.includes(row.title)) c.titles.push(row.title);
    if (!c.urls.includes(row.canonical_url)) c.urls.push(row.canonical_url);
    if (!c.sources.includes(row.source_name)) {
      c.sources.push(row.source_name);
      c.source_count = c.sources.length;
    }
    if (row.points != null) c.max_points = Math.max(c.max_points, row.points);
    if (row.comments != null) c.max_comments = Math.max(c.max_comments, row.comments);
    if (row.is_vendor) c.is_vendor = true;
  }

  return [...clusters.values()]
    .map((c) => ({
      cluster_id: c.cluster_id,
      title: c.titles[0],
      alt_titles: c.titles.slice(1),
      urls: c.urls,
      sources: c.sources,
      source_count: c.source_count,
      points: c.max_points || null,
      comments: c.max_comments || null,
      is_vendor: !!c.is_vendor,
    }))
    .sort((a, b) => b.source_count - a.source_count || (b.points || 0) - (a.points || 0));
}

function todayPacificDate() {
  // YYYY-MM-DD in America/Los_Angeles
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Publish (or re-publish) an edition for a given date. Idempotent per date.
 */
export async function runPublish({ editionDate, sendEmail = true } = {}) {
  const db = getDb();
  const date = editionDate || todayPacificDate();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const candidates = loadCandidates(db, since);
  if (candidates.length < 5) {
    throw new Error(
      `Not enough candidate clusters in the last 24h (have ${candidates.length}, need ≥5). Run ingest first.`
    );
  }

  const { payload, model, input_tokens, output_tokens } = await generateEdition(candidates);

  const existing = db.prepare(`SELECT id, edition_number FROM editions WHERE edition_date = ?`).get(date);
  let editionNumber;
  if (existing) {
    editionNumber = existing.edition_number;
  } else {
    const max = db.prepare(`SELECT COALESCE(MAX(edition_number), 0) AS m FROM editions`).get().m;
    editionNumber = max + 1;
  }

  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO editions (edition_date, edition_number, payload_json, model, input_tokens, output_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(edition_date) DO UPDATE SET
       payload_json = excluded.payload_json,
       model = excluded.model,
       input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens,
       created_at = excluded.created_at`
  ).run(
    date,
    editionNumber,
    JSON.stringify(payload),
    model,
    input_tokens,
    output_tokens,
    createdAt
  );

  let email = null;
  if (sendEmail) {
    email = await sendEditionEmail({
      editionDate: date,
      editionNumber,
      payload,
    });
  }

  return {
    edition_date: date,
    edition_number: editionNumber,
    top_stories: payload.top_stories.length,
    the_wire: payload.the_wire.length,
    edition_title: payload.edition_title,
    model,
    input_tokens,
    output_tokens,
    replaced: !!existing,
    email_id: email?.id || null,
  };
}

export function getLatestEdition(db) {
  return db
    .prepare(`SELECT * FROM editions ORDER BY edition_date DESC LIMIT 1`)
    .get();
}

export function getEditionByDate(db, date) {
  return db.prepare(`SELECT * FROM editions WHERE edition_date = ?`).get(date);
}

export function getAdjacentDates(db, date) {
  const prev = db
    .prepare(
      `SELECT edition_date FROM editions WHERE edition_date < ? ORDER BY edition_date DESC LIMIT 1`
    )
    .get(date);
  const next = db
    .prepare(
      `SELECT edition_date FROM editions WHERE edition_date > ? ORDER BY edition_date ASC LIMIT 1`
    )
    .get(date);
  return {
    prev: prev?.edition_date || null,
    next: next?.edition_date || null,
  };
}
