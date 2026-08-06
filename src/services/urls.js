/**
 * Canonicalize URLs for dedupe: strip tracking params, fragments, trailing slash,
 * normalize host to lowercase, prefer https.
 */
export function canonicalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol === 'http:') url.protocol = 'https:';

  const drop = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'ref',
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid',
    'si',
  ];
  for (const key of drop) url.searchParams.delete(key);

  // Sort remaining params for stability
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [k, v] of entries) url.searchParams.append(k, v);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

/** Normalize title for fuzzy comparison. */
export function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similarity on normalized titles: max of bigram Dice and token Jaccard.
 * Returns 0..1.
 */
export function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const wordsA = na.split(' ').filter(Boolean);
  const wordsB = nb.split(' ').filter(Boolean);

  const tokenJaccard = () => {
    const ta = new Set(wordsA);
    const tb = new Set(wordsB);
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return inter / (ta.size + tb.size - inter || 1);
  };

  const bigramDice = () => {
    if (wordsA.length < 2 || wordsB.length < 2) return 0;
    const A = new Set();
    const B = new Set();
    for (let i = 0; i < wordsA.length - 1; i++) A.add(`${wordsA[i]} ${wordsA[i + 1]}`);
    for (let i = 0; i < wordsB.length - 1; i++) B.add(`${wordsB[i]} ${wordsB[i + 1]}`);
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    return (2 * inter) / (A.size + B.size);
  };

  return Math.max(tokenJaccard(), bigramDice());
}

export const TITLE_SIMILARITY_THRESHOLD = 0.72;
