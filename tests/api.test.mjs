import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../api/oembed.js';
import { buildStatus, createHandler as createStatusHandler } from '../api/status.js';

function call(handler, { url, method = 'GET' }) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      end: (body) => resolve({ status: res.statusCode, headers, json: body ? JSON.parse(body) : null }),
    };
    handler({ method, url }, res);
  });
}

const upstream = (data, status = 200) => {
  const calls = [];
  const fetchImpl = async (endpoint) => {
    calls.push(String(endpoint));
    return new Response(JSON.stringify(data), { status });
  };
  return { fetchImpl, calls };
};

const YT = encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

test('YouTube preview uses the official oEmbed endpoint and returns only safe fields', async () => {
  const { fetchImpl, calls } = upstream({
    title: 'A video',
    author_name: 'A channel',
    thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
    html: '<iframe src="https://evil.example"></iframe>',
  });
  const r = await call(createHandler({ fetchImpl, env: {} }), { url: `/api/oembed?url=${YT}` });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, {
    ok: true,
    provider: 'YouTube',
    title: 'A video',
    author: 'A channel',
    thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://www.youtube.com/oembed?'));
});

test('non-https thumbnails are dropped', async () => {
  const { fetchImpl } = upstream({ title: 't', thumbnail_url: 'http://insecure.example/a.jpg' });
  const r = await call(createHandler({ fetchImpl, env: {} }), { url: `/api/oembed?url=${YT}` });
  assert.equal(r.json.thumbnail, null);
});

test('TikTok preview strips tracking parameters before asking TikTok', async () => {
  const { fetchImpl, calls } = upstream({ title: 't' });
  const link = encodeURIComponent('https://www.tiktok.com/@u/video/7234567890123456789?utm_source=x&_t=y');
  const r = await call(createHandler({ fetchImpl, env: {} }), { url: `/api/oembed?url=${link}` });
  assert.equal(r.status, 200);
  assert.ok(calls[0].startsWith('https://www.tiktok.com/oembed?'));
  assert.ok(!calls[0].includes('utm_source'));
});

test('Instagram and Facebook say "not configured" without a token, and never call out', async () => {
  const { fetchImpl, calls } = upstream({});
  const handler = createHandler({ fetchImpl, env: {} });
  const ig = await call(handler, { url: `/api/oembed?url=${encodeURIComponent('https://www.instagram.com/reel/C1a2B3c4D5e/')}` });
  assert.equal(ig.status, 501);
  assert.equal(ig.json.code, 'not_configured');
  const fb = await call(handler, { url: `/api/oembed?url=${encodeURIComponent('https://www.facebook.com/watch/?v=123456789012345')}` });
  assert.equal(fb.status, 501);
  assert.equal(calls.length, 0);
});

test('with a Meta token the Graph endpoint is used and the token is never returned', async () => {
  const { fetchImpl, calls } = upstream({ title: 'Reel', author_name: 'someone' });
  const env = { META_OEMBED_TOKEN: 'APPID|SECRETVALUE', META_GRAPH_VERSION: 'v23.0' };
  const r = await call(createHandler({ fetchImpl, env }), {
    url: `/api/oembed?url=${encodeURIComponent('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=abc')}`,
  });
  assert.equal(r.status, 200);
  assert.ok(calls[0].startsWith('https://graph.facebook.com/v23.0/instagram_oembed?'));
  assert.ok(!calls[0].includes('igsh'));
  assert.ok(!JSON.stringify(r).includes('SECRETVALUE'));
});

test('only platform post links are accepted (no arbitrary URL fetching)', async () => {
  const { fetchImpl, calls } = upstream({});
  const handler = createHandler({ fetchImpl, env: {} });
  for (const bad of [
    'https://example.com/file.mp4',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/',
    'https://rr1---sn-abc.googlevideo.com/videoplayback',
    'file:///etc/passwd',
  ]) {
    const r = await call(handler, { url: `/api/oembed?url=${encodeURIComponent(bad)}` });
    assert.equal(r.status, 400, bad);
  }
  assert.equal((await call(handler, { url: '/api/oembed' })).status, 400);
  assert.equal(calls.length, 0);
});

test('short links, wrong methods and upstream failures are handled', async () => {
  const { fetchImpl } = upstream({}, 404);
  const handler = createHandler({ fetchImpl, env: {} });
  const short = await call(handler, { url: `/api/oembed?url=${encodeURIComponent('https://vm.tiktok.com/ZMabc123/')}` });
  assert.equal(short.status, 422);
  assert.equal((await call(handler, { url: `/api/oembed?url=${YT}`, method: 'POST' })).status, 405);
  const gone = await call(handler, { url: `/api/oembed?url=${YT}` });
  assert.deepEqual([gone.status, gone.json.code], [404, 'unavailable']);

  const down = createHandler({ fetchImpl: async () => { throw new TypeError('network'); }, env: {} });
  assert.equal((await call(down, { url: `/api/oembed?url=${YT}` })).status, 502);
  const slow = createHandler({ fetchImpl: async () => { throw Object.assign(new Error('t'), { name: 'AbortError' }); }, env: {} });
  assert.equal((await call(slow, { url: `/api/oembed?url=${YT}` })).status, 504);
});

test('status reports configuration without leaking secrets', async () => {
  const off = buildStatus({});
  assert.equal(off.previews.instagram.state, 'needs_setup');
  assert.equal(off.ownerMediaDownloads.state, 'not_built');
  const on = buildStatus({ META_OEMBED_TOKEN: 'APPID|SECRETVALUE' });
  assert.equal(on.previews.facebook.state, 'ready');
  const r = await call(createStatusHandler({ env: { META_OEMBED_TOKEN: 'APPID|SECRETVALUE' } }), { url: '/api/status' });
  assert.ok(!JSON.stringify(r.json).includes('SECRETVALUE'));
});
