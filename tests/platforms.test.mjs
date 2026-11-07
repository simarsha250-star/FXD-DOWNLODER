import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractUrl, validateUrl } from '../shared/platforms.js';

const ok = (input) => {
  const r = validateUrl(input);
  assert.equal(r.ok, true, `${input} should be valid, got ${JSON.stringify(r)}`);
  return r;
};
const bad = (input, code) => {
  const r = validateUrl(input);
  assert.equal(r.ok, false, `${input} should be rejected`);
  if (code) assert.equal(r.code, code);
  return r;
};

test('YouTube links', () => {
  assert.deepEqual(
    { p: ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ').platform, k: ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ').kind },
    { p: 'youtube', k: 'video' },
  );
  assert.equal(ok('https://youtu.be/dQw4w9WgXcQ?t=10').id, 'dQw4w9WgXcQ');
  assert.equal(ok('https://m.youtube.com/watch?v=dQw4w9WgXcQ').platform, 'youtube');
  assert.equal(ok('https://music.youtube.com/watch?v=dQw4w9WgXcQ').platform, 'youtube');
  assert.equal(ok('https://www.youtube.com/shorts/abcdefghijk').kind, 'short');
  bad('https://www.youtube.com/@somechannel', 'not_content');
  bad('https://www.youtube.com/watch?v=short', 'not_content');
});

test('TikTok links', () => {
  const r = ok('https://www.tiktok.com/@user.name/video/7234567890123456789');
  assert.equal(r.platform, 'tiktok');
  assert.equal(r.kind, 'video');
  assert.equal(r.id, '7234567890123456789');
  assert.equal(ok('https://vm.tiktok.com/ZMabc123/').kind, 'short-link');
  assert.equal(ok('https://www.tiktok.com/t/ZTabc123/').kind, 'short-link');
  bad('https://www.tiktok.com/@user', 'not_content');
});

test('Instagram links', () => {
  assert.equal(ok('https://www.instagram.com/reel/C1a2B3c4D5e/').kind, 'reel');
  assert.equal(ok('https://www.instagram.com/p/C1a2B3c4D5e/?igsh=abc').kind, 'post');
  assert.equal(ok('https://instagram.com/reels/C1a2B3c4D5e').kind, 'reel');
  bad('https://www.instagram.com/someuser/', 'not_content');
});

test('Facebook links', () => {
  assert.equal(ok('https://www.facebook.com/watch/?v=123456789012345').kind, 'video');
  assert.equal(ok('https://www.facebook.com/reel/123456789012345').kind, 'reel');
  assert.equal(ok('https://m.facebook.com/somepage/videos/123456789012345/').kind, 'video');
  assert.equal(ok('https://fb.watch/abc123XYZ/').kind, 'short-link');
  assert.equal(ok('https://www.facebook.com/share/v/1AbCdEf/').kind, 'short-link');
  bad('https://www.facebook.com/somepage', 'not_content');
});

test('direct file links', () => {
  const r = ok('https://files.example.com/media/clip.MP4?token=abc');
  assert.equal(r.platform, 'direct');
  assert.equal(r.ext, 'mp4');
  assert.equal(r.fileType, 'video');
  assert.equal(ok('https://example.org/a/b/report.pdf').fileType, 'document');
  assert.equal(ok('https://example.org/pic.jpeg').fileType, 'image');
  bad('https://example.org/page.html', 'unsupported_site');
  bad('https://example.org/', 'unsupported_site');
});

test('look-alike hosts are not mistaken for platforms', () => {
  bad('https://notyoutube.com/watch?v=dQw4w9WgXcQ', 'unsupported_site');
  bad('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'unsupported_site');
  bad('https://evil.example/?u=https://youtube.com/watch?v=dQw4w9WgXcQ', 'unsupported_site');
});

test('platform media-server links are refused, not treated as downloads', () => {
  bad('https://rr1---sn-abc.googlevideo.com/videoplayback?expire=1', 'platform_cdn');
  bad('https://scontent.cdninstagram.com/v/t50/clip.mp4', 'platform_cdn');
  bad('https://video-lax3-1.xx.fbcdn.net/v/clip.mp4', 'platform_cdn');
});

test('unsafe or malformed input is rejected', () => {
  bad('', 'empty');
  bad('   ', 'empty');
  bad('javascript:alert(1)', 'unsupported_protocol');
  bad('ftp://example.com/file.mp4', 'unsupported_protocol');
  bad('data:text/html,<b>hi</b>', 'unsupported_protocol');
  bad('https://user:pass@example.com/file.mp4', 'credentials_in_url');
  bad('http://localhost:3000/file.mp4', 'private_host');
  bad('http://127.0.0.1/file.mp4', 'private_host');
  bad('http://192.168.1.5/file.mp4', 'private_host');
  bad('http://[::1]/file.mp4', 'private_host');
  bad('http://2130706433/file.mp4', 'private_host');
  bad('not a link at all', 'invalid_url');
  bad('https://example.com/' + 'a'.repeat(3000), 'too_long');
});

test('pasted text is cleaned up', () => {
  assert.equal(extractUrl('Look at this https://youtu.be/dQw4w9WgXcQ!'), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(ok('Check this out: https://youtu.be/dQw4w9WgXcQ).').platform, 'youtube');
  assert.equal(ok('youtu.be/dQw4w9WgXcQ').platform, 'youtube'); // no scheme
  assert.equal(ok('  https://example.com/a.mp3  ').ext, 'mp3');
});
