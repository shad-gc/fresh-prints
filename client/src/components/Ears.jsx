/** Small bordered masthead boxes flanking the brand. */

export function WeatherEar({ weather }) {
  if (!weather) return <div className="ear ear--empty" aria-hidden="true" />;
  return (
    <div className="ear">
      <span className="ear__title">San Francisco</span>
      <span>
        {weather.phrase} · {Math.round(weather.high_f)}°
      </span>
    </div>
  );
}

export function InfoEar({ editionNumber }) {
  return (
    <div className="ear">
      <span className="ear__title">One reader</span>
      <span>Edition No. {editionNumber}</span>
      <span>price: one cron job</span>
    </div>
  );
}
