import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchStudyDesk } from '../api.js';
import { formatDue, dueRelative } from '../lib/format.js';

/**
 * Rail box under The Wire. Reads live data at page load rather than the
 * edition payload — deadlines shift mid-day, and archived editions
 * shouldn't embalm a stale "due in 2 days". Renders nothing on error:
 * the paper must never break because the desk hiccuped.
 */
export default function StudyDesk() {
  const [desk, setDesk] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchStudyDesk()
      .then((data) => {
        if (!cancelled) setDesk(data);
      })
      .catch(() => {
        if (!cancelled) setDesk(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (desk === undefined || desk === null) return null;

  const configured = desk.current_class || desk.ics_configured || desk.latest_grade;

  return (
    <section className="deskbox" aria-labelledby="deskbox-heading">
      <h2 id="deskbox-heading" className="deskbox__head">
        Study Desk
      </h2>
      <div className="deskbox__body">
        <div className="desk-row">
          <span className="k">Program</span>
          <span className="v">Georgia Tech OMSCS</span>
        </div>
        {configured ? (
          <>
            {desk.current_class ? (
              <div className="desk-row">
                <span className="k">This semester</span>
                <span className="v">{desk.current_class}</span>
              </div>
            ) : null}
            {desk.latest_grade ? (
              <div className="desk-row">
                <span className="k">Latest grade</span>
                <span className="v">
                  {desk.latest_grade.assignment} — {desk.latest_grade.score}
                </span>
              </div>
            ) : null}
            {desk.next_event ? (
              <div className="desk-due">
                <div className="due-head">Next deadline</div>
                <strong>{desk.next_event.title}</strong>
                <br />
                {formatDue(desk.next_event.due_at)} — {dueRelative(desk.next_event.due_at)}
              </div>
            ) : desk.ics_configured ? (
              <p className="desk-empty">Nothing on the calendar. Enjoy it while it lasts.</p>
            ) : null}
          </>
        ) : (
          <p className="desk-empty">
            Awaiting enrollment. Class and deadlines appear here once set at the{' '}
            <Link to="/desk">Publisher&apos;s Desk</Link>.
          </p>
        )}
      </div>
    </section>
  );
}
