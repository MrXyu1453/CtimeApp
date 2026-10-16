import path from 'node:path';
import sharp from 'sharp';

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error('usage: node scripts/gen-app-icon.mjs <path-to-1024png>');
  process.exit(1);
}

const OUT = path.join(import.meta.dirname, '..', 'assets', 'images');

/** iOS rejects alpha in the store icon, so flatten onto white. */
const icon = sharp(SOURCE).resize(1024, 1024).flatten({ background: '#ffffff' }).png();
/** Adaptive icons mask the edges, so keep the glyph inside the safe zone. */
const foreground = sharp(SOURCE).resize(320, 320).extend({ width: 432, height: 432, background: '#00000000' }).png();
const background = sharp({ create: { width: 432, height: 432, channels: 3, background: '#1D4ED8' } }).png();
const monochrome = sharp(SOURCE).resize(320, 320).greyscale().extend({ width: 432, height: 432, background: '#00000000' }).png();
const splash = sharp(SOURCE).resize(512, 512).png();
const favicon = sharp(SOURCE).resize(64, 64).png();

const jobs = [
  ['icon.png', icon],
  ['android-icon-foreground.png', foreground],
  ['android-icon-background.png', background],
  ['android-icon-monochrome.png', monochrome],
  ['splash-icon.png', splash],
  ['favicon.png', favicon],
];

for (const [name, pipeline] of jobs) {
  await pipeline.toFile(path.join(OUT, name));
  console.log('wrote', name);
}
