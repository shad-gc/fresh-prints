import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const client = new OAuth2Client();

/**
 * True only for a Google-verified caller identity on the allowlist.
 * Signature + audience prove the token is ours-shaped; they do NOT prove who
 * minted it — any service account anywhere can request our audience. Pin the
 * caller by verified email.
 */
export function isAllowedInvoker(payload, allowlist = config.allowedInvokerEmails) {
  if (!payload || payload.email_verified !== true || !payload.email) return false;
  return allowlist.includes(payload.email.toLowerCase());
}

/**
 * Verify a GCP identity token (OIDC) for GitHub Actions / scheduler callers.
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
    if (!isAllowedInvoker(payload)) {
      // Cloud Run logs are private; the email is useful for debugging IAM.
      console.error(`[identity] caller not allowlisted: ${payload.email || '(no email)'}`);
      return res.status(403).json({ error: 'caller_not_allowed' });
    }
    req.identity = payload;
    return next();
  } catch (err) {
    console.error('[identity] token verification failed:', err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
}
