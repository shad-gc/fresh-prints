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
  "current_class": "CS 6035 — Intro to Information Security",
  "calendar_filter": "CS-6035",
  "grades": [{ "assignment": "Project 1", "score": "98/100" }]
}
```

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
