import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const client = new OAuth2Client();

/**
 * Verify a GCP identity token (OIDC) for Cloud Scheduler / GitHub Actions callers.
 * Skipped entirely when NODE_ENV=development.
 */
export async function requireIdentityToken(req, res, next) {
  if (config.isDev) {
    return next();
  }

  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'missing_bearer_token' });
  }

  const token = match[1];
  if (!config.cloudRunServiceUrl) {
    return res.status(500).json({ error: 'cloud_run_service_url_not_configured' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.cloudRunServiceUrl,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.identity = payload;
    return next();
  } catch (err) {
    console.error('[identity] token verification failed:', err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
}
