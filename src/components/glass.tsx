import { createContext, useCallback, useContext, useRef, type RefObject } from 'react';
import { Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type ViewProps } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type AnimatedScrollViewProps,
  type SharedValue,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useAmbient, useGlass } from '@/hooks/use-theme';

type Target = RefObject<View | null>;

const TargetContext = createContext<Target | null>(null);

/**
 * On Android a BlurView only blurs what a BlurTargetView draws, so every screen wraps its body
 * here and the panels inside pick the target up from context. On iOS and web this is a plain
 * View and the platform's own backdrop blur is used.
 */
export function GlassTarget({ children, style }: ViewProps) {
  const ref = useRef<View | null>(null);
  return (
    <BlurTargetView ref={ref} style={style}>
      <TargetContext.Provider value={ref}>{children}</TargetContext.Provider>
    </BlurTargetView>
  );
}

/**
 * Frosted panel. `intensity` is fixed at mount — re-blurring every frame is what makes Android
 * glass jank, and no surface here needs a changing blur radius. The translucent fill doubles as
 * the material on Android 11 and below, where the blur method falls back to 'none'.
 */
export function GlassPanel({
  children,
  style,
  radius = Radius.lg,
  intensity,
  padded = true,
  ...rest
}: ViewProps & {
  children?: React.ReactNode;
  radius?: number;
  intensity?: number;
  padded?: boolean;
}) {
  const glass = useGlass();
  const target = useContext(TargetContext);
  return (
    <BlurView
      {...rest}
      {...(target ? { blurTarget: target } : null)}
      blurMethod="dimezisBlurViewSdk31Plus"
      blurReductionFactor={3}
      tint={glass.tint}
      intensity={intensity ?? glass.intensity}
      style={[
        styles.panel,
        { borderRadius: radius, borderColor: glass.hairline, backgroundColor: glass.fill },
        style,
      ]}>
      {padded ? <View style={styles.panelBody}>{children}</View> : children}
    </BlurView>
  );
}

/** Static color wash under a screen, so glass reads against color instead of flat gray. */
export function AmbientBackdrop() {
  const ambient = useAmbient();
  const reduced = useReducedMotion();
  const [a, b, c] = ambient.blobs;
  return (
    <Animated.View
      pointerEvents="none"
      entering={reduced ? undefined : FadeIn.duration(320)}
      style={[StyleSheet.absoluteFill, styles.backdrop]}>
      <LinearGradient
        colors={ambient.base}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[a, `${a}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.blobTop} />
      <LinearGradient colors={[b, `${b}00`]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.blobRight} />
      <LinearGradient colors={[c, `${c}00`]} start={{ x: 0.2, y: 1 }} end={{ x: 0.8, y: 0 }} style={styles.blobBottom} />
    </Animated.View>
  );
}

/**
 * Scroll-linked hairline for a sticky glass header. Only opacity, written on the UI thread —
 * a React render per frame here would stutter the moment the list scrolls.
 *
 * The two runtimes need pairing on the view side too, so this hands back both halves. Reanimated's
 * handler is an object that only `Animated.ScrollView` knows how to plug in; core `ScrollView` calls
 * `props.onScroll(...)` as a function and throws on the first scroll. react-native-web has no UI
 * thread to receive the worklet, so it keeps the core view and a plain callback — writing a shared
 * value from that still costs no React render.
 */
export function useScrollChrome() {
  const edge = useSharedValue(0);
  const native = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      edge.set(y <= 0 ? 0 : y >= 8 ? 1 : y / 8);
    },
  });
  const web = useWebScrollHandler(edge);
  return { edge, scrollHandler: Platform.OS === 'web' ? web : native };
}

type ChromeScrollProps = Omit<ScrollViewProps, 'onScroll'> & {
  onScroll: NonNullable<ReturnType<typeof useScrollChrome>['scrollHandler']>;
};

export function ChromeScrollView({ onScroll, ...rest }: ChromeScrollProps) {
  return Platform.OS === 'web' ? (
    <ScrollView onScroll={onScroll as ScrollViewProps['onScroll']} {...rest} />
  ) : (
    <Animated.ScrollView onScroll={onScroll as AnimatedScrollViewProps['onScroll']} {...rest} />
  );
}

function useWebScrollHandler(edge: SharedValue<number>) {
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    edge.set(y <= 0 ? 0 : y >= 8 ? 1 : y / 8);
  }, [edge]);
}

export function ChromeDivider({ edge }: { edge: SharedValue<number> }) {
  const glass = useGlass();
  const style = useAnimatedStyle(() => ({ opacity: edge.get() }));
  return <Animated.View pointerEvents="none" style={[styles.divider, { backgroundColor: glass.hairline }, style]} />;
}

const styles = StyleSheet.create({
  // Android ignores corner radii on a blur view unless the container clips its children.
  panel: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  panelBody: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  divider: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  // The blobs bleed past the screen on purpose; clipping keeps that bleed from creating a
  // document-level scroll on web, which would slide the whole screen out from under the header.
  backdrop: { overflow: 'hidden' },
  // Ellipses, not rects: a linear gradient only fades along its axis, so the perpendicular
  // edges of a rectangular blob land as hard visible seams on the wash underneath.
  blobTop: { position: 'absolute', left: -60, top: -80, width: 320, height: 320, borderRadius: 160, opacity: 0.5 },
  blobRight: { position: 'absolute', right: -90, top: 90, width: 300, height: 380, borderRadius: 190, opacity: 0.4 },
  blobBottom: { position: 'absolute', left: -30, bottom: -90, width: 380, height: 300, borderRadius: 150, opacity: 0.36 },
});
