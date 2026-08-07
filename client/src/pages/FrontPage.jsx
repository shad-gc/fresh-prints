import { useEffect, useState } from 'react';
import { fetchLatestEdition } from '../api.js';
import Broadsheet from '../components/Broadsheet.jsx';

export default function FrontPage() {
  const [edition, setEdition] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestEdition()
      .then((data) => {
        if (!cancelled) setEdition(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <p className="deck">No edition on the stands yet.</p>
        </header>
        <p className="empty">Run ingest, then publish. The morning edition lands at 6am Pacific.</p>
      </div>
    );
  }

  return <Broadsheet edition={edition} />;
}
