/** Local helper: POST /api/ingest (dev skips identity token). */
const base = process.env.APP_URL || 'http://localhost:8080';
const res = await fetch(`${base}/api/ingest`, { method: 'POST' });
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
if (!res.ok) process.exit(1);
