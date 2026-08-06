/**
 * Idempotent schema migrations. Each statement is safe to re-run.
 */
export function runMigrations(db) {
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
}
