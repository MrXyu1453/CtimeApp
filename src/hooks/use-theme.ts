/**
 * Theme resolution: the app's own appearance setting wins, otherwise the OS scheme.
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Ambient, Colors, Glass, Gradients, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStore } from '@/lib/store';

export function usePalette(): Palette {
  const scheme = useColorScheme();
  const appearance = useStore((s) => s.settings.appearance);
  if (appearance === 'vivid' || appearance === 'light' || appearance === 'dark') return appearance;
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[usePalette()];
}

export function useGradients() {
  return Gradients[usePalette()];
}

/** Blur material for the current palette. */
export function useGlass() {
  return Glass[usePalette()];
}

export function useAmbient() {
  return Ambient[usePalette()];
}
