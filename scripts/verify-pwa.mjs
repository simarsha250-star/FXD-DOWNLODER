// Checks a built site (default: dist/) for everything an installable PWA needs.
// `npm run verify` after `npm run build`. Exits non-zero if anything is wrong.

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : fileURLToPath(new URL('../dist/', import.meta.url));
const problems = [];
const passes = [];
const check = (ok, label) => (ok ? passes : problems).push(label);
const read = (p) => readFile(join(dist, p));

function pngSize(buf) {
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

let manifest;
try {
  manifest = JSON.parse((await read('manifest.webmanifest')).toString('utf8'));
  check(true, 'manifest.webmanifest is valid JSON');
} catch (e) {
  check(false, `manifest.webmanifest missing or invalid (${e.message})`);
}

if (manifest) {
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'background_color', 'theme_color']) {
    check(Boolean(manifest[key]), `manifest.${key} is set`);
  }
  check(manifest.display === 'standalone', 'manifest.display is standalone');
  check(manifest.start_url.startsWith('/') && manifest.scope === '/', 'start_url sits inside scope');

  const icons = manifest.icons || [];
  for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
    const icon = icons.find((i) => i.sizes === `${size}x${size}` && (i.purpose || 'any') === purpose);
    if (!icon) {
      check(false, `manifest has a ${size}x${size} ${purpose} icon`);
      continue;
    }
    try {
      const dims = pngSize(await read(icon.src.replace(/^\//, '')));
      check(dims && dims.w === size && dims.h === size, `${icon.src} is a real ${size}x${size} PNG`);
    } catch {
      check(false, `${icon.src} exists`);
    }
  }
  check(Boolean(manifest.share_target && manifest.share_target.action), 'share_target is declared (Android share sheet)');
}

const html = (await read('index.html').catch(() => Buffer.from(''))).toString('utf8');
check(html.includes('rel="manifest"'), 'index.html links the manifest');
check(/viewport[^>]*viewport-fit=cover/.test(html), 'viewport meta includes viewport-fit=cover');
check(html.includes('rel="apple-touch-icon"'), 'index.html has an apple-touch-icon (iPhone Home Screen)');
check(html.includes('apple-mobile-web-app-capable'), 'index.html has the iOS standalone meta tag');
check(/<script[^>]+src="\/assets\//.test(html), 'index.html loads the built bundle');

try {
  const dims = pngSize(await read('icons/apple-touch-icon-180.png'));
  check(dims && dims.w === 180 && dims.h === 180, 'apple-touch-icon-180.png is a real 180x180 PNG');
} catch {
  check(false, 'apple-touch-icon-180.png exists');
}

try {
  const sw = (await read('sw.js')).toString('utf8');
  check(!sw.includes('__BUILD_ID__') && !sw.includes('/*__PRECACHE__*/'), 'sw.js was stamped by postbuild');
  check(/addEventListener\('fetch'/.test(sw), 'sw.js handles fetch');
  check(sw.includes('/offline.html'), 'sw.js has an offline fallback');
} catch {
  check(false, 'sw.js exists');
}
check((await read('offline.html').catch(() => null)) !== null, 'offline.html exists');

for (const line of passes) console.log(`ok    ${line}`);
for (const line of problems) console.log(`FAIL  ${line}`);
console.log(`\n${passes.length} passed, ${problems.length} failed`);
process.exit(problems.length ? 1 : 0);
