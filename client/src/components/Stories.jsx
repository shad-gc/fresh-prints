import { hostOf } from '../lib/format.js';

function SourceSlugs({ urls }) {
  if (!urls?.length) return null;
  return (
    <span className="story__slugs">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="slug">
          {hostOf(u)}
          {i < urls.length - 1 ? '' : ''}
        </a>
      ))}
    </span>
  );
}

/**
 * Shared story body: summary paragraph(s) + italic "Why it matters." lead,
 * ending with a filled-square end mark. `columns` flows the text in two
 * internal columns (lead + second story treatment).
 */
function StoryBody({ story, columns = false, dropCap = false }) {
  return (
    <div
      className={[
        'story__body',
        columns ? 'story__body--columns' : '',
        dropCap ? 'story__body--dropcap' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p>{story.summary}</p>
      <p className="story__why">
        <em>Why it matters.</em> {story.why_it_matters}{' '}
        <SourceSlugs urls={story.source_urls} />
        <span className="endmark" aria-hidden="true">
          {' '}
          ■
        </span>
      </p>
    </div>
  );
}

export function LeadStory({ story }) {
  const primary = story.source_urls?.[0];
  return (
    <article className="story story--lead">
      <span className="tag tag--lead">Lead</span>
      <h2 className="story__hl story__hl--lead">
        {primary ? (
          <a href={primary} target="_blank" rel="noreferrer">
            {story.headline}
          </a>
        ) : (
          story.headline
        )}
      </h2>
      <p className="story__deck">{story.why_it_matters}</p>
      <StoryBody story={story} columns dropCap />
    </article>
  );
}

export function SecondStory({ story }) {
  const primary = story.source_urls?.[0];
  return (
    <article className="story story--second">
      <h2 className="story__hl story__hl--second">
        {primary ? (
          <a href={primary} target="_blank" rel="noreferrer">
            {story.headline}
          </a>
        ) : (
          story.headline
        )}
      </h2>
      <StoryBody story={story} columns />
    </article>
  );
}

export function IndustryStory({ story }) {
  const primary = story.source_urls?.[0];
  return (
    <article className="story story--industry">
      <h2 className="story__hl story__hl--industry">
        {primary ? (
          <a href={primary} target="_blank" rel="noreferrer">
            {story.headline}
          </a>
        ) : (
          story.headline
        )}
      </h2>
      <StoryBody story={story} />
    </article>
  );
}
