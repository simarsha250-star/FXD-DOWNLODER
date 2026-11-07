// Honest direct-file downloading.
//
// What a web page can really do: fetch a file the server allows it to read (CORS), then hand
// it to the browser. What it cannot do: see whether the browser finished saving it, or read a
// file from a server that does not allow cross-origin access. This module reports exactly
// that, and never says "downloaded" unless the browser itself confirmed a write.

import { formatBytes } from './format.js';

export const MAX_BYTES = 200 * 1024 * 1024;

const EXT_BY_TYPE = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/json': 'json',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

export function sanitizeFilename(name) {
  let out = String(name || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  if (out.length > 120) {
    const ext = (out.match(/\.[A-Za-z0-9]{1,6}$/) || [''])[0];
    out = out.slice(0, 120 - ext.length) + ext;
  }
  return out;
}

export function filenameFromUrl(url, contentType = '') {
  let base = '';
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    try {
      base = decodeURIComponent(last);
    } catch {
      base = last;
    }
  } catch {
    base = '';
  }
  base = sanitizeFilename(base) || 'fxd-download';
  if (!/\.[A-Za-z0-9]{1,6}$/.test(base)) {
    const ext = EXT_BY_TYPE[String(contentType).split(';')[0].trim().toLowerCase()];
    if (ext) base += `.${ext}`;
  }
  return base;
}

const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

/**
 * Fetch a file into memory. Resolves to { ok:true, blob, size, type, filename }
 * or { ok:false, code, message }. Never throws for expected failures.
 */
export async function fetchFile(url, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    signal,
    onProgress,
    maxBytes = MAX_BYTES,
    pageProtocol = globalThis.location && globalThis.location.protocol,
    online = globalThis.navigator && globalThis.navigator.onLine,
  } = options;

  let target;
  try {
    target = new URL(url);
  } catch {
    return fail('invalid', 'That link is not a valid web address.');
  }
  if (online === false) return fail('offline', 'You are offline. Reconnect and try again.');
  if (target.protocol === 'http:' && pageProtocol === 'https:') {
    return fail(
      'insecure',
      'This link uses plain http, and your browser blocks it from a secure page. Open the link directly instead.',
    );
  }

  const tooLarge = (size) =>
    fail(
      'too_large',
      `This file is ${size ? formatBytes(size) : 'too large'}. FXD can hold up to ${formatBytes(maxBytes)} in the browser. Open the link directly instead.`,
      { size },
    );

  let res;
  try {
    res = await fetchImpl(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') return fail('aborted', 'Download cancelled.');
    return fail(
      'blocked',
      'Your browser could not read this file. Either the connection failed, or the file’s server does not allow web pages to download it.',
    );
  }

  if (!res.ok) {
    return fail(
      'http',
      `The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}. The link may have expired or may need a sign-in.`,
      { status: res.status },
    );
  }

  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type === 'text/html' || type === 'application/xhtml+xml') {
    return fail('html', 'This link opens a web page, not a file.');
  }

  const total = Number(res.headers.get('content-length')) || null;
  if (total && total > maxBytes) return tooLarge(total);

  const chunks = [];
  let loaded = 0;
  try {
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        if (loaded > maxBytes) {
          await reader.cancel();
          return tooLarge(total);
        }
        if (onProgress) onProgress({ loaded, total });
      }
    } else {
      const buffer = await res.arrayBuffer();
      loaded = buffer.byteLength;
      if (loaded > maxBytes) return tooLarge(loaded);
      chunks.push(new Uint8Array(buffer));
      if (onProgress) onProgress({ loaded, total: loaded });
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return fail('aborted', 'Download cancelled.');
    return fail('network', 'The connection dropped before the file finished. Try again.');
  }

  if (loaded === 0) return fail('empty', 'The server returned an empty file.');

  const blob = new Blob(chunks, { type: type || 'application/octet-stream' });
  return { ok: true, blob, size: loaded, type, filename: filenameFromUrl(url, type) };
}

/** Hand the file to the browser's download handler. The browser takes it from here. */
export function saveBlob(blob, filename, doc = document, urlApi = URL) {
  const href = urlApi.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // Some mobile browsers need the object URL to stay alive until the download has started.
  setTimeout(() => urlApi.revokeObjectURL(href), 60_000);
}

function toFile(blob, filename) {
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

export function canShareFile(blob, filename, nav = globalThis.navigator) {
  try {
    return Boolean(nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [toFile(blob, filename)] }));
  } catch {
    return false;
  }
}

/** Resolves 'shared' once the share sheet reports success, or 'cancelled'. */
export async function shareFile(blob, filename, nav = globalThis.navigator) {
  try {
    await nav.share({ files: [toFile(blob, filename)], title: filename });
    return 'shared';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

/** True on desktop Chromium, where the browser can confirm a write to a chosen location. */
export function canPickSaveLocation(win = globalThis.window) {
  try {
    return Boolean(win && typeof win.showSaveFilePicker === 'function' && win.isSecureContext && win === win.top);
  } catch {
    return false;
  }
}

/** Resolves 'saved' only after the browser closed the written file, or 'cancelled'. */
export async function saveWithPicker(blob, filename, win = globalThis.window) {
  const ext = (filename.match(/\.([A-Za-z0-9]{1,6})$/) || [])[1];
  const opts = { suggestedName: filename };
  if (ext && blob.type) opts.types = [{ description: `${ext.toUpperCase()} file`, accept: { [blob.type]: [`.${ext}`] } }];
  let handle;
  try {
    handle = await win.showSaveFilePicker(opts);
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return 'saved';
}

/** Where to look after a browser download starts, by device. */
export function whereToLook(env) {
  if (env.ios) return 'Look for the download prompt in Safari, then open the Files app and check Downloads.';
  if (env.android) return 'Check the download notification or your Downloads folder.';
  return 'Check your browser’s downloads list.';
}

/** What to do by hand when the browser cannot fetch the file itself. */
export function manualSaveHint(env) {
  if (env.ios) {
    return 'In the new tab, tap the Share button and choose Save to Files. For an image or video, touch and hold it and choose Save.';
  }
  if (env.android) {
    return 'In the new tab, tap the three-dot menu and choose Download, or touch and hold the image or video and choose Download.';
  }
  return 'In the new tab, right-click the file and choose Save as, or press Ctrl+S (Cmd+S on Mac).';
}
