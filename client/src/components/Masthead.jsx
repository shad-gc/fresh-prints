import { Link } from 'react-router-dom';
import { formatDateline } from '../lib/format.js';

export default function Masthead({ editionDate, editionNumber, banner }) {
  return (
    <header className="masthead">
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <h1 className="masthead__brand">Fresh Prints</h1>
      </Link>
      <div className="masthead__meta">
        <span>{formatDateline(editionDate)}</span>
        <span>
          Vol. 1, No. {editionNumber}
        </span>
      </div>
      {banner ? <p className="masthead__banner">{banner}</p> : null}
    </header>
  );
}
