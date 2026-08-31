import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  fetchDesk,
  saveDeskSettings,
  addGrade,
  deleteGrade,
  fetchQuestionBank,
  reviewQuestion,
  draftQuestions,
} from '../api.js';
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

  // Question bank
  const [bank, setBank] = useState(undefined);
  const [bankStatus, setBankStatus] = useState('draft');
  const [drafting, setDrafting] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    fetchQuestionBank(bankStatus)
      .then((data) => {
        if (!cancelled) setBank(data);
      })
      .catch(() => {
        if (!cancelled) setBank(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bankStatus]);

  async function reloadBank() {
    try {
      setBank(await fetchQuestionBank(bankStatus));
    } catch {
      /* keep the last good view */
    }
  }

  async function handleReview(id, status) {
    try {
      await reviewQuestion(id, status);
      await reloadBank();
    } catch (err) {
      flash(`Error: ${err.message}`);
    }
  }

  async function handleDraft() {
    setDrafting(true);
    try {
      const res = await draftQuestions(25);
      flash(`Drafted ${res.drafted} questions for review.`);
      setBankStatus('draft');
      await reloadBank();
    } catch (err) {
      flash(`Drafting failed: ${err.message}`);
    } finally {
      setDrafting(false);
    }
  }

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
          The Examiner prints one question for the active cert with every edition, drawn from
          the approved bank below.
        </p>
      </section>

      <section className="desk-sec">
        <h2>Question Bank{bank?.cert ? ` — ${bank.cert}` : ''}</h2>
        <div className="desk-field qb-toolbar">
          <div className="qb-tabs" role="tablist">
            {['draft', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                type="button"
                className={`qb-tab${bankStatus === s ? ' qb-tab--on' : ''}`}
                onClick={() => setBankStatus(s)}
              >
                {s} {bank?.counts ? `(${bank.counts[s]})` : ''}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleDraft} disabled={drafting}>
            {drafting ? 'Drafting…' : 'Draft 25 more'}
          </button>
        </div>
        <p className="desk-hint">
          Drafts are machine-written in a batch and print only after you approve them here.
          The Examiner picks the approved question that has waited longest.
        </p>
        {bank === undefined ? (
          <p className="desk-hint">Opening the bank…</p>
        ) : bank === null ? (
          <p className="desk-hint">The bank didn&apos;t open. Reload the page to retry.</p>
        ) : bank.questions.length === 0 ? (
          <p className="desk-hint">
            {bankStatus === 'draft'
              ? 'No drafts waiting. Draft a batch when the approved pile runs low.'
              : `Nothing ${bankStatus} yet.`}
          </p>
        ) : (
          <ul className="qb-list">
            {bank.questions.map((q) => (
              <li key={q.id} className="qb-item">
                <p className="qb-item__meta">
                  No. {q.id}
                  {q.domain ? ` · ${q.domain}` : ''}
                  {q.answer_indices.length > 1 ? ' · multi-select' : ''}
                </p>
                <p className="qb-item__prompt">{q.prompt}</p>
                <ol className="qb-item__choices" type="A">
                  {q.choices.map((c, i) => (
                    <li key={c} className={q.answer_indices.includes(i) ? 'qb-right' : ''}>
                      {c}
                    </li>
                  ))}
                </ol>
                <p className="qb-item__explain">{q.explanation}</p>
                {q.source_url ? (
                  <a className="qb-item__source" href={q.source_url} target="_blank" rel="noreferrer">
                    {q.source_url}
                  </a>
                ) : (
                  <p className="qb-item__source qb-item__source--none">No source cited.</p>
                )}
                <div className="qb-item__actions">
                  {q.status !== 'approved' ? (
                    <button type="button" onClick={() => handleReview(q.id, 'approved')}>
                      Approve
                    </button>
                  ) : null}
                  {q.status !== 'rejected' ? (
                    <button
                      type="button"
                      className="qb-reject"
                      onClick={() => handleReview(q.id, 'rejected')}
                    >
                      Reject
                    </button>
                  ) : null}
                  {q.status === 'approved' ? (
                    <button
                      type="button"
                      className="qb-reject"
                      onClick={() => handleReview(q.id, 'retired')}
                    >
                      Retire
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
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
