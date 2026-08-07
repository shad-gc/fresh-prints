const SF = { latitude: 37.77, longitude: -122.42 };
const FETCH_TIMEOUT_MS = 8_000;

const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${SF.latitude}&longitude=${SF.longitude}` +
  `&daily=weather_code,temperature_2m_max` +
  `&temperature_unit=fahrenheit&forecast_days=1&timezone=America/Los_Angeles`;

/** WMO weather code → short newspaper phrase. */
function phraseFor(code) {
  if (code === 0) return 'Clear skies';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog, then sun';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorms';
  if (code === 96 || code === 99) return 'Thunderstorms, hail';
  return 'Changeable';
}

/**
 * San Francisco forecast for the weather ear, fetched at publish time.
 * NEVER throws: any failure returns null and the edition publishes with the
 * ear absent.
 */
export async function fetchWeatherSnapshot() {
  try {
    const res = await fetch(URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const code = data?.daily?.weather_code?.[0];
    const high = data?.daily?.temperature_2m_max?.[0];
    if (code == null || high == null) throw new Error('missing daily fields');
    return {
      phrase: phraseFor(code),
      high_f: Math.round(high),
      code,
    };
  } catch (err) {
    console.warn(`[weather] fetch failed: ${err.message} — publishing without weather ear`);
    return null;
  }
}
