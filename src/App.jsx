import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractUrl, validateUrl } from '../shared/platforms.js';
import Capabilities from './components/Capabilities.jsx';
import Header from './components/Header.jsx';
import InstallCard from './components/InstallCard.jsx';
import LinkForm from './components/LinkForm.jsx';
import Pass from './components/Pass.jsx';
import { fetchPreview, fetchStatus } from './lib/api.js';
import { getEnv } from './lib/env.js';
import { useOnline } from './lib/hooks.js';

function previewMessage(result) {
  switch (result.code) {
    case 'not_configured':
    case 'unavailable':
      return result.message;
    case 'service_unavailable':
      return 'Link previews are not available on this deployment.';
    default:
      return 'No preview is available for this link.';
  }
}

export default function App() {
  const env = useMemo(() => getEnv(), []);
  const online = useOnline();
  const [value, setValue] = useState('');
  const [check, setCheck] = useState(null);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState({ phase: 'idle' });
  const [status, setStatus] = useState(null);

  const canPasteButton = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      Boolean(navigator.clipboard) &&
      typeof navigator.clipboard.readText === 'function' &&
      window.isSecureContext,
    [],
  );

  const runCheck = useCallback((raw) => {
    const result = validateUrl(raw);
    if (!result.ok) {
      setCheck(null);
      setMessage({ tone: 'error', text: result.message });
      return;
    }
    setCheck(result);
    setValue(result.url);
    setMessage({ tone: 'success', text: 'Link checked.' });
  }, []);

  // Link arrived through the Android/desktop share sheet (manifest share_target).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('url') || params.get('text') || params.get('title');
    if (!shared) return;
    const link = extractUrl(shared);
    setValue(link);
    runCheck(link);
    window.history.replaceState(null, '', window.location.pathname);
  }, [runCheck]);

  // Which optional integrations this deployment has switched on.
  useEffect(() => {
    const ctl = new AbortController();
    fetchStatus({ signal: ctl.signal })
      .then(setStatus)
      .catch(() => {});
    return () => ctl.abort();
  }, []);

  // Link preview through the platform's official oEmbed service, via our own /api/oembed.
  useEffect(() => {
    if (!check || check.platform === 'direct' || check.kind === 'short-link') {
      setPreview({ phase: 'idle' });
      return undefined;
    }
    if (!online) {
      setPreview({ phase: 'error', message: 'Previews need a connection.' });
      return undefined;
    }
    const ctl = new AbortController();
    setPreview({ phase: 'loading' });
    fetchPreview(check.url, { signal: ctl.signal })
      .then((result) => {
        if (ctl.signal.aborted) return;
        setPreview(result.ok ? { phase: 'ready', data: result } : { phase: 'error', message: previewMessage(result) });
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [check, online]);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setMessage({ tone: 'error', text: 'Your clipboard is empty. Copy a link first.' });
        return;
      }
      setValue(text);
      runCheck(text);
    } catch {
      setMessage({
        tone: 'error',
        text: 'Your browser blocked clipboard access. Touch and hold the field, then choose Paste.',
      });
    }
  }

  function onPasteEvent(event) {
    const text = event.clipboardData && event.clipboardData.getData('text');
    if (text && text.trim()) {
      event.preventDefault();
      setValue(text);
      runCheck(text);
    }
  }

  function clear() {
    setValue('');
    setCheck(null);
    setMessage(null);
    const field = document.getElementById('link');
    if (field) field.focus();
  }

  return (
    <div className="shell">
      <Header online={online} />
      <main className="layout">
        <div className="primary">
          <section className="hero">
            <h1 className="hero-title">Paste a link. Save only what you’re cleared to save.</h1>
            <p className="lede">
              FXD checks YouTube, TikTok, Instagram and Facebook links and shows the authorized ways to get the video.
              Direct file links, such as mp4, mp3, jpg and pdf, download right here.
            </p>
          </section>

          <LinkForm
            value={value}
            onChange={setValue}
            onSubmit={() => runCheck(value)}
            onClear={clear}
            onPasteButton={pasteFromClipboard}
            onPasteEvent={onPasteEvent}
            canPasteButton={canPasteButton}
            message={message}
          />

          {check && <Pass check={check} preview={preview} env={env} online={online} />}
        </div>

        <aside className="rail" aria-label="About this app">
          <Capabilities status={status} />
          <InstallCard env={env} />
        </aside>
      </main>

      <footer className="site-footer">
        <p>FXD Downloader by Future X Design. Respect creators’ rights and each platform’s terms.</p>
      </footer>
    </div>
  );
}
