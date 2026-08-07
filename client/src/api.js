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
