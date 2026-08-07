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

/**
 * Split a wire blurb into [bold lead-in, rest]. Prefer a natural break
 * (colon / dash / comma) within the first 8 words; otherwise bold the
 * first 4 words.
 */
export function wireLeadIn(blurb) {
  const text = (blurb || '').trim();
  const breakMatch = text.match(/^(.{2,60}?[:—–,])\s/);
  if (breakMatch && breakMatch[1].split(/\s+/).length <= 8) {
    return [breakMatch[1] + ' ', text.slice(breakMatch[0].length)];
  }
  const words = text.split(/\s+/);
  if (words.length <= 4) return [text, ''];
  return [words.slice(0, 4).join(' ') + ' ', words.slice(4).join(' ')];
}

export function formatArchiveDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Study-desk deadline formatting. Date-only values (all-day Canvas events)
 * render without a time; datetimes render in the reader's local zone.
 */
export function formatDue(dueAt) {
  const dateOnly = dueAt.length === 10;
  const d = dateOnly ? new Date(`${dueAt}T12:00:00Z`) : new Date(dueAt);
  const day = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
  if (dateOnly) return day;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** "due today" / "due tomorrow" / "due in N days" */
export function dueRelative(dueAt) {
  const dateOnly = dueAt.length === 10;
  const due = dateOnly ? new Date(`${dueAt}T12:00:00Z`) : new Date(dueAt);
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const dueDay = dateOnly
    ? new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
    : startOfDay(due);
  const days = Math.round((dueDay - startOfDay(new Date())) / 86_400_000);
  if (days <= 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}
