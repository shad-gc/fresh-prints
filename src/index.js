import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import passport from 'passport';

import { config } from './config.js';
import { getDb, closeDb } from './db/index.js';
import { configurePassport } from './auth/passport.js';
import { createSqliteSessionStore } from './auth/sessionStore.js';
import { requireAuth } from './middleware/requireAuth.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import healthRoutes from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BetterSqliteStore = createSqliteSessionStore();

// Ensure DB + migrations before listening
getDb();

const app = express();

// Cloud Run terminates TLS upstream — required for secure cookies
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const sessionDbPath = path.resolve(
  path.dirname(path.resolve(config.databaseUrl)),
  path.basename(config.databaseUrl).replace(/\.db$/i, '') + '-sessions.db'
);

app.use(
  session({
    store: new BetterSqliteStore({ dbPath: sessionDbPath }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: !config.isDev,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Auth gate BEFORE app routes (health / auth / ingest / publish exempt inside middleware)
app.use(requireAuth);

app.use(healthRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

const clientDist = path.join(root, 'client', 'dist');
const hasClient = fs.existsSync(path.join(clientDist, 'index.html'));

if (hasClient) {
  app.use(express.static(clientDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else if (config.isDev) {
  app.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html><body style="font-family:serif;padding:2rem;">
  <h1>Fresh Prints API</h1>
  <p>Client not built yet. Run <code>npm run build</code> or <code>npm run dev --prefix client</code> with a Vite proxy.</p>
  <p><a href="/auth/login">Login</a> · <a href="/health">Health</a></p>
</body></html>`);
  });
}

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  // Self-heal: a SQLITE_IOERR* on the GCS FUSE volume tends to persist on the
  // open file handle (Aug 10 incident: every read 500'd until a redeploy
  // remounted). Closing the handle makes the next request reopen the file
  // fresh, which is exactly what the redeploy did — without the redeploy.
  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_IOERR')) {
    console.error('[db] SQLITE_IOERR detected — closing DB handle so the next request reopens it');
    try {
      closeDb();
    } catch (closeErr) {
      console.error('[db] close after IOERR failed:', closeErr);
    }
    res.set('Retry-After', '2');
    return res.status(503).json({ error: 'database_unavailable_retrying' });
  }
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  console.log(`Fresh Prints listening on :${config.port} (${config.nodeEnv})`);
});
