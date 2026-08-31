import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/health', (req, res) => {
  // ?deep=1 proves the DB is actually readable through the FUSE mount.
  // Used by the post-deploy smoke test; the plain probe stays DB-free so
  // transient volume issues can't get an otherwise-healthy instance killed.
  if (req.query.deep === '1') {
    try {
      getDb().prepare(`SELECT COUNT(*) AS n FROM editions`).get();
    } catch (err) {
      console.error('[health] deep check failed:', err);
      return res.status(503).json({ ok: false, error: err.code || 'db_error' });
    }
  }
  res.json({ ok: true });
});

export default router;
