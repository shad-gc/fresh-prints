import { Link } from 'react-router';
import { formatDateline } from '../lib/format.js';
import MarketsTicker from './MarketsTicker.jsx';
import { WeatherEar, InfoEar } from './Ears.jsx';
import { LeadStory, SecondStory, IndustryStory } from './Stories.jsx';
import WireColumn from './WireColumn.jsx';
import StudyDesk from './StudyDesk.jsx';

/**
 * The full broadsheet template. Renders any edition — current or archived.
 * `edition.ticker` / `edition.weather` may be null (old editions, failed
 * fetches): those elements are simply absent.
 */
export default function Broadsheet({ edition, isFrontPage = false }) {
  const { payload } = edition;
  const stories = payload.top_stories || [];
  const lead = stories[0];
  const second = stories[1];
  const industry = stories.slice(2);

  return (
    <>
      <MarketsTicker items={edition.ticker} />
      <div className="sheet">
        <header className="masthead">
          <div className="masthead__row">
            <WeatherEar weather={edition.weather} />
            <Link to="/" className="brand">
              Fresh Prints
            </Link>
            <InfoEar editionNumber={edition.edition_number} />
          </div>
          <div className="rule-thickthin" />
          <div className="dateline">
            <span>{formatDateline(edition.edition_date)}</span>
            <span>Vol. 1, No. {edition.edition_number}</span>
          </div>
          <p className="deck">{payload.edition_title}</p>
          <nav className="navrow" aria-label="Edition navigation">
            {edition.prev_date ? (
              <Link to={`/edition/${edition.prev_date}`}>← Yesterday&apos;s edition</Link>
            ) : (
              <span />
            )}
            <Link to="/archive">Back Issues</Link>
          </nav>
        </header>

        <main className="body-grid">
          <div className="col col--main">
            <section aria-labelledby="top-heading">
              <h2 id="top-heading" className="section-head">
                Top Stories
              </h2>
              {lead ? <LeadStory story={lead} /> : null}
              {second ? (
                <>
                  <div className="rule-ink" />
                  <SecondStory story={second} />
                </>
              ) : null}
            </section>

            <section className="industry-section" aria-labelledby="industry-heading">
              <h2 id="industry-heading" className="section-head">
                The Industry
              </h2>
              {industry.map((s) => (
                <IndustryStory key={s.headline} story={s} />
              ))}
            </section>
          </div>

          <div className="col col--rail">
            <WireColumn items={payload.the_wire} />
            {isFrontPage ? <StudyDesk /> : null}
          </div>
        </main>

        <footer className="colophon">
          <div className="rule-double" />
          <div className="colophon__row">
            <span>
              Fresh Prints — printed by robots, read by one human
              {isFrontPage ? (
                <>
                  {' · '}
                  <Link to="/desk" className="colophon__desk">
                    Publisher&apos;s Desk
                  </Link>
                </>
              ) : null}
            </span>
            <span>No. {edition.edition_number}</span>
          </div>
        </footer>
      </div>
    </>
  );
}
