import { hostOf } from '../lib/format.js';

export default function TopStory({ story, lead = false }) {
  const primary = story.source_urls?.[0];
  return (
    <article className={`story ${lead ? 'story--lead' : 'story--secondary'}`}>
      {lead ? <p className="story__kicker">Lead</p> : null}
      <h2 className="story__headline">
        {primary ? <a href={primary} target="_blank" rel="noreferrer">{story.headline}</a> : story.headline}
      </h2>
      <p className="story__summary">{story.summary}</p>
      <p className="story__why">
        <strong>Why it matters.</strong> {story.why_it_matters}
      </p>
      {story.source_urls?.length ? (
        <ul className="story__sources">
          {story.source_urls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer">
                {hostOf(u)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
