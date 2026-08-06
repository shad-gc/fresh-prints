import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { runMigrations } from './migrate.js';
import { seedSources } from './seed.js';

let db;

export function getDb() {
  if (db) return db;

  const dbPath = config.databaseUrl;
  const dir = path.dirname(path.resolve(dbPath));
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  seedSources(db);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
