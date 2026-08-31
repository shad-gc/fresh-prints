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

// ---------- Study Desk ----------

async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function fetchStudyDesk() {
  return jsonOrThrow(await fetch('/api/study-desk'));
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
