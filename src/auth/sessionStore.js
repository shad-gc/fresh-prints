import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import session from 'express-session';

/**
 * Minimal express-session store backed by better-sqlite3.
 * Single-instance app (Cloud Run max-instances=1) — no cross-process locking needed.
 */
export function createSqliteSessionStore(dbPath) {
  const Store = session.Store;

  class BetterSqliteStore extends Store {
    constructor(options = {}) {
      super(options);
      const file = options.dbPath || dbPath;
      const dir = path.dirname(path.resolve(file));
      if (dir && dir !== '.' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(file);
      this.db.pragma('journal_mode = WAL');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          expired INTEGER,
          sess TEXT NOT NULL
        )
      `);
      this._get = this.db.prepare(`SELECT sess, expired FROM sessions WHERE sid = ?`);
      this._set = this.db.prepare(
        `INSERT INTO sessions (sid, expired, sess) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET expired = excluded.expired, sess = excluded.sess`
      );
      this._destroy = this.db.prepare(`DELETE FROM sessions WHERE sid = ?`);
      this._touch = this.db.prepare(`UPDATE sessions SET expired = ? WHERE sid = ?`);
      this._clearExpired = this.db.prepare(`DELETE FROM sessions WHERE expired < ?`);
    }

    get(sid, cb) {
      try {
        this._clearExpired.run(Date.now());
        const row = this._get.get(sid);
        if (!row) return cb(null, null);
        if (row.expired && row.expired < Date.now()) {
          this._destroy.run(sid);
          return cb(null, null);
        }
        return cb(null, JSON.parse(row.sess));
      } catch (err) {
        return cb(err);
      }
    }

    set(sid, sess, cb) {
      try {
        const maxAge = sess.cookie?.maxAge;
        const expired = maxAge ? Date.now() + maxAge : Date.now() + 86400000;
        this._set.run(sid, expired, JSON.stringify(sess));
        cb && cb(null);
      } catch (err) {
        cb && cb(err);
      }
    }

    destroy(sid, cb) {
      try {
        this._destroy.run(sid);
        cb && cb(null);
      } catch (err) {
        cb && cb(err);
      }
    }

    touch(sid, sess, cb) {
      try {
        const maxAge = sess.cookie?.maxAge;
        const expired = maxAge ? Date.now() + maxAge : Date.now() + 86400000;
        this._touch.run(expired, sid);
        cb && cb(null);
      } catch (err) {
        cb && cb(err);
      }
    }
  }

  return BetterSqliteStore;
}
