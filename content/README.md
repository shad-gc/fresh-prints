# content/

Repo-reviewed content. These files ship inside the container image, so
changing them means opening a pull request — the PR diff **is** the
editorial review. No model writes anything here at runtime.

CI runs `node scripts/validate-content.js` on every PR that touches this
directory; a file that would be rejected or silently dropped at runtime
fails the check.

## desk.json

Feeds the Study Desk box on the front page.

```json
{
  "active_cert": "Associate Google Workspace Administrator",
  "current_class": "CS 6035 — Intro to Information Security",
  "calendar_filter": "CS-6035",
  "grades": [{ "assignment": "Project 1", "score": "98/100" }]
}
```

- `active_cert` — cert the Examiner draws questions for. Its slug
  (lowercased, non-alphanumerics → `-`) must match `cert_slug` on
  questions you want in rotation.
- `current_class` — display string or `null` before enrollment.
- `calendar_filter` — optional. Canvas event titles end with their source
  calendar in brackets (`Exam 1 [CS-6035-O01, …]`, `Labor Day [OMSCS
  Student Center]`). When set, only events whose bracket tag contains this
  string (case-insensitive) reach the Study Desk — filters out institute
  holidays and other-calendar noise. `null` or omitted → keep everything.
  Events without a bracket tag are always kept.
- `grades` — append new entries at the end; the box shows the **last**
  entry as "Latest grade". Kept as a full array so the box can grow a
  history view later.

Calendar deadlines are **not** configured here. The Canvas ICS feed URL
contains a personal token and lives in Secret Manager, injected as the
`STUDY_DESK_ICS_URL` env var at deploy. Never commit that URL.

## examiner-questions.json

The Examiner's question bank. An array of:

```json
{
  "key": "agwa-001",
  "cert_slug": "associate-google-workspace-administrator",
  "domain": "Managing user accounts, domains, and Directory",
  "prompt": "At least 20 characters…",
  "choices": ["exactly", "four", "answer", "strings"],
  "answer_indices": [1],
  "explanation": "At least 20 characters…",
  "source_url": null
}
```

- `key` — stable slug (3–64 chars, `a-z0-9-`), unique across the file.
  Never reuse a key for a different question; retire the old one by
  deleting it and add a new key.
- `answer_indices` — 0-based indices into `choices`; usually one entry.
- `source_url` — optional link to official docs; omit or `null` if none.

On boot after each deploy (and before each publish), the app diffs this
file against the database: new keys are inserted as approved, edited
questions are updated in place, and keys removed from the file are
retired — never deleted, so past editions keep their questions.

### AGWA blueprint weighting (25 questions)

| Domain | Weight | Count |
|---|---|---|
| Managing user accounts, domains, and Directory | 20% | 5 |
| Managing core Workspace services | 23% | 6 |
| Managing data governance and compliance | 15% | 4 |
| Managing security policies and access controls | 20% | 5 |
| Managing browsers and endpoints | 10% | 2 |
| Monitoring and troubleshooting common issues | 13% | 3 |
