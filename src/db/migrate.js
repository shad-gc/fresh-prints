/**
 * Idempotent schema migrations. Each statement is safe to re-run.
 *
 * PRAGMA user_version gates the whole block: when the DB is already at
 * SCHEMA_VERSION, boot performs ZERO writes. This matters because the
 * production DB lives on a GCS FUSE volume and every deploy briefly runs
 * the old and new revisions concurrently — a boot-time write during that
 * overlap is what broke reads (SQLITE_IOERR_READ) in the Aug 10 incident.
 * Bump SCHEMA_VERSION whenever a statement below changes.
 */
export const SCHEMA_VERSION = 6; // 1: base, 2: ticker/weather, 3: desk, 4: examiner, 5: desk removed, 6: examiner removed

export function runMigrations(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current >= SCHEMA_VERSION) return false;

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('rss', 'hn', 'reddit')),
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      min_points INTEGER,
      is_vendor INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES sources(id),
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      author TEXT,
      points INTEGER,
      comments INTEGER,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      cluster_id INTEGER,
      UNIQUE(canonical_url, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_items_fetched_at ON items(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_items_cluster_id ON items(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_items_canonical_url ON items(canonical_url);

    CREATE TABLE IF NOT EXISTS editions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edition_date TEXT NOT NULL UNIQUE,
      edition_number INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_editions_date ON editions(edition_date);
  `);

  // Additive column for older DBs created before is_vendor existed
  const cols = db.prepare(`PRAGMA table_info(sources)`).all().map((c) => c.name);
  if (!cols.includes('is_vendor')) {
    db.exec(`ALTER TABLE sources ADD COLUMN is_vendor INTEGER NOT NULL DEFAULT 0`);
  }

  // v2: per-edition snapshots fetched at publish time. NULL on old editions
  // means the ticker ribbon / weather ear simply don't render. ADD COLUMN is
  // metadata-only in SQLite — safe on the GCS FUSE volume.
  const editionCols = db.prepare(`PRAGMA table_info(editions)`).all().map((c) => c.name);
  if (!editionCols.includes('ticker_json')) {
    db.exec(`ALTER TABLE editions ADD COLUMN ticker_json TEXT`);
  }
  if (!editionCols.includes('weather_json')) {
    db.exec(`ALTER TABLE editions ADD COLUMN weather_json TEXT`);
  }

  // PR B: Study Desk (the desk_settings and grades tables that shipped with
  // the Publisher's Desk were dropped in v5 — class, cert, and grades now
  // live in content/desk.json and the ICS URL in Secret Manager).
  db.exec(`
    CREATE TABLE IF NOT EXISTS study_events (
      uid        TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      due_at     TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_study_events_due_at ON study_events(due_at);
  `);

  // v5 dropped the desk-era tables; v6 drops the Examiner (puzzle_*) tables.
  // The feature was removed from the paper and the archives — assignments,
  // attempts, and the question bank go with it. DROPs are idempotent.
  db.exec(`
    DROP TABLE IF EXISTS desk_settings;
    DROP TABLE IF EXISTS grades;

    DROP TABLE IF EXISTS puzzle_attempts;
    DROP TABLE IF EXISTS puzzle_assignments;
    DROP TABLE IF EXISTS puzzle_questions;
  `);

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return true;
}
