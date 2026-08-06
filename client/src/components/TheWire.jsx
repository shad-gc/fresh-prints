export default function TheWire({ items }) {
  if (!items?.length) return null;
  return (
    <section aria-labelledby="wire-heading">
      <h2 id="wire-heading" className="section-rule">
        The Wire
      </h2>
      <ul className="wire">
        {items.map((item) => (
          <li key={`${item.source_url}-${item.blurb.slice(0, 24)}`}>
            <a href={item.source_url} target="_blank" rel="noreferrer">
              {item.blurb}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
