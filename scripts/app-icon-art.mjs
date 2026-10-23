/**
 * The launcher icon, authored as geometry instead of a flattened bitmap: one source of truth for
 * the iOS tile, Android's three adaptive layers, the splash mark and the favicon, so the glyph can
 * be re-rendered at any size and still line up with the adaptive safe zone.
 *
 * All markup uses a 1024 viewBox. The glyph stays inside the middle ~44% of it — Android's adaptive
 * mask only guarantees the central 66/108 (61%) circle.
 */

const WHITE = '#FFFFFF';
const AMBER = '#F59E0B';

/** Day-brand wash: teal into the app's own blue — #2563EB is the in-app focus gradient's start. */
const BACKGROUND = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0D9488"/>
      <stop offset="0.5" stop-color="#2563EB"/>
      <stop offset="1" stop-color="#1E40AF"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.18" r="0.8">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>`;

/**
 * 时舟: a boat inside a dial. The ring is the clock face, the noon sun doubles as the twelve
 * marker, and the two sails plus the hull carry the name. `mono` collapses the amber for
 * Android's monochrome layer, which the system tints on its own.
 *
 * Every form is sized to clear the ring with room to spare — at 48dp an intersection between two
 * white shapes reads as one blob, not as a boat crossing a dial.
 */
function glyph({ mono = false } = {}) {
  return `
  <g>
    <circle cx="512" cy="540" r="200" fill="none" stroke="${WHITE}" stroke-width="40"/>
    <circle cx="512" cy="340" r="38" fill="${mono ? WHITE : AMBER}"/>
    <path d="M536 408 L536 606 L634 606 Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="16" stroke-linejoin="round"/>
    <path d="M484 476 L484 606 L392 606 Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="16" stroke-linejoin="round"/>
    <path d="M378 618 Q512 706 646 618" fill="none" stroke="${WHITE}" stroke-width="36" stroke-linecap="round"/>
  </g>`;
}

function svg(body, { transparent = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${
    transparent ? '' : BACKGROUND
  }${body}</svg>`;
}

export const tileSvg = () => svg(glyph());
export const backgroundSvg = () => svg('');
export const foregroundSvg = () => svg(glyph(), { transparent: true });
export const monochromeSvg = () => svg(glyph({ mono: true }), { transparent: true });
