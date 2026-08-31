/**
 * Seed / upsert news sources. Safe to re-run — updates URL/tuning by name,
 * does not wipe user-added sources.
 *
 * Anthropic News: no official RSS/Atom feed as of 2026 — seeded disabled.
 */
const SOURCES = [
  // Aggregators / social
  {
    name: 'Techmeme',
    type: 'rss',
    url: 'https://www.techmeme.com/feed.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: 'Hacker News',
    type: 'hn',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: 'r/technology',
    type: 'reddit',
    url: 'https://www.reddit.com/r/technology/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 100,
    is_vendor: 0,
  },
  {
    name: 'r/sysadmin',
    type: 'reddit',
    url: 'https://www.reddit.com/r/sysadmin/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 150,
    is_vendor: 0,
  },
  {
    name: 'r/netsec',
    type: 'reddit',
    url: 'https://www.reddit.com/r/netsec/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 50,
    is_vendor: 0,
  },
  {
    name: 'r/googlecloud',
    type: 'reddit',
    url: 'https://www.reddit.com/r/googlecloud/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 50,
    is_vendor: 0,
  },
  {
    name: 'r/devops',
    type: 'reddit',
    url: 'https://www.reddit.com/r/devops/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 50,
    is_vendor: 0,
  },
  {
    name: 'r/LocalLLaMA',
    type: 'reddit',
    url: 'https://www.reddit.com/r/LocalLLaMA/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 50,
    is_vendor: 0,
  },
  {
    name: 'r/selfhosted',
    type: 'reddit',
    url: 'https://www.reddit.com/r/selfhosted/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 50,
    is_vendor: 0,
  },
  {
    name: 'r/programming',
    type: 'reddit',
    url: 'https://www.reddit.com/r/programming/top.json?t=day&limit=25',
    enabled: 1,
    min_points: 100,
    is_vendor: 0,
  },

  // Editorial RSS
  {
    name: 'The Verge',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: 'Ars Technica',
    type: 'rss',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: 'TechCrunch',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: "Simon Willison's Weblog",
    type: 'rss',
    url: 'https://simonwillison.net/atom/everything/',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    name: 'Krebs on Security',
    type: 'rss',
    url: 'https://krebsonsecurity.com/feed/',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },

  // Vendor / product blogs
  {
    // No official Anthropic RSS/Atom feed — do not scrape HTML.
    name: 'Anthropic News',
    type: 'rss',
    url: 'https://www.anthropic.com/news',
    enabled: 0,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'OpenAI News',
    type: 'rss',
    url: 'https://openai.com/news/rss.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'Cloudflare Blog',
    type: 'rss',
    url: 'https://blog.cloudflare.com/rss/',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'Tailscale Blog',
    type: 'rss',
    url: 'https://tailscale.com/blog/index.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'Home Assistant Blog',
    type: 'rss',
    url: 'https://www.home-assistant.io/atom.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },

  // v2: builder/operator sources for The Wire
  {
    name: 'Docker Blog',
    type: 'rss',
    url: 'https://www.docker.com/blog/feed/',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'HashiCorp Blog',
    type: 'rss',
    url: 'https://www.hashicorp.com/blog/feed.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    name: 'Grafana Blog',
    type: 'rss',
    url: 'https://grafana.com/blog/index.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 1,
  },
  {
    // Personal blog — same class as Simon Willison, not a vendor feed
    name: 'Jeff Geerling',
    type: 'rss',
    url: 'https://www.jeffgeerling.com/blog.xml',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
  {
    // Forrest Brazeal's "Good Tech Things"
    name: 'Good Tech Things',
    type: 'rss',
    url: 'https://www.goodtechthings.com/rss/',
    enabled: 1,
    min_points: null,
    is_vendor: 0,
  },
];

export function seedSources(db) {
  // Boot must be read-only in steady state (see migrate.js). Only touch the
  // DB when a source is genuinely missing or drifted from code.
  const existing = new Map(
    db
      .prepare(`SELECT name, type, url, is_vendor FROM sources`)
      .all()
      .map((r) => [r.name, r])
  );
  const dirty = SOURCES.filter((s) => {
    const row = existing.get(s.name);
    return !row || row.type !== s.type || row.url !== s.url || row.is_vendor !== s.is_vendor;
  });
  if (dirty.length === 0) return false;

  // On conflict: refresh type/url/is_vendor from code, but preserve
  // enabled + min_points so operator tuning in the DB survives restarts.
  const upsert = db.prepare(`
    INSERT INTO sources (name, type, url, enabled, min_points, is_vendor)
    VALUES (@name, @type, @url, @enabled, @min_points, @is_vendor)
    ON CONFLICT(name) DO UPDATE SET
      type = excluded.type,
      url = excluded.url,
      is_vendor = excluded.is_vendor
  `);

  const tx = db.transaction((rows) => {
    for (const row of rows) upsert.run(row);
  });
  tx(dirty);
  console.log(`[db] seeded/updated ${dirty.length} source(s)`);
  return true;
}

export { SOURCES };
