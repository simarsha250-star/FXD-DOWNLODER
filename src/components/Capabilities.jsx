import { buildCapabilities, STATE_LABELS } from '../data/capabilities.js';

export default function Capabilities({ status }) {
  const rows = buildCapabilities(status);
  return (
    <section className="card" aria-labelledby="caps-title">
      <h2 id="caps-title" className="card-title">
        What works, and what does not
      </h2>
      <ul className="caps">
        {rows.map((row) => (
          <li key={row.id} className="cap">
            <div className="cap-head">
              <h3 className="cap-title">{row.title}</h3>
              <span className={`chip chip-${row.state}`}>{STATE_LABELS[row.state]}</span>
            </div>
            <p className="cap-detail">{row.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
