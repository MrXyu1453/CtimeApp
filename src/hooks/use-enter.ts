import { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { DURATION } from '@/constants/motion';

/**
 * Staggered entrance for rows that mount with the screen. Capped so a long list never
 * makes the user wait for the tail. Reduced motion keeps the opacity change and drops
 * the travel.
 */
export function useEnter(cap = 6) {
  const reduced = useReducedMotion();
  return (index: number) =>
    reduced
      ? FadeIn.duration(160)
      : FadeInDown.duration(DURATION.entrance).delay(Math.min(index, cap) * 45);
}

/** Enter/exit for transient surfaces (toasts, inline confirmations). */
export function useTransient() {
  const reduced = useReducedMotion();
  return reduced
    ? { entering: FadeIn.duration(160), exiting: FadeOut.duration(140) }
    : { entering: FadeInDown.duration(220), exiting: FadeOut.duration(180) };
}

/** Reflow when a list changes shape — items slide instead of teleporting. */
export function useReflow() {
  const reduced = useReducedMotion();
  return reduced ? undefined : LinearTransition.duration(220);
}
