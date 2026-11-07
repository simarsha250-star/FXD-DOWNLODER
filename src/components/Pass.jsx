import { describeResult, getOptions, getVerdict } from '../data/guides.js';
import DirectDownload from './DirectDownload.jsx';
import Preview from './Preview.jsx';

// The result "pass": the link's identity on top, a perforation, then the verdict and what to do.
export default function Pass({ check, preview, env, online }) {
  const meta = describeResult(check);
  const verdict = getVerdict(check);
  const options = getOptions(check);

  return (
    <section className={`pass pass-${verdict.tone}`} aria-labelledby="pass-title">
      <div className="pass-head">
        <h2 id="pass-title" className="pass-title">
          {meta.title}
        </h2>
        <p className="pass-source">{meta.source}</p>
      </div>
      <div className="perf" aria-hidden="true" />
      <div className="pass-body">
        <div className="verdict">
          <p className="stamp">{verdict.stamp}</p>
          <div className="verdict-text">
            <h3 className="verdict-title">{verdict.title}</h3>
            <p className="verdict-body">{verdict.body}</p>
          </div>
        </div>

        <Preview state={preview} />

        {check.platform === 'direct' ? (
          <DirectDownload key={check.url} check={check} env={env} online={online} />
        ) : (
          <>
            <h3 className="group-title">{check.kind === 'short-link' ? 'What to do next' : 'Authorized ways to get it'}</h3>
            <ul className="options">
              {options.map((option) => (
                <li key={option.id} className="option">
                  <h4 className="option-title">{option.title}</h4>
                  <p className="option-body">{option.body}</p>
                  {option.links && (
                    <div className="actions">
                      {option.links.map((link) => (
                        <a key={link.href} className="btn btn-ghost btn-small" href={link.href} target="_blank" rel="noopener noreferrer">
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
