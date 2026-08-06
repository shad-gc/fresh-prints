import { config } from '../config.js';
import { canonicalizeUrl } from './urls.js';

/**
 * Fetch Reddit top-of-day JSON. Requires a polite User-Agent.
 * Note: Reddit frequently 403s datacenter IPs; Cloud Run / residential egress
 * usually works. Failures are soft (ingest continues with other sources).
 */
export async function fetchReddit(source) {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(25_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Reddit ${source.name}: HTTP ${res.status}`);
  const data = await res.json();
  const children = data?.data?.children || [];
  const fetchedAt = new Date().toISOString();
  const minPoints = source.min_points != null ? Number(source.min_points) : null;

  const items = [];
  for (const child of children) {
    const p = child?.data;
    if (!p || p.stickied) continue;
    const score = typeof p.score === 'number' ? p.score : 0;
    if (minPoints != null && score < minPoints) continue;

    // Prefer outbound link; fall back to permalink
    let url = p.url_overridden_by_dest || p.url;
    if (!url || url.includes('reddit.com/') || url.startsWith('/r/')) {
      url = p.permalink ? `https://www.reddit.com${p.permalink}` : null;
    }
    if (!url || !p.title) continue;

    const canonical = canonicalizeUrl(url);
    items.push({
      source_id: source.id,
      title: p.title,
      url,
      canonical_url: canonical,
      author: p.author || null,
      points: score,
      comments: typeof p.num_comments === 'number' ? p.num_comments : null,
      published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      fetched_at: fetchedAt,
    });
  }
  return items;
}
