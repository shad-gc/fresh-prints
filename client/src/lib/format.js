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
