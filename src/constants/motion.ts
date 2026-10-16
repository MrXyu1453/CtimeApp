import { Easing } from 'react-native-reanimated';

/**
 * Reanimated's built-ins are as weak as CSS's. These are the tuned curves in the two
 * forms the library needs: CSS strings for transition props, Easing for withTiming.
 */
export const CSS_EASE_UI = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const CSS_EASE_MOVE = 'cubic-bezier(0.77, 0, 0.175, 1)';
export const CSS_EASE_SHEET = 'cubic-bezier(0.32, 0.72, 0, 1)';

export const TIMING_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const TIMING_MOVE = Easing.bezier(0.77, 0, 0.175, 1);
export const TIMING_LINEAR = Easing.linear;

export const DURATION = {
  press: '150ms',
  toggle: '200ms',
  chart: '420ms',
  entrance: 260,
} as const;

/** Where a flick would have landed if the finger kept decelerating (Apple's exponential decay). */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Past the edge the element follows less and less, so a boundary resists instead of stopping dead. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
