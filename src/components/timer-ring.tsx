import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { useTheme } from '@/hooks/use-theme';

export function TimerRing({
  progress,
  colors,
  size = 236,
  strokeWidth = 14,
  label,
  caption,
}: {
  /** 0 → 1 through the current phase, written once per displayed second — no idle UI-thread animation */
  progress: number;
  colors: readonly [string, string, ...string[]];
  size?: number;
  strokeWidth?: number;
  label: string;
  caption: string;
}) {
  const theme = useTheme();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={StyleSheet.absoluteFill}>
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
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#ctime-ring)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
            />
          </G>
        </Svg>
      </View>

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
