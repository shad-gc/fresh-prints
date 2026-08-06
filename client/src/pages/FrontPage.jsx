import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLatestEdition } from '../api.js';
import Masthead from '../components/Masthead.jsx';
import DateNav from '../components/DateNav.jsx';
import TopStory from '../components/TopStory.jsx';
import TheWire from '../components/TheWire.jsx';

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
          <h1 className="masthead__brand">Fresh Prints</h1>
          <p className="masthead__banner">No edition on the stands yet.</p>
        </header>
        <p className="empty">
          Run ingest, then publish. Or check back after the morning edition lands.
        </p>
      </div>
    );
  }

  return <EditionView edition={edition} />;
}

export function EditionView({ edition }) {
  const stories = edition.payload.top_stories || [];
  const [lead, ...rest] = stories;
  const secondary = rest.slice(0, 2);
  const tertiary = rest.slice(2);

  return (
    <div className="sheet">
      <Masthead
        editionDate={edition.edition_date}
        editionNumber={edition.edition_number}
        banner={edition.payload.edition_title}
      />
      <DateNav prevDate={edition.prev_date} nextDate={edition.next_date} />

      <div className="section-rule">Top Stories</div>
      <div className="front">
        {lead ? (
          <div className="front__lead">
            <TopStory story={lead} lead />
          </div>
        ) : null}
        <div className="front__secondary">
          {secondary.map((s) => (
            <TopStory key={s.headline} story={s} />
          ))}
          {tertiary.map((s) => (
            <TopStory key={s.headline} story={s} />
          ))}
        </div>
        <div className="front__rail">
          <TheWire items={edition.payload.the_wire} />
        </div>
      </div>

      <p style={{ marginTop: '2.5rem', fontSize: '0.85rem', textAlign: 'center', color: '#555' }}>
        <Link to={`/edition/${edition.edition_date}`}>Permalink</Link>
        {' · '}
        <a href="/auth/logout">Sign out</a>
      </p>
    </div>
  );
}
