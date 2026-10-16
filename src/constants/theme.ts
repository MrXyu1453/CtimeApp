import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    background: '#F5F7FC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E9ECF6',
    textSecondary: '#5B6478',
    accent: '#1D4ED8',
    accentAlt: '#0E7490',
    onAccent: '#FFFFFF',
    success: '#047857',
    warning: '#92400E',
    danger: '#B91C1C',
    border: '#E3E7F2',
    scrim: 'rgba(11,18,32,0.42)',
  },
  /** 活力白天：高饱和度的暖底日间配色（青绿 + 海蓝 + 落橙），刻意不含紫色。 */
  vivid: {
    text: '#14232A',
    background: '#FFF4E8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FFE4CE',
    textSecondary: '#55676E',
    accent: '#115E59',
    accentAlt: '#0369A1',
    onAccent: '#FFFFFF',
    success: '#047857',
    warning: '#9A3412',
    danger: '#BE123C',
    border: '#F6D9BF',
    scrim: 'rgba(20,35,42,0.38)',
  },
  dark: {
    text: '#F3F5FA',
    background: '#080D1A',
    backgroundElement: '#131B2E',
    backgroundSelected: '#1E2740',
    textSecondary: '#98A3BC',
    accent: '#60A5FA',
    accentAlt: '#A78BFA',
    onAccent: '#08101F',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    border: '#26314C',
    scrim: 'rgba(3,6,14,0.62)',
  },
} as const;

export type Palette = keyof typeof Colors;

export type ThemeColor =
  & keyof typeof Colors.light
  & keyof typeof Colors.vivid
  & keyof typeof Colors.dark;

/**
 * Frosted-glass material per palette. `intensity` is set once at mount and never animated —
 * re-blurring every frame is exactly what makes Android glass jank.
 */
export const Glass = {
  light: { tint: 'light', fill: 'rgba(255,255,255,0.66)', hairline: 'rgba(255,255,255,0.8)', intensity: 34 },
  vivid: { tint: 'light', fill: 'rgba(255,255,255,0.58)', hairline: 'rgba(255,255,255,0.78)', intensity: 30 },
  dark: { tint: 'dark', fill: 'rgba(11,17,32,0.55)', hairline: 'rgba(148,163,184,0.22)', intensity: 38 },
} as const satisfies Record<Palette, { tint: string; fill: string; hairline: string; intensity: number }>;

/** Static color wash behind every screen; the glass surfaces blur into it. */
export const Ambient = {
  light: { base: ['#EAF1FF', '#F5F7FC'], blobs: ['#BFDBFE', '#A7F3D0', '#FBCFE8'] },
  vivid: { base: ['#FFF3E0', '#FFE7D2', '#E4F6F1'], blobs: ['#FDBA74', '#F9A8D4', '#5EEAD4'] },
  dark: { base: ['#080D1A', '#0E1428'], blobs: ['#1D4ED8', '#6D28D9', '#0F766E'] },
} as const satisfies Record<Palette, { base: readonly string[]; blobs: readonly string[] }>;

/** Kept out of `Colors` so every theme lookup stays a plain color value. */
export const Gradients = {
  light: {
    hero: ['#1D4ED8', '#0E7490'],
    focus: ['#2563EB', '#22D3EE'],
    break: ['#059669', '#84CC16'],
    chart: ['#1D4ED8', '#2DD4BF'],
    sheen: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'],
  },
  vivid: {
    hero: ['#115E59', '#0369A1'],
    focus: ['#115E59', '#22D3EE'],
    break: ['#059669', '#CA8A04'],
    chart: ['#EA580C', '#115E59'],
    sheen: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0)'],
  },
  dark: {
    hero: ['#4F46E5', '#7C3AED'],
    focus: ['#818CF8', '#22D3EE'],
    break: ['#34D399', '#BEF264'],
    chart: ['#93C5FD', '#C4B5FD'],
    sheen: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)'],
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Elevation is set once per surface; animating it re-renders the shadow every frame on Android. */
export const Shadow = Platform.select({
  ios: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: {},
});

/** Height of the tab bar every screen must clear at the bottom — the web fallback draws its own. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 84 }) ?? 0;
export const MaxContentWidth = 800;
