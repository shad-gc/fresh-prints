import { config } from '../config.js';
import { canonicalizeUrl } from './urls.js';

const HN_ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

/**
 * Fetch top 30 HN stories with score + comment count.
 */
export async function fetchHackerNews(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': config.userAgent },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HN: HTTP ${res.status}`);
  const ids = await res.json();
  const top = (ids || []).slice(0, 30);

  const fetchedAt = new Date().toISOString();
  const items = [];

  // Modest concurrency
  const chunkSize = 10;
  for (let i = 0; i < top.length; i += chunkSize) {
    const chunk = top.slice(i, i + chunkSize);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        const r = await fetch(HN_ITEM(id), {
          headers: { 'User-Agent': config.userAgent },
          signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok) return null;
        return r.json();
      })
    );
    for (const story of rows) {
      if (!story || story.type !== 'story' || !story.title || !story.url) continue;
      const canonical = canonicalizeUrl(story.url);
      items.push({
        source_id: source.id,
        title: story.title,
        url: story.url,
        canonical_url: canonical,
        author: story.by || null,
        points: typeof story.score === 'number' ? story.score : null,
        comments: typeof story.descendants === 'number' ? story.descendants : null,
        published_at: story.time ? new Date(story.time * 1000).toISOString() : null,
        fetched_at: fetchedAt,
      });
    }
  }
  return items;
}
