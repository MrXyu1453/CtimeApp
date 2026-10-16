import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(import.meta.dirname, '..', 'assets', 'images', 'tabIcons');

/** 24dp stroke icons, rendered as template (black) PNGs for the Android tab bar. */
const ICONS = {
  today: `
    <rect x="3" y="5" width="18" height="16" rx="3"/>
    <path d="M3 10h18M8 3v4M16 3v4"/>
    <circle cx="12" cy="16" r="1.6" fill="#000" stroke="none"/>`,
  tasks: `
    <path d="M3 6l2 2 3.5-3.5M12 7h9M3 12l2 2 3.5-3.5M12 13h9M3 18l2 2 3.5-3.5M12 19h9"/>`,
  focus: `
    <circle cx="12" cy="14" r="8"/>
    <path d="M12 14V10M9.5 2h5M18.5 7.5l1.8-1.8"/>`,
  stats: `
    <path d="M3 21h18M6.5 21v-6M12 21V8M17.5 21v-10"/>`,
  calendar: `
    <rect x="3" y="4" width="18" height="17" rx="3"/>
    <path d="M3 9h18M9 4v-1M15 4v-1M3 14h18M9 9v12M15 9v12"/>
    <rect x="10" y="10" width="3" height="3" rx="0.8" fill="#000" stroke="none"/>
    <rect x="4.5" y="15.5" width="3" height="3" rx="0.8" fill="#000" stroke="none" opacity="0.45"/>`,
};

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

mkdirSync(OUT, { recursive: true });

for (const [name, body] of Object.entries(ICONS)) {
  const targets = [
    ['', 24],
    ['@2x', 48],
    ['@3x', 72],
  ];
  for (const [suffix, size] of targets) {
    await sharp(Buffer.from(svg(body)), { density: 300 })
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, `${name}${suffix}.png`));
  }
  console.log(`generated ${name}.png @1x/2x/3x`);
}
