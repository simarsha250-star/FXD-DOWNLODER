// Renders the app icons from one design: a lime X over a download tray, on black.
// Run with `npm run icons` (needs the `sharp` dev dependency). The PNGs are committed, so a
// normal build never needs to run this.

import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LIME = '#c6ff00';
const out = new URL('../public/icons/', import.meta.url);
await mkdir(out, { recursive: true });

// `scale` shrinks the mark toward the centre. Maskable icons keep it inside the 80% safe zone.
function svg({ rounded, scale = 1 }) {
  const t = (1 - scale) * 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#000"/>
  <g transform="translate(${t} ${t}) scale(${scale})" stroke="${LIME}" stroke-linecap="square" fill="none">
    <path d="M160 128 L352 320 M352 128 L160 320" stroke-width="64"/>
    <path d="M148 396 H364" stroke-width="28"/>
  </g>
</svg>`;
}

const jobs = [
  // Home-screen and install icons ("any" purpose): rounded black tile.
  ['icon-192.png', 192, svg({ rounded: true })],
  ['icon-512.png', 512, svg({ rounded: true })],
  // Maskable: full-bleed so the OS can crop it to any shape; mark kept inside the safe zone.
  ['icon-maskable-512.png', 512, svg({ rounded: false, scale: 0.72 })],
  // iOS applies its own corner mask and needs an opaque, square image.
  ['apple-touch-icon-180.png', 180, svg({ rounded: false, scale: 0.86 })],
  ['favicon-32.png', 32, svg({ rounded: true })],
];

for (const [name, size, markup] of jobs) {
  await sharp(Buffer.from(markup)).resize(size, size).png({ compressionLevel: 9 }).toFile(new URL(name, out).pathname);
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}

await writeFile(new URL('../public/favicon.svg', import.meta.url), svg({ rounded: true }).replace(/ width="512" height="512"/, '') + '\n');
console.log('wrote public/favicon.svg');
