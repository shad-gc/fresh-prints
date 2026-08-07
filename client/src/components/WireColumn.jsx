import { hostOf, wireLeadIn } from '../lib/format.js';

/**
 * Dense wire list: bold lead-in phrase running into the sentence, small-caps
 * source slug at the end, dotted separators. Column stays a simple vertical
 * stack so later sidebar boxes can slot beneath it.
 */
export default function WireColumn({ items }) {
  if (!items?.length) return null;
  return (
    <section className="wire" aria-labelledby="wire-heading">
      <h2 id="wire-heading" className="section-head">
        The Wire
      </h2>
      <ul className="wire__list">
        {items.map((item) => {
          const [lead, rest] = wireLeadIn(item.blurb);
          return (
            <li key={`${item.source_url}-${item.blurb.slice(0, 24)}`}>
              <a href={item.source_url} target="_blank" rel="noreferrer">
                <strong>{lead}</strong>
                {rest}
              </a>{' '}
              <span className="wire__slug">{hostOf(item.source_url)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
