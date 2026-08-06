import { Link } from 'react-router-dom';

export default function DateNav({ prevDate, nextDate }) {
  return (
    <nav className="date-nav" aria-label="Edition navigation">
      {prevDate ? (
        <Link to={`/edition/${prevDate}`}>← Yesterday&apos;s edition</Link>
      ) : (
        <span className="date-nav__spacer">← Yesterday&apos;s edition</span>
      )}
      {nextDate ? <Link to={`/edition/${nextDate}`}>Next edition →</Link> : <span />}
    </nav>
  );
}
