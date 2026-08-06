import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchEdition } from '../api.js';
import { EditionView } from './FrontPage.jsx';

export default function EditionPage() {
  const { date } = useParams();
  const [edition, setEdition] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setEdition(undefined);
    setError(null);
    fetchEdition(date)
      .then((data) => {
        if (!cancelled) setEdition(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (error) return <p className="error-state">{error}</p>;
  if (edition === undefined) return <p className="loading">Setting type…</p>;
  if (!edition) {
    return (
      <div className="sheet">
        <header className="masthead">
          <h1 className="masthead__brand">Fresh Prints</h1>
          <p className="masthead__banner">No edition for {date}.</p>
        </header>
        <p className="empty">
          <Link to="/">Back to the front page</Link>
        </p>
      </div>
    );
  }

  return <EditionView edition={edition} />;
}
