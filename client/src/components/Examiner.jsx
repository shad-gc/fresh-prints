import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPuzzle, submitPuzzleAttempt } from '../api.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * The Examiner — one certification question per edition, printed in the rail
 * under the Study Desk. The answer is at the foot of the box, upside down,
 * exactly like a real paper's puzzle corner. Committing to an answer is what
 * unlocks the explanation and the source.
 *
 * Same posture as the Study Desk: renders nothing on error or when the bank
 * is dry for this edition. The paper never breaks over a puzzle.
 */
export default function Examiner({ editionDate }) {
  const [puzzle, setPuzzle] = useState(undefined);
  const [picked, setPicked] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPuzzle(undefined);
    setPicked([]);
    if (!editionDate) {
      setPuzzle(null);
      return undefined;
    }
    fetchPuzzle(editionDate)
      .then((data) => {
        // 404 means no question was pinned to this edition — show the dry-bank
        // note. A network/server error hides the box entirely.
        if (!cancelled) setPuzzle(data === null ? 'empty' : data);
      })
      .catch(() => {
        if (!cancelled) setPuzzle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editionDate]);

  if (puzzle === undefined || puzzle === null) return null;
  if (puzzle === 'empty') return <ExaminerEmpty />;

  async function commit(indices) {
    if (submitting || puzzle.answered) return;
    setSubmitting(true);
    try {
      const res = await submitPuzzleAttempt(editionDate, indices);
      if (res?.view) setPuzzle(res.view);
    } catch {
      /* leave the box interactive; a failed write shouldn't eat the guess */
    } finally {
      setSubmitting(false);
    }
  }

  function togglePick(i) {
    setPicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  const answered = puzzle.answered;
  const answers = puzzle.answer_indices || [];
  const chosen = puzzle.chosen_indices || [];
  const answerLetters = answers.map((i) => LETTERS[i]).join(', ');

  function choiceClass(i) {
    if (!answered) return 'exam-choice';
    const isAnswer = answers.includes(i);
    const wasChosen = chosen.includes(i);
    if (isAnswer) return 'exam-choice exam-choice--right';
    if (wasChosen) return 'exam-choice exam-choice--wrong';
    return 'exam-choice exam-choice--dim';
  }

  return (
    <section className="deskbox exambox" aria-labelledby="exambox-heading">
      <h2 id="exambox-heading" className="deskbox__head exambox__head">
        <span>The Examiner</span>
        {puzzle.streak > 0 ? (
          <span className="exambox__streak">streak {puzzle.streak}</span>
        ) : null}
      </h2>
      <div className="deskbox__body">
        <p className="exam-meta">
          {puzzle.cert_name || 'Certification'}
          {puzzle.domain ? ` · ${puzzle.domain}` : ''}
        </p>
        <p className="exam-prompt">{puzzle.prompt}</p>

        <ul className="exam-choices">
          {puzzle.choices.map((choice, i) => (
            <li key={choice}>
              {answered ? (
                <span className={choiceClass(i)}>
                  <span className="exam-choice__letter">{LETTERS[i]}</span>
                  {choice}
                </span>
              ) : puzzle.multi_select ? (
                <label className={`exam-choice exam-choice--pickable${picked.includes(i) ? ' exam-choice--picked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={picked.includes(i)}
                    onChange={() => togglePick(i)}
                  />
                  <span className="exam-choice__letter">{LETTERS[i]}</span>
                  {choice}
                </label>
              ) : (
                <button
                  type="button"
                  className="exam-choice exam-choice--pickable"
                  disabled={submitting}
                  onClick={() => commit([i])}
                >
                  <span className="exam-choice__letter">{LETTERS[i]}</span>
                  {choice}
                </button>
              )}
            </li>
          ))}
        </ul>

        {!answered && puzzle.multi_select ? (
          <button
            type="button"
            className="exam-commit"
            disabled={submitting || picked.length === 0}
            onClick={() => commit([...picked].sort((a, b) => a - b))}
          >
            Commit answer
          </button>
        ) : null}

        {answered ? (
          <div className={`exam-verdict ${puzzle.was_correct ? 'exam-verdict--right' : 'exam-verdict--wrong'}`}>
            <strong>
              {puzzle.was_correct
                ? `Correct — streak ${puzzle.streak}`
                : 'Incorrect — streak reset'}
            </strong>
            {puzzle.explanation ? <p>{puzzle.explanation}</p> : null}
            {puzzle.source_url ? (
              <a href={puzzle.source_url} target="_blank" rel="noreferrer">
                Source: official documentation
              </a>
            ) : null}
          </div>
        ) : null}

        <p className="exam-answer" aria-hidden="true">
          Ans: {answerLetters}
        </p>
      </div>
    </section>
  );
}

/**
 * Empty-state variant used when today's edition has no assigned question.
 * Exported separately so the Broadsheet can decide whether to nudge.
 */
export function ExaminerEmpty() {
  return (
    <section className="deskbox exambox" aria-labelledby="exambox-heading">
      <h2 id="exambox-heading" className="deskbox__head">
        The Examiner
      </h2>
      <div className="deskbox__body">
        <p className="desk-empty">
          The bank is dry. Approve questions at the{' '}
          <Link to="/desk">Publisher&apos;s Desk</Link> and the Examiner returns tomorrow.
        </p>
      </div>
    </section>
  );
}
