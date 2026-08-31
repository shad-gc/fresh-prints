import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getDb } from '../db/index.js';

const router = Router();

// /health is auth-exempt and ?deep=1 touches the DB, so cap it per IP
// (CodeQL js/missing-rate-limiting). trust proxy is set in index.js, so
// req.ip is the real client IP behind Cloud Run. The deploy smoke test
// sends 3 requests ~45s apart — nowhere near this limit.
const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.get('/health', healthLimiter, (req, res) => {
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
