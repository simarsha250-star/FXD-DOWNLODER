import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateUrl } from '../shared/platforms.js';
import { buildCapabilities } from '../src/data/capabilities.js';
import { OFFICIAL_LINK_HOSTS, getOptions, getVerdict } from '../src/data/guides.js';

const samples = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  tiktok: 'https://www.tiktok.com/@user/video/7234567890123456789',
  instagram: 'https://www.instagram.com/reel/C1a2B3c4D5e/',
  facebook: 'https://www.facebook.com/watch/?v=123456789012345',
};

test('platform links are restricted and never get a download button of their own', () => {
  for (const [platform, url] of Object.entries(samples)) {
    const check = validateUrl(url);
    const verdict = getVerdict(check);
    assert.equal(verdict.tone, 'hold', platform);
    assert.match(verdict.title, /does not download/);
    assert.ok(getOptions(check).length >= 4, `${platform} has authorized options`);
  }
});

test('the only links FXD produces are the pasted link and official pages (no fabricated download URLs)', () => {
  for (const url of Object.values(samples)) {
    const check = validateUrl(url);
    for (const option of getOptions(check)) {
      for (const link of option.links || []) {
        const host = new URL(link.href).hostname;
        const allowed = link.href === check.url || OFFICIAL_LINK_HOSTS.includes(host);
        assert.ok(allowed, `unexpected link ${link.href}`);
        assert.ok(!/\.(mp4|m4v|mov|webm|mp3)(\?|$)/i.test(link.href), 'no media file URLs');
      }
    }
  }
});

test('short links ask for the full address and offer only "open it"', () => {
  const check = validateUrl('https://vm.tiktok.com/ZMabc123/');
  assert.equal(getVerdict(check).tone, 'info');
  assert.equal(getOptions(check).length, 1);
});

test('direct files are the only downloadable verdict', () => {
  const check = validateUrl('https://files.example.com/a.mp4');
  assert.equal(getVerdict(check).tone, 'go');
  assert.deepEqual(getOptions(check), []);
});

test('capabilities never overclaim', () => {
  const rows = (status) => Object.fromEntries(buildCapabilities(status).map((r) => [r.id, r.state]));

  // API unreachable (static hosting, or offline): previews are unchecked, Meta needs setup.
  const none = rows(null);
  assert.equal(none['preview-open'], 'unknown');
  assert.equal(none['preview-meta'], 'setup');

  // Deployed without Meta credentials.
  const open = rows({
    previews: {
      youtube: { state: 'ready' },
      tiktok: { state: 'ready' },
      instagram: { state: 'needs_setup' },
      facebook: { state: 'needs_setup' },
    },
  });
  assert.equal(open['preview-open'], 'works');
  assert.equal(open['preview-meta'], 'setup');

  // Always, whatever the status: platform downloads are restricted and owner-media is not built.
  for (const r of [none, open]) {
    assert.equal(r['platform-downloads'], 'restricted');
    assert.equal(r['owner-media'], 'not_built');
    assert.equal(r.direct, 'works');
  }
});
