import { titleSimilarity, TITLE_SIMILARITY_THRESHOLD } from './urls.js';

/**
 * Cluster items that share a canonical URL or highly similar titles.
 * Assigns cluster_id = min(id) in the cluster (stable, integer).
 * Updates the DB in place.
 */
export function clusterItems(db, itemIds) {
  if (!itemIds.length) return { clusters: 0 };

  const placeholders = itemIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, title, canonical_url, cluster_id FROM items WHERE id IN (${placeholders})`
    )
    .all(...itemIds);

  // Also compare against recent items (last 48h) so cross-ingest clustering works
  const recent = db
    .prepare(
      `SELECT id, title, canonical_url, cluster_id FROM items
       WHERE fetched_at >= datetime('now', '-48 hours')`
    )
    .all();

  const byId = new Map();
  for (const r of recent) byId.set(r.id, r);
  for (const r of rows) byId.set(r.id, r);
  const all = [...byId.values()];

  // Union-find
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x);
    while (p !== parent.get(p)) p = parent.get(p);
    parent.set(x, p);
    return p;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    // Prefer smaller id as root (stable cluster_id)
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  };

  // Seed with existing cluster membership
  for (const r of all) {
    find(r.id);
    if (r.cluster_id != null) union(r.id, r.cluster_id);
  }

  // Group by canonical URL
  const byCanon = new Map();
  for (const r of all) {
    const key = r.canonical_url;
    if (!byCanon.has(key)) byCanon.set(key, []);
    byCanon.get(key).push(r);
  }
  for (const group of byCanon.values()) {
    for (let i = 1; i < group.length; i++) union(group[0].id, group[i].id);
  }

  // Fuzzy title match across different canonical URLs
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].canonical_url === all[j].canonical_url) continue;
      if (find(all[i].id) === find(all[j].id)) continue;
      const sim = titleSimilarity(all[i].title, all[j].title);
      if (sim >= TITLE_SIMILARITY_THRESHOLD) union(all[i].id, all[j].id);
    }
  }

  const update = db.prepare(`UPDATE items SET cluster_id = ? WHERE id = ?`);
  const tx = db.transaction(() => {
    const roots = new Set();
    for (const r of all) {
      const root = find(r.id);
      roots.add(root);
      update.run(root, r.id);
    }
    return roots.size;
  });

  const clusters = tx();
  return { clusters };
}
