/** Local helper: POST /api/publish (dev skips identity token). */
const base = process.env.APP_URL || 'http://localhost:8080';
const editionDate = process.argv[2];
const body = editionDate ? { edition_date: editionDate } : {};
const res = await fetch(`${base}/api/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
if (!res.ok) process.exit(1);
