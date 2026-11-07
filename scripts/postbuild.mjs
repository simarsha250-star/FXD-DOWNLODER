// Runs after `vite build`. Stamps dist/sw.js with a build id and the exact list of hashed
// files this build produced, so the first visit already caches everything needed offline and
// every deploy gets a fresh cache.

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : fileURLToPath(new URL('../dist/', import.meta.url));

async function walk(dir, base = '') {
  const entries = await readdir(join(dir, base), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = `${base}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(dir, rel)));
    else files.push(rel);
  }
  return files;
}

const html = await readFile(join(dist, 'index.html'), 'utf8').catch(() => {
  throw new Error(`dist/index.html not found in ${dist}. Run "vite build" first.`);
});

const assets = (await walk(dist, '/assets')).sort();
if (assets.length === 0) throw new Error('No files found in dist/assets.');

const buildId = createHash('sha1').update(html).update(assets.join('\n')).digest('hex').slice(0, 10);

let sw = await readFile(join(dist, 'sw.js'), 'utf8');
if (!sw.includes('__BUILD_ID__') || !sw.includes('/*__PRECACHE__*/ []')) {
  throw new Error('dist/sw.js does not contain the expected placeholders.');
}
sw = sw.replace('__BUILD_ID__', buildId).replace('/*__PRECACHE__*/ []', JSON.stringify(assets));
await writeFile(join(dist, 'sw.js'), sw);

console.log(`service worker stamped: build ${buildId}, ${assets.length} precached asset(s)`);
