import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { TIMING_MOVE } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function TimerRing({
  progress,
  colors,
  running,
  size = 236,
  strokeWidth = 14,
  label,
  caption,
}: {
  /** 0 → 1 through the current phase, advanced by the caller on the UI thread */
  progress: SharedValue<number>;
  colors: readonly [string, string, ...string[]];
  running: boolean;
  size?: number;
  strokeWidth?: number;
  label: string;
  caption: string;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const dashProps = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { strokeDashoffset: circumference * (1 - p) };
  }, [circumference]);

  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  useEffect(() => {
    if (!running || reduced) {
      pulse.set(1);
      return;
    }
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1.015, { duration: 1500, easing: TIMING_MOVE }),
          withTiming(1, { duration: 1500, easing: TIMING_MOVE }),
        ),
        -1,
        false,
      ),
    );
  }, [running, reduced, pulse]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, breathe]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <LinearGradient id="ctime-ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[colors.length - 1]} />
            </LinearGradient>
          </Defs>
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.backgroundSelected}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#ctime-ring)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={dashProps}
            />
          </G>
        </Svg>
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <ThemedText style={styles.label}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.caption}>
          {caption}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', gap: 4 },
  label: { fontSize: 56, lineHeight: 66, fontVariant: ['tabular-nums'] },
  caption: { maxWidth: 150, textAlign: 'center' },
});
