import { useMemo, useState } from 'react';
import { envLabel } from '../lib/env.js';
import { getInstallGuide, INSTALL_FOOTNOTE } from '../lib/install.js';
import { usePwa } from '../lib/hooks.js';
import { promptInstall } from '../lib/pwa.js';

// The install button exists only while the browser has offered a real install prompt.
// Everywhere else the card shows steps for this browser instead of a button that does nothing.
export default function InstallCard({ env }) {
  const pwa = usePwa();
  const [result, setResult] = useState(null);
  const guide = useMemo(() => getInstallGuide(env), [env]);

  if (pwa.installed) {
    return (
      <section className="card" aria-labelledby="install-title">
        <h2 id="install-title" className="card-title">
          FXD Downloader is installed
        </h2>
        <p className="card-text">You are using it as an app. It also works offline for checking links.</p>
      </section>
    );
  }

  async function onInstall() {
    setResult(await promptInstall());
  }

  return (
    <section className="card" aria-labelledby="install-title">
      <h2 id="install-title" className="card-title">
        Install FXD Downloader
      </h2>
      <p className="card-text">
        Add it to your Home Screen or desktop. It opens in its own window, without browser bars.
      </p>

      {pwa.canPrompt && (
        <button type="button" className="btn btn-primary" onClick={onInstall}>
          Install FXD Downloader
        </button>
      )}
      {result === 'dismissed' && (
        <p className="message message-info" role="status">
          Install cancelled. You can still install from your browser menu.
        </p>
      )}
      {result === 'accepted' && (
        <p className="message message-success" role="status">
          Installing. Look for FXD on your Home Screen or app list.
        </p>
      )}

      <details className="steps" open={!pwa.canPrompt}>
        <summary>Steps for {envLabel(env)}</summary>
        <h3 className="steps-title">{guide.title}</h3>
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {guide.note && <p className="hint">{guide.note}</p>}
      </details>

      <p className="hint">{INSTALL_FOOTNOTE}</p>
    </section>
  );
}
