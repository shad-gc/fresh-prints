import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchDesk, saveDeskSettings, addGrade, deleteGrade } from '../api.js';
import { formatDue } from '../lib/format.js';

/**
 * The Publisher's Desk — the paper's back office. Cert tracking, semester
 * settings, the Canvas feed, and the grade ledger. Session-authed like
 * everything else; linked quietly from the front-page colophon.
 */
export default function DeskPage() {
  const [desk, setDesk] = useState(undefined);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  // Local form state
  const [activeCert, setActiveCert] = useState('');
  const [certList, setCertList] = useState([]);
  const [newCert, setNewCert] = useState('');
  const [currentClass, setCurrentClass] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [assignment, setAssignment] = useState('');
  const [score, setScore] = useState('');

  useEffect(() => {
    fetchDesk()
      .then((data) => {
        setDesk(data);
        setCertList(data.cert_list || []);
        setActiveCert(data.settings.active_cert || data.cert_list?.[0] || '');
        setCurrentClass(data.settings.current_class || '');
        setIcsUrl(data.settings.canvas_ics_url || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 4000);
  }

  async function reload() {
    const data = await fetchDesk();
    setDesk(data);
  }

  async function handleSaveSettings(patch, label) {
    try {
      const res = await saveDeskSettings(patch);
      if (res.ics_refresh && !res.ics_refresh.ok) {
        flash(`Saved, but the feed didn't load: ${res.ics_refresh.error}`);
      } else if (res.ics_refresh?.count != null) {
        flash(`Saved — ${res.ics_refresh.count} events on the calendar.`);
      } else {
        flash(label || 'Saved.');
      }
      await reload();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function handleAddCert() {
    const name = newCert.trim();
    if (!name || certList.includes(name)) return;
    const list = [...certList, name];
    setCertList(list);
    setNewCert('');
    await handleSaveSettings({ cert_list: list }, 'Cert added.');
  }

  async function handleAddGrade(e) {
    e.preventDefault();
    if (!assignment.trim() || !score.trim()) return;
    try {
      await addGrade(assignment, score);
      setAssignment('');
      setScore('');
      flash('Grade recorded.');
      await reload();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function handleDeleteGrade(id) {
    try {
      await deleteGrade(id);
      await reload();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  if (error) return <p className="error-state">{error}</p>;
  if (desk === undefined) return <p className="loading">Opening the desk…</p>;

  return (
    <div className="sheet sheet--desk">
      <header className="desk-mast">
        <h1>Publisher&apos;s Desk</h1>
        <Link to="/" className="desk-back">
          ← Front Page
        </Link>
      </header>

      {status ? <p className="desk-status">{status}</p> : null}

      <section className="desk-sec">
        <h2>Certification Track</h2>
        <div className="desk-field">
          <label htmlFor="active-cert">Studying for</label>
          <select
            id="active-cert"
            value={activeCert}
            onChange={(e) => setActiveCert(e.target.value)}
          >
            {certList.map((cert) => (
              <option key={cert} value={cert}>
                {cert}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleSaveSettings({ active_cert: activeCert }, 'Active cert set.')}
          >
            Set active
          </button>
        </div>
        <div className="desk-field">
          <label htmlFor="new-cert">Add to list</label>
          <input
            id="new-cert"
            type="text"
            value={newCert}
            placeholder="e.g. CompTIA Security+"
            onChange={(e) => setNewCert(e.target.value)}
          />
          <button type="button" onClick={handleAddCert}>
            Add
          </button>
        </div>
        <p className="desk-hint">
          Question banks and study prompts for the active cert arrive with the Daily Puzzle.
        </p>
      </section>

      <section className="desk-sec">
        <h2>Study Desk — OMSCS</h2>
        <div className="desk-field">
          <label htmlFor="current-class">This semester</label>
          <input
            id="current-class"
            type="text"
            value={currentClass}
            placeholder="e.g. CS 6035 — Intro to Information Security"
            onChange={(e) => setCurrentClass(e.target.value)}
          />
          <button
            type="button"
            onClick={() => handleSaveSettings({ current_class: currentClass }, 'Class saved.')}
          >
            Save
          </button>
        </div>
        <div className="desk-field">
          <label htmlFor="ics-url">Canvas feed</label>
          <input
            id="ics-url"
            type="url"
            value={icsUrl}
            placeholder="https://gatech.instructure.com/feeds/calendars/user_….ics"
            onChange={(e) => setIcsUrl(e.target.value)}
          />
          <button type="button" onClick={() => handleSaveSettings({ canvas_ics_url: icsUrl })}>
            Save
          </button>
        </div>
        <p className="desk-hint">
          Canvas → Account → Settings → &ldquo;Calendar feed&rdquo;. Refreshed hourly with the
          news ingest; deadlines land in the Study Desk box on the front page.
        </p>
        {desk.events.length ? (
          <ul className="desk-events">
            {desk.events.map((ev) => (
              <li key={`${ev.title}-${ev.due_at}`}>
                <span className="desk-events__title">{ev.title}</span>
                <span className="desk-events__due">{formatDue(ev.due_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="desk-sec">
        <h2>Grade Ledger</h2>
        <form className="desk-field" onSubmit={handleAddGrade}>
          <input
            type="text"
            aria-label="Assignment"
            value={assignment}
            placeholder="Assignment"
            onChange={(e) => setAssignment(e.target.value)}
          />
          <input
            type="text"
            aria-label="Score"
            className="desk-score"
            value={score}
            placeholder="94% / 18/20 / A"
            onChange={(e) => setScore(e.target.value)}
          />
          <button type="submit">Record</button>
        </form>
        {desk.grades.length ? (
          <table className="desk-ledger">
            <tbody>
              {desk.grades.map((g) => (
                <tr key={g.id}>
                  <td>{g.assignment}</td>
                  <td className="desk-ledger__score">{g.score}</td>
                  <td className="desk-ledger__date">{g.created_at.slice(0, 10)}</td>
                  <td>
                    <button
                      type="button"
                      className="desk-ledger__del"
                      aria-label={`Delete ${g.assignment}`}
                      onClick={() => handleDeleteGrade(g.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="desk-hint">Nothing graded yet. The ledger fills as the semester does.</p>
        )}
      </section>
    </div>
  );
}
