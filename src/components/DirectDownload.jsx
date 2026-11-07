import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canPickSaveLocation,
  canShareFile,
  fetchFile,
  manualSaveHint,
  saveBlob,
  saveWithPicker,
  shareFile,
  whereToLook,
} from '../lib/download.js';
import { formatBytes } from '../lib/format.js';

const RETRYABLE = ['network', 'offline', 'blocked'];

// Two honest steps: fetch the file into the browser, then save it. Success is only claimed
// when the browser confirms it (file picker closed, share sheet completed). A normal browser
// download is reported as "requested", because a web page cannot see it finish.
export default function DirectDownload({ check, env, online }) {
  const [phase, setPhase] = useState('idle'); // idle | working | ready | error
  const [progress, setProgress] = useState({ loaded: 0, total: null });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const controller = useRef(null);

  useEffect(
    () => () => {
      if (controller.current) controller.current.abort();
      controller.current = null;
    },
    [],
  );

  const shareable = useMemo(() => (file ? canShareFile(file.blob, file.filename) : false), [file]);

  async function start() {
    const ctl = new AbortController();
    controller.current = ctl;
    setPhase('working');
    setProgress({ loaded: 0, total: null });
    setFile(null);
    setError(null);
    setNote(null);

    const result = await fetchFile(check.url, { signal: ctl.signal, onProgress: setProgress });
    if (controller.current !== ctl) return;

    if (!result.ok) {
      if (result.code === 'aborted') {
        setPhase('idle');
        setNote({ tone: 'info', text: 'Download cancelled.' });
        return;
      }
      setError(result);
      setPhase('error');
      return;
    }
    setFile(result);
    setPhase('ready');
  }

  function discard() {
    setFile(null);
    setNote(null);
    setPhase('idle');
  }

  async function save() {
    if (!file) return;
    if (canPickSaveLocation()) {
      try {
        const outcome = await saveWithPicker(file.blob, file.filename);
        setNote(
          outcome === 'saved'
            ? { tone: 'success', text: `Saved. Your browser confirmed that ${file.filename} was written to the place you chose.` }
            : { tone: 'info', text: 'Save cancelled. The file is still ready.' },
        );
        return;
      } catch {
        /* The picker failed; fall back to a normal browser download below. */
      }
    }
    saveBlob(file.blob, file.filename);
    setNote({
      tone: 'info',
      text: `Save requested for ${file.filename}. Your browser takes it from here, and FXD cannot see whether it finishes. ${whereToLook(env)}`,
    });
  }

  async function share() {
    if (!file) return;
    try {
      const outcome = await shareFile(file.blob, file.filename);
      setNote(
        outcome === 'shared'
          ? { tone: 'success', text: 'Your share sheet reported that it completed.' }
          : { tone: 'info', text: 'Share cancelled. The file is still ready.' },
      );
    } catch {
      setNote({ tone: 'error', text: 'Sharing did not work on this device. Use Save to device instead.' });
    }
  }

  const pct = progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;

  return (
    <div className="download">
      {phase === 'idle' && (
        <>
          <button type="button" className="btn btn-primary" onClick={start} disabled={!online}>
            Download file
          </button>
          <p className="hint">
            {online
              ? 'FXD fetches the file into your browser first. Then you choose where it goes.'
              : 'You are offline. Reconnect to download.'}
          </p>
        </>
      )}

      {phase === 'working' && (
        <div className="working" aria-live="polite">
          <progress className="bar" max={progress.total || undefined} value={progress.total ? progress.loaded : undefined} />
          <p className="hint">
            Fetching {formatBytes(progress.loaded)}
            {progress.total ? ` of ${formatBytes(progress.total)} (${pct}%)` : ''}
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => controller.current && controller.current.abort()}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'ready' && file && (
        <>
          <p className="file-line">
            <span className="file-name">{file.filename}</span>
            <span className="file-size">{formatBytes(file.size)} received</span>
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              Save to device
            </button>
            {shareable && (
              <button type="button" className="btn btn-ghost" onClick={share}>
                {env.ios ? 'Share or save to Photos' : 'Share'}
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={discard}>
              Discard
            </button>
          </div>
        </>
      )}

      {phase === 'error' && error && (
        <div className="fallback" role="alert">
          <p className="message message-error">{error.message}</p>
          <div className="actions">
            {RETRYABLE.includes(error.code) && (
              <button type="button" className="btn btn-primary" onClick={start}>
                Try again
              </button>
            )}
            <a className="btn btn-ghost" href={check.url} target="_blank" rel="noopener noreferrer">
              Open the link directly
            </a>
          </div>
          <p className="hint">{manualSaveHint(env)}</p>
        </div>
      )}

      {note && (
        <p className={`message message-${note.tone}`} role="status">
          {note.text}
        </p>
      )}
    </div>
  );
}
