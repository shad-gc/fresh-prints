export function formatDateline(isoDate, city = 'San Francisco') {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const label = d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${label} — ${city}`;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
