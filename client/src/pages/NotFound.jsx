import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="not-found">
      <div>
        <h1>
          Now this is a story all about how this page got flipped-turned upside down
        </h1>
        <Link to="/">Back to the front page</Link>
      </div>
    </div>
  );
}
