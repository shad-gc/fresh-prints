# AGENTS.md

## Cursor Cloud specific instructions

Fresh Prints is a single-process app: an Express API (`src/index.js`) that also
serves the built React SPA from `client/dist`. SQLite (`better-sqlite3`) is
embedded — there is **no separate database/service to start**, no docker-compose,
and no message queue. The DB file is auto-created, migrated, and seeded on boot.

Standard commands live in `package.json` / `README.md` / `client/package.json`.
Notes below are the non-obvious bits for running/testing here.

### Running the app
- `npm run dev` starts the server on port `8080` (`node --watch`, hot-reload) and
  serves the pre-built client. The client is **not** rebuilt automatically — after
  changing anything under `client/src`, run `npm run build` (or run the Vite HMR
  dev server with `npm run dev:client` on port `5173`, which proxies `/api`,
  `/auth`, `/health` to `:8080`).
- A local `.env` is required (copy from `.env.example`). For local dev without
  GitHub OAuth, set `DEV_BYPASS_AUTH=1` in `.env` — otherwise the UI is gated by
  GitHub OAuth + a username allowlist. The update script does not create `.env`.
- In `NODE_ENV=development`, `/api/ingest` and `/api/publish` **skip** the GCP
  identity-token check, so you can trigger them directly with `curl` (no auth).

### Testing / lint / build
- Test: `npm run selftest` (the only automated test; unit checks for URL
  canonicalization, clustering, edition schema, invoker pinning). There is **no
  test runner** (jest/vitest) and **no lint config** (eslint/prettier) in this repo.
- Build: `npm run build` (Vite build of the client into `client/dist`).

### Core flows & external-API caveats
- Ingest (`curl -X POST http://localhost:8080/api/ingest`) pulls real news from
  RSS + Hacker News + Reddit and clusters them — works with no API keys. Reddit
  JSON endpoints commonly return HTTP 403 from cloud IPs; this is best-effort and
  non-fatal (other sources still ingest).
- Publish (`curl -X POST http://localhost:8080/api/publish`) requires a valid
  `ANTHROPIC_API_KEY` to generate an edition; the email step additionally needs
  `RESEND_API_KEY` + `DIGEST_EMAIL_*`. Without these, the web UI shows the empty
  "No edition on the stands yet." state (ingest still populates `items`).
- `better-sqlite3` is a native module; rebuilding it needs `python3` + a C/C++
  toolchain (already present on the VM).
