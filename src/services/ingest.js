import { getDb } from '../db/index.js';
import { fetchRss } from './rss.js';
import { fetchHackerNews } from './hn.js';
import { fetchReddit } from './reddit.js';
import { clusterItems } from './cluster.js';
import { refreshStudyEvents } from './studyDesk.js';

const upsertItem = `
  INSERT INTO items (
    source_id, title, url, canonical_url, author, points, comments,
    published_at, fetched_at
  ) VALUES (
    @source_id, @title, @url, @canonical_url, @author, @points, @comments,
    @published_at, @fetched_at
  )
  ON CONFLICT(canonical_url, source_id) DO UPDATE SET
    title = excluded.title,
    url = excluded.url,
    author = COALESCE(excluded.author, items.author),
    points = COALESCE(excluded.points, items.points),
    comments = COALESCE(excluded.comments, items.comments),
    published_at = COALESCE(excluded.published_at, items.published_at),
    fetched_at = excluded.fetched_at
  RETURNING id
`;

async function fetchSource(source) {
  switch (source.type) {
    case 'rss':
      return fetchRss(source);
    case 'hn':
      return fetchHackerNews(source);
    case 'reddit':
      return fetchReddit(source);
    default:
      throw new Error(`Unknown source type: ${source.type}`);
  }
}

/**
 * Pull all enabled sources, upsert items (no duplicates), re-cluster.
 */
export async function runIngest() {
  const db = getDb();
  const sources = db.prepare(`SELECT * FROM sources WHERE enabled = 1`).all();

  const results = [];
  const touchedIds = [];
  const insert = db.prepare(upsertItem);

  for (const source of sources) {
    const entry = { source: source.name, type: source.type, fetched: 0, upserted: 0, error: null };
    try {
      const items = await fetchSource(source);
      entry.fetched = items.length;
      const tx = db.transaction((rows) => {
        const ids = [];
        for (const row of rows) {
          const result = insert.get(row);
          if (result?.id) ids.push(result.id);
        }
        return ids;
      });
      const ids = tx(items);
      entry.upserted = ids.length;
      touchedIds.push(...ids);
    } catch (err) {
      entry.error = err.message || String(err);
      console.error(`[ingest] ${source.name}:`, entry.error);
    }
    results.push(entry);
  }

  const cluster = clusterItems(db, touchedIds);
  const totalItems = db.prepare(`SELECT COUNT(*) AS c FROM items`).get().c;

  // Piggyback the Canvas feed refresh on the hourly cycle. Never fatal —
  // a broken ICS URL must not take down news ingestion.
  const studyDesk = await refreshStudyEvents(db);

  return {
    sources: results.length,
    results,
    clustered: cluster.clusters,
    total_items: totalItems,
    study_desk: studyDesk,
  };
}
