import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEditionList } from '../api.js';
import { formatArchiveDate } from '../lib/format.js';

export default function ArchivePage() {
  const [searchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(null);
    fetchEditionList(page)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (error) return <p className="error-state">{error}</p>;
  if (data === undefined) return <p className="loading">Pulling the morgue files…</p>;

  return (
    <div className="sheet">
      <header className="masthead">
        <div className="masthead__row">
          <div className="ear ear--empty" aria-hidden="true" />
          <Link to="/" className="brand">
            Fresh Prints
          </Link>
          <div className="ear ear--empty" aria-hidden="true" />
        </div>
        <div className="rule-thickthin" />
        <p className="deck">Back Issues</p>
        <nav className="navrow" aria-label="Archive navigation">
          <Link to="/">← Front page</Link>
          <span className="archive__count">
            {data.total} edition{data.total === 1 ? '' : 's'}
          </span>
        </nav>
      </header>

      <ul className="archive__list">
        {data.editions.map((e) => (
          <li key={e.edition_date}>
            <Link to={`/edition/${e.edition_date}`}>
              <span className="archive__no">No. {e.edition_number}</span>
              <span className="archive__date">{formatArchiveDate(e.edition_date)}</span>
              <span className="archive__deck">{e.deck}</span>
            </Link>
          </li>
        ))}
      </ul>

      {data.total_pages > 1 ? (
        <nav className="archive__pager" aria-label="Archive pages">
          {page > 1 ? <Link to={`/archive?page=${page - 1}`}>← Newer</Link> : <span />}
          <span>
            Page {data.page} of {data.total_pages}
          </span>
          {page < data.total_pages ? <Link to={`/archive?page=${page + 1}`}>Older →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
