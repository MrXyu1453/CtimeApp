import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

/**
 * Absolutely positioned layers — floating glass headers, toasts, sheets — sit outside
 * SafeAreaView's padding, so they have to carry the system insets themselves. On an edge-to-edge
 * Android screen that is what keeps them clear of the status bar and the punch-hole camera.
 *
 * Screens drop SafeAreaView's bottom edge and clear `footer` on their own instead, so the tab bar
 * and the gesture bar are counted exactly once.
 */
export function useSystemInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top,
    left: insets.left,
    right: insets.right,
    /** tab bar height plus whatever the system gesture bar takes underneath it */
    footer: BottomTabInset + insets.bottom,
  };
}
