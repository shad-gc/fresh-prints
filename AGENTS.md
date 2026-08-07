# AGENTS.md

## Cursor Cloud specific instructions

Fresh Prints is a single-user, newspaper-style daily tech digest. It is one
deployable app, not a monorepo:

- **API server** (`src/`, Express + ESM): `npm run dev` → serves on `:8080`.
  On boot it opens/migrates/seeds SQLite (`DATABASE_URL`, local default
  `./prints.db`) and serves the built client from `client/dist` if present.
- **Client dev server** (`client/`, React + Vite): `npm run dev:client` →
  `:5173` with HMR, proxying `/api`, `/auth`, `/health` to `:8080`. Run the API
  server too — the client has no data without it.

Standard commands live in `README.md` and `package.json`; don't duplicate them.
Notes that are NOT obvious:

- **Local `.env` is required and gitignored.** Copy `.env.example` → `.env`.
  For a reachable UI without a GitHub OAuth app, set `NODE_ENV=development` and
  `DEV_BYPASS_AUTH=1` (dev-only; injects a fake `dev` user so `requireAuth`
  passes). Without it, every non-public route 302-redirects to `/auth/login`.
- **Tests:** there is no test framework and no `lint` script. The only
  automated check is `npm run selftest` (`scripts/selftest.js`, pure Node
  `assert`, no network/keys) covering URL canonicalization, clustering, edition
  schema validation, and invoker pinning.
- **Ingest works with no API keys:** `curl -X POST localhost:8080/api/ingest`
  fetches real RSS/Hacker News into SQLite and clusters dupes. In dev,
  `/api/ingest` and `/api/publish` skip the GCP identity-token check.
  Reddit sources return HTTP 403 from datacenter IPs (no auth) — this is
  expected; ingest treats per-source failures as non-fatal and still succeeds.
- **Publish needs secrets.** `POST /api/publish` calls Anthropic to write the
  edition (requires `ANTHROPIC_API_KEY`) and emails it via Resend (requires
  `RESEND_API_KEY` + `DIGEST_EMAIL_FROM`/`DIGEST_EMAIL_TO`; pass
  `{"send_email":false}` to skip email). It also needs ≥5 candidate clusters
  from the last 24h, so run ingest first. The front page shows "No edition on
  the stands yet" until a successful publish.
- **Publisher's Desk** (`/desk`, API under `/api/desk*`, `/api/study-desk`) is a
  key-free interactive surface (cert track, grade ledger, Canvas ICS) — good for
  exercising the full React→Express→SQLite path without external services.
- SQLite runs `journal_mode=WAL` in development and writes `prints.db` +
  `prints-sessions.db` (both gitignored). Deleting them is safe; they are
  recreated/migrated/seeded on next boot.
