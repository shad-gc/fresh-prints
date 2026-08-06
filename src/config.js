import 'dotenv/config';

function requiredInProduction(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value || '';
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL || './prints.db',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  ghClientId: process.env.GH_CLIENT_ID || '',
  ghClientSecret: process.env.GH_CLIENT_SECRET || '',
  allowedGithubUsernames: (process.env.ALLOWED_GITHUB_USERNAMES || '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean),
  // Service-account emails allowed to invoke /api/ingest and /api/publish.
  // Audience verification alone is NOT authorization — any SA in any project
  // can mint an identity token with our URL as the audience.
  allowedInvokerEmails: (process.env.ALLOWED_INVOKER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  resendApiKey: process.env.RESEND_API_KEY || '',
  digestEmailFrom: process.env.DIGEST_EMAIL_FROM || '',
  digestEmailTo: process.env.DIGEST_EMAIL_TO || '',
  appUrl: (process.env.APP_URL || `http://localhost:${process.env.PORT || 8080}`).replace(
    /\/$/,
    ''
  ),
  cloudRunServiceUrl: (process.env.CLOUD_RUN_SERVICE_URL || '').replace(/\/$/, ''),
  userAgent:
    process.env.USER_AGENT ||
    'web:fresh-prints:v1.0 (+https://github.com; private daily digest)',
};

// Touch required-in-prod helpers so misconfig fails early on boot in production
if (!config.isDev) {
  requiredInProduction('SESSION_SECRET');
  requiredInProduction('GH_CLIENT_ID');
  requiredInProduction('GH_CLIENT_SECRET');
  requiredInProduction('ALLOWED_GITHUB_USERNAMES');
  requiredInProduction('ALLOWED_INVOKER_EMAILS');
  requiredInProduction('ANTHROPIC_API_KEY');
  requiredInProduction('RESEND_API_KEY');
  requiredInProduction('DIGEST_EMAIL_FROM');
  requiredInProduction('DIGEST_EMAIL_TO');
  requiredInProduction('APP_URL');
  requiredInProduction('CLOUD_RUN_SERVICE_URL');
}
