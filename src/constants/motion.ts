import { cubicBezier, Easing } from 'react-native-reanimated';

/**
 * Curve for `transitionTimingFunction`. Only the `cubicBezier()` object works on both runtimes:
 * native rejects a CSS string there with a fatal `[Reanimated] Invalid predefined timing function`,
 * while react-native-web serializes this object back into `cubic-bezier(...)`.
 */
export const EASE_UI = cubicBezier(0.23, 1, 0.32, 1);

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
