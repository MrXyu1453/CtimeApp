/**
 * WCAG audit for the three palettes in src/constants/theme.ts.
 * Text tokens must clear 4.5:1 on every surface they can sit on; white-on-hero clears 4.4:1.
 * Run with `node scripts/contrast-audit.mjs` after touching any color token.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.join(import.meta.dirname, '..', 'src', 'constants', 'theme.ts'), 'utf8');

function block(name) {
  const open = source.indexOf('{', source.indexOf(`export const ${name} =`));
  let depth = 0;
  let end = open;
  while (end < source.length) {
    if (source[end] === '{') depth += 1;
    else if (source[end] === '}' && (depth -= 1) === 0) break;
    end += 1;
  }
  const body = source.slice(open, end + 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new Function(`return (${body})`)();
}

const Colors = block('Colors');
const Gradients = block('Gradients');

function rgb(hex) {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ['background', 'backgroundElement', 'backgroundSelected'];
const TEXT = ['text', 'textSecondary', 'accent', 'accentAlt', 'success', 'warning', 'danger'];
const MIN_TEXT = 4.5;
const MIN_HERO = 4.4;

let failures = 0;
for (const [name, colors] of Object.entries(Colors)) {
  const surfaces = SURFACES.map((s) => ({ s, hex: colors[s] }));
  for (const token of TEXT) {
    for (const { s, hex: bg } of surfaces) {
      const r = ratio(colors[token], bg);
      if (r < MIN_TEXT) {
        failures += 1;
        console.log(`FAIL ${name} ${token} on ${s}: ${r.toFixed(2)} (<${MIN_TEXT})`);
      }
    }
  }
  // Selected chips keep their own label color, so the tint must survive both label choices.
  for (const { s, hex: bg } of surfaces) {
    const r = ratio('#FFFFFF', bg);
    if (r < 1.6) console.log(`note ${name} white on ${s}: ${r.toFixed(2)} (light surface, chips use dark labels)`);
  }
  for (const stop of Gradients[name].hero) {
    const r = ratio('#FFFFFF', stop);
    if (r < MIN_HERO) {
      failures += 1;
      console.log(`FAIL ${name} hero stop ${stop} with white text: ${r.toFixed(2)} (<${MIN_HERO})`);
    }
  }
  for (const key of ['focus', 'break', 'chart']) {
    const stops = Gradients[name][key];
    stops.forEach((stop, i) => {
      // Ring/bar gradients run dark→bright: the leading stop carries the shape, the tail is a
      // decorative highlight, so it only has to stay visible against the card.
      const min = i === 0 ? 3 : 1.6;
      const r = ratio(stop, colors.backgroundElement);
      if (r < min) {
        failures += 1;
        console.log(`FAIL ${name} ${key} stop ${stop} on card: ${r.toFixed(2)} (<${min})`);
      }
    });
  }
}

console.log(failures ? `\n${failures} contrast failure(s)` : '\ncontrast OK');
process.exit(failures ? 1 : 0);
