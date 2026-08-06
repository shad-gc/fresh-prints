import { config } from '../config.js';

const PUBLIC_PREFIXES = ['/auth', '/health', '/api/ingest', '/api/publish'];

/**
 * Session auth gate. Registered before app routes.
 * Exemptions: /auth/*, /health, /api/ingest, /api/publish
 * (ingest/publish use identity-token middleware instead).
 */
export function requireAuth(req, res, next) {
  const path = req.path || '';
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return next();
  }

  // Local-only: DEV_BYPASS_AUTH=1 skips OAuth so you can screenshot / iterate on UI
  if (config.isDev && process.env.DEV_BYPASS_AUTH === '1') {
    if (!req.user) {
      req.user = {
        id: 'dev',
        username: config.allowedGithubUsernames[0] || 'dev',
        displayName: 'Dev',
      };
    }
    req.isAuthenticated = () => true;
    return next();
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (path.startsWith('/api/')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // SPA navigations and asset requests without a session → login
  if (path.startsWith('/assets/')) {
    return res.status(401).send('Unauthorized');
  }

  return res.redirect('/auth/login');
}

export function isUsernameAllowed(username) {
  return config.allowedGithubUsernames.includes((username || '').toLowerCase());
}
