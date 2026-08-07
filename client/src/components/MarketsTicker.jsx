/**
 * Black full-width ribbon of last closes. `items` comes from the edition's
 * stored snapshot; null/empty (old editions, failed fetch) renders nothing.
 */
export default function MarketsTicker({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="ticker" role="doc-pullquote" aria-label="Markets at yesterday's close">
      <span className="ticker__label">Markets — at yesterday&apos;s close</span>
      {items.map((q) => {
        const up = q.change_pct >= 0;
        return (
          <span key={q.symbol} className="ticker__item">
            <span className="ticker__symbol">{q.symbol}</span>{' '}
            {q.close.toFixed(2)}{' '}
            <span className={up ? 'ticker__up' : 'ticker__down'}>
              {up ? '▲' : '▼'} {Math.abs(q.change_pct).toFixed(2)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}
