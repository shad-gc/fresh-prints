import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchEdition } from '../api.js';
import Broadsheet from '../components/Broadsheet.jsx';

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
          <div className="masthead__row">
            <div className="ear ear--empty" aria-hidden="true" />
            <span className="brand">Fresh Prints</span>
            <div className="ear ear--empty" aria-hidden="true" />
          </div>
          <div className="rule-thickthin" />
          <p className="deck">No edition for {date}.</p>
        </header>
        <p className="empty">
          <Link to="/archive">Back Issues</Link> · <Link to="/">Front page</Link>
        </p>
      </div>
    );
  }

  return <Broadsheet edition={edition} />;
}
