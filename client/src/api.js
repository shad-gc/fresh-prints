export async function fetchLatestEdition() {
  const res = await fetch('/api/editions/latest');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load edition (${res.status})`);
  return res.json();
}

export async function fetchEdition(date) {
  const res = await fetch(`/api/editions/${date}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load edition (${res.status})`);
  return res.json();
}

export async function fetchEditionList(page = 1) {
  const res = await fetch(`/api/editions?page=${page}`);
  if (!res.ok) throw new Error(`Failed to load archive (${res.status})`);
  return res.json();
}

// ---------- Publisher's Desk ----------

async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function fetchStudyDesk() {
  return jsonOrThrow(await fetch('/api/study-desk'));
}

export async function fetchDesk() {
  return jsonOrThrow(await fetch('/api/desk'));
}

export async function saveDeskSettings(patch) {
  return jsonOrThrow(
    await fetch('/api/desk/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  );
}

export async function addGrade(assignment, score) {
  return jsonOrThrow(
    await fetch('/api/desk/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment, score }),
    })
  );
}

export async function deleteGrade(id) {
  return jsonOrThrow(await fetch(`/api/desk/grades/${id}`, { method: 'DELETE' }));
}

// ---------- The Examiner ----------

export async function fetchPuzzle(date) {
  const res = await fetch(`/api/puzzle/${date}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load puzzle (${res.status})`);
  return res.json();
}

export async function submitPuzzleAttempt(date, chosen) {
  return jsonOrThrow(
    await fetch(`/api/puzzle/${date}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chosen }),
    })
  );
}

export async function fetchQuestionBank(status = 'draft') {
  return jsonOrThrow(await fetch(`/api/desk/questions?status=${encodeURIComponent(status)}`));
}

export async function reviewQuestion(id, status) {
  return jsonOrThrow(
    await fetch(`/api/desk/questions/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
}

export async function draftQuestions(count = 25) {
  return jsonOrThrow(
    await fetch('/api/desk/questions/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
  );
}
