import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const onWeb = Platform.OS === 'web';

/**
 * Haptics are always paired with a visual and fire once per committed action —
 * never per frame, and never as the only signal.
 */
export function selectionHaptic() {
  if (onWeb) return;
  void Haptics.selectionAsync().catch(() => {});
}

export function impactHaptic(style: 'light' | 'medium' = 'light') {
  if (onWeb) return;
  void Haptics.impactAsync(
    style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
  ).catch(() => {});
}

export function successHaptic() {
  if (onWeb) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warningHaptic() {
  if (onWeb) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
