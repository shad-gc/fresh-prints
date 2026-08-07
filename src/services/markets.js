import YahooFinance from 'yahoo-finance2';

const SYMBOLS = ['SPUS', 'SPTE', 'SPRE', 'SPWO'];
const FETCH_TIMEOUT_MS = 8_000;

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function fetchSymbol(symbol) {
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
  const result = await yahooFinance.chart(
    symbol,
    { period1: tenDaysAgo, interval: '1d' },
    { fetchOptions: { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) } }
  );
  const closes = (result.quotes || []).filter((q) => q.close != null).map((q) => q.close);
  if (closes.length < 2) {
    throw new Error(`only ${closes.length} closes returned`);
  }
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  return {
    symbol,
    close: Number(last.toFixed(2)),
    change_pct: Number((((last - prev) / prev) * 100).toFixed(2)),
  };
}

/**
 * Snapshot of last closes for the ticker ribbon, taken at publish time.
 * NEVER throws and never delays publish beyond its own timeouts: failed
 * symbols are omitted; if every symbol fails, returns null and the edition
 * publishes without a ribbon.
 */
export async function fetchTickerSnapshot() {
  const settled = await Promise.allSettled(SYMBOLS.map((s) => fetchSymbol(s)));
  const items = [];
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      items.push(res.value);
    } else {
      console.warn(`[markets] ${SYMBOLS[i]} failed: ${res.reason?.message || res.reason}`);
    }
  });
  if (!items.length) {
    console.warn('[markets] all symbols failed — publishing without ticker');
    return null;
  }
  return items;
}
