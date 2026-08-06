/**
 * Lightweight self-checks for URL canonicalization + title clustering.
 * Run: node scripts/selftest.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { canonicalizeUrl, titleSimilarity, normalizeTitle } from '../src/services/urls.js';
import { clusterItems } from '../src/services/cluster.js';
import { runMigrations } from '../src/db/migrate.js';
import { validateEditionPayload } from '../src/services/anthropic.js';

// --- URL canonicalization ---
assert.equal(
  canonicalizeUrl('https://www.Example.com/path/?utm_source=x&b=2&a=1#frag'),
  'https://example.com/path?a=1&b=2'
);
assert.equal(
  canonicalizeUrl('http://news.ycombinator.com/item?id=1'),
  'https://news.ycombinator.com/item?id=1'
);

// --- Title similarity ---
assert.ok(titleSimilarity('OpenAI releases GPT-5', 'OpenAI Releases GPT-5') === 1);
assert.ok(
  titleSimilarity(
    'Cloudflare outage takes down large swath of the internet',
    'Cloudflare outage knocks large swath of internet offline'
  ) >= 0.5
);
assert.ok(normalizeTitle("It's Alive!") === 'its alive');

// --- Clustering: same story across HN + Techmeme + reddit → one cluster ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
const dbPath = path.join(tmp, 'test.db');
const db = new Database(dbPath);
runMigrations(db);

db.prepare(
  `INSERT INTO sources (id, name, type, url, enabled) VALUES
   (1,'HN','hn','https://example.test',1),
   (2,'Techmeme','rss','https://example.test',1),
   (3,'r/technology','reddit','https://example.test',1)`
).run();

const insert = db.prepare(
  `INSERT INTO items (source_id, title, url, canonical_url, fetched_at)
   VALUES (?, ?, ?, ?, datetime('now'))`
);

const titles = [
  [1, 'Acme Corp discloses major IAM breach affecting cloud tenants', 'https://hn.example/1', 'https://acme.example/breach'],
  [2, 'Acme Corp discloses major IAM breach affecting cloud tenants', 'https://techmeme.example/x', 'https://acme.example/breach'],
  [3, 'Acme discloses major IAM breach affecting cloud tenants', 'https://reddit.com/r/x', 'https://reddit.com/r/technology/comments/abc'],
];
const ids = titles.map((t) => insert.run(...t).lastInsertRowid);

const { clusters } = clusterItems(db, ids);
const clusterIds = db
  .prepare(`SELECT DISTINCT cluster_id FROM items WHERE id IN (${ids.join(',')})`)
  .all()
  .map((r) => r.cluster_id);

assert.equal(clusterIds.length, 1, 'expected a single cluster across three sources');
assert.ok(clusters >= 1);

// --- Edition schema validation ---
const good = {
  edition_title: 'Clouds Gather Over Identity',
  top_stories: Array.from({ length: 5 }, (_, i) => ({
    headline: `Story ${i}`,
    summary: 'Something happened. Then more happened.',
    why_it_matters: 'It touches IAM.',
    source_urls: ['https://example.com/a'],
  })),
  the_wire: Array.from({ length: 10 }, (_, i) => ({
    blurb: `Wire ${i}.`,
    source_url: 'https://example.com/w',
  })),
};
validateEditionPayload(good);

let threw = false;
try {
  validateEditionPayload({ ...good, top_stories: good.top_stories.slice(0, 3) });
} catch {
  threw = true;
}
assert.ok(threw, 'short top_stories must fail validation');

db.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('selftest ok');
