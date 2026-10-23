import path from 'node:path';
import sharp from 'sharp';

import { backgroundSvg, foregroundSvg, monochromeSvg, tileSvg } from './app-icon-art.mjs';

const OUT = path.join(import.meta.dirname, '..', 'assets', 'images');

/** Adaptive layers are 108dp; 432px is the xxxhdpi sheet the config plugin copies from. */
const ADAPTIVE = 432;

/** iOS rejects alpha in the store icon, so the tile is flattened onto white. */
const jobs = [
  ['icon.png', () => sharp(Buffer.from(tileSvg())).resize(1024, 1024).flatten({ background: '#ffffff' }).png()],
  ['android-icon-foreground.png', () => sharp(Buffer.from(foregroundSvg())).resize(ADAPTIVE, ADAPTIVE).png()],
  ['android-icon-background.png', () => sharp(Buffer.from(backgroundSvg())).resize(ADAPTIVE, ADAPTIVE).png()],
  ['android-icon-monochrome.png', () => sharp(Buffer.from(monochromeSvg())).resize(ADAPTIVE, ADAPTIVE).png()],
  // The splash paints over app.json's solid color, so only the glyph goes in — a full tile there
  // reads as a picture-in-picture.
  ['splash-icon.png', () => sharp(Buffer.from(foregroundSvg())).resize(512, 512).png()],
  ['favicon.png', () => sharp(Buffer.from(tileSvg())).resize(64, 64).png()],
];

for (const [name, pipeline] of jobs) {
  await pipeline().toFile(path.join(OUT, name));
  console.log('wrote', name);
}
