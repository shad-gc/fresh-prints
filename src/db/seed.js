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
];

export function seedSources(db) {
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
  tx(SOURCES);
}

export { SOURCES };
