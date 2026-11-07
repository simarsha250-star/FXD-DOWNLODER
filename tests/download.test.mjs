import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchFile, filenameFromUrl, manualSaveHint, sanitizeFilename, whereToLook } from '../src/lib/download.js';
import { formatBytes } from '../src/lib/format.js';

const fakeFetch = (body, init = {}) => async () => new Response(body, init);
const opts = (fetchImpl, extra = {}) => ({ fetchImpl, pageProtocol: 'https:', online: true, ...extra });

test('filenames come from the URL and are made safe', () => {
  assert.equal(filenameFromUrl('https://x.test/media/My%20Clip.mp4?sig=1'), 'My Clip.mp4');
  assert.equal(filenameFromUrl('https://x.test/download', 'video/mp4'), 'download.mp4');
  assert.equal(filenameFromUrl('https://x.test/', 'application/pdf'), 'fxd-download.pdf');
  assert.equal(filenameFromUrl('https://x.test/%E0%A4%A.mp3'), '%E0%A4%A.mp3'); // malformed escape does not throw
  // Path separators and reserved characters become "_", and leading dots are stripped.
  assert.equal(sanitizeFilename('..\\..\\evil:name?.mp4'), '_.._evil_name_.mp4');
  assert.equal(sanitizeFilename('../../etc/passwd'), '_.._etc_passwd');
  assert.ok(!/[\\/:*?"<>|]/.test(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')));
  assert.ok(sanitizeFilename('a'.repeat(300) + '.mp4').length <= 120);
  assert.ok(sanitizeFilename('a'.repeat(300) + '.mp4').endsWith('.mp4'));
});

test('a readable file is received in full, with progress', async () => {
  const seen = [];
  const r = await fetchFile(
    'https://x.test/a.mp3',
    opts(fakeFetch('hello world', { headers: { 'content-type': 'audio/mpeg', 'content-length': '11' } }), {
      onProgress: (p) => seen.push(p),
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.size, 11);
  assert.equal(r.filename, 'a.mp3');
  assert.equal(r.type, 'audio/mpeg');
  assert.equal(await r.blob.text(), 'hello world');
  assert.equal(seen.at(-1).loaded, 11);
  assert.equal(seen.at(-1).total, 11);
});

test('a web page is not mistaken for a file', async () => {
  const r = await fetchFile('https://x.test/a.mp4', opts(fakeFetch('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })));
  assert.deepEqual([r.ok, r.code], [false, 'html']);
});

test('server errors are reported, not hidden', async () => {
  const r = await fetchFile('https://x.test/a.mp4', opts(fakeFetch('nope', { status: 403, statusText: 'Forbidden' })));
  assert.deepEqual([r.ok, r.code, r.status], [false, 'http', 403]);
  assert.match(r.message, /403/);
});

test('a CORS or network failure is reported as blocked, never as success', async () => {
  const r = await fetchFile('https://x.test/a.mp4', opts(async () => { throw new TypeError('Failed to fetch'); }));
  assert.deepEqual([r.ok, r.code], [false, 'blocked']);
  assert.match(r.message, /does not allow web pages/);
});

test('abort is reported as cancelled', async () => {
  const r = await fetchFile('https://x.test/a.mp4', opts(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }));
  assert.deepEqual([r.ok, r.code], [false, 'aborted']);
});

test('oversized files are refused up front and while streaming', async () => {
  const up = await fetchFile('https://x.test/a.zip', opts(fakeFetch('x', { headers: { 'content-length': '999999999' } }), { maxBytes: 1000 }));
  assert.deepEqual([up.ok, up.code], [false, 'too_large']);
  const live = await fetchFile('https://x.test/a.zip', opts(fakeFetch('x'.repeat(5000)), { maxBytes: 1000 }));
  assert.deepEqual([live.ok, live.code], [false, 'too_large']);
});

test('offline, insecure and empty cases', async () => {
  assert.equal((await fetchFile('https://x.test/a.mp4', opts(fakeFetch('x'), { online: false }))).code, 'offline');
  assert.equal((await fetchFile('http://x.test/a.mp4', opts(fakeFetch('x')))).code, 'insecure');
  assert.equal((await fetchFile('https://x.test/a.mp4', opts(fakeFetch('')))).code, 'empty');
  assert.equal((await fetchFile('not a url', opts(fakeFetch('x')))).code, 'invalid');
});

test('requests never send cookies or a referrer', async () => {
  let init;
  await fetchFile('https://x.test/a.mp4', opts(async (_url, i) => { init = i; return new Response('x'); }));
  assert.equal(init.credentials, 'omit');
  assert.equal(init.referrerPolicy, 'no-referrer');
  assert.equal(init.mode, 'cors');
});

test('device-specific guidance exists for every platform', () => {
  for (const env of [{ ios: true }, { android: true }, {}]) {
    assert.ok(whereToLook(env).length > 20);
    assert.ok(manualSaveHint(env).length > 20);
  }
});

test('byte formatting', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(200 * 1024 * 1024), '200 MB');
});
