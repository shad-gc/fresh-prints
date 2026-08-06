import { XMLParser } from 'fast-xml-parser';
import { config } from '../config.js';
import { canonicalizeUrl } from './urls.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: {
    enabled: true,
    maxEntityCount: 100_000,
    maxEntitySize: 50_000,
    maxExpansionDepth: 20,
    maxTotalExpansions: 100_000,
  },
  isArray: (name) => ['item', 'entry', 'link', 'category'].includes(name),
});

/** Drop ancient feed backlog so re-fetches do not flood the 24h candidate window. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    if (node['#text'] != null) return String(node['#text']);
    if (node['@_href']) return String(node['@_href']);
  }
  return '';
}

function pickLink(entry) {
  const links = asArray(entry.link);
  if (!links.length) return textOf(entry.id) || textOf(entry.guid) || '';
  // Prefer rel=alternate
  const alt = links.find((l) => typeof l === 'object' && l['@_rel'] === 'alternate');
  if (alt) return alt['@_href'] || textOf(alt);
  const first = links[0];
  if (typeof first === 'string') return first;
  return first['@_href'] || textOf(first);
}

function pickDate(entry) {
  return (
    textOf(entry.pubDate) ||
    textOf(entry.published) ||
    textOf(entry.updated) ||
    textOf(entry['dc:date']) ||
    null
  );
}

function pickAuthor(entry) {
  const a = entry.author || entry['dc:creator'] || entry.creator;
  if (!a) return null;
  if (typeof a === 'string') return a;
  return textOf(a.name) || textOf(a) || null;
}

/**
 * Fetch and parse an RSS or Atom feed into normalized items.
 */
export async function fetchRss(source) {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`RSS ${source.name}: HTTP ${res.status}`);
  }
  const xml = await res.text();
  const doc = parser.parse(xml);

  let entries = [];
  if (doc.rss?.channel) {
    entries = asArray(doc.rss.channel.item);
  } else if (doc.feed) {
    entries = asArray(doc.feed.entry);
  } else if (doc.channel) {
    entries = asArray(doc.channel.item);
  }

  const fetchedAt = new Date().toISOString();
  const cutoff = Date.now() - MAX_AGE_MS;
  const items = [];
  for (const entry of entries) {
    const title = textOf(entry.title).trim();
    const url = pickLink(entry).trim();
    if (!title || !url) continue;
    const canonical = canonicalizeUrl(url);
    if (!canonical) continue;
    const rawDate = pickDate(entry);
    let publishedAt = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) {
        if (d.getTime() < cutoff) continue;
        publishedAt = d.toISOString();
      }
    }
    items.push({
      source_id: source.id,
      title,
      url,
      canonical_url: canonical,
      author: pickAuthor(entry),
      points: null,
      comments: null,
      published_at: publishedAt,
      fetched_at: fetchedAt,
    });
  }
  return items;
}
