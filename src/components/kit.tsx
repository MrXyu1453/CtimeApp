import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { EASE_UI, DURATION, TIMING_EASE_OUT } from '@/constants/motion';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { selectionHaptic, impactHaptic } from '@/lib/haptics';
import { useEnter } from '@/hooks/use-enter';
import { useGradients, useTheme } from '@/hooks/use-theme';

const pressRest = {
  transform: [{ scale: 1 }],
  // One curve and one duration for the press scale and the color swap behind it,
  // so a tap reads as a single gesture instead of two effects.
  transitionProperty: 'all',
  transitionDuration: DURATION.press,
  transitionTimingFunction: EASE_UI,
} as const;

const pressActive = { transform: [{ scale: 0.97 }] } as const;

/** Absolutely positioned and childless, so animating width costs no sibling reflow. */
const barFillBase = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  transitionProperty: 'width',
  transitionDuration: DURATION.chart,
  transitionTimingFunction: EASE_UI,
} as const;

type Haptic = 'none' | 'select' | 'light' | 'medium';

function fireHaptic(haptic: Haptic) {
  if (haptic === 'select') selectionHaptic();
  else if (haptic === 'light') impactHaptic('light');
  else if (haptic === 'medium') impactHaptic('medium');
}

/**
 * Press feedback for every touchable: 3% scale in 120ms, on the UI thread, interruptible.
 * There is no hover on mobile, so this is the whole affordance.
 */
export function PressableScale({
  children,
  style,
  outerStyle,
  onPress,
  onLongPress,
  disabled,
  checked,
  haptic = 'select',
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop,
}: {
  children: React.ReactNode;
  /** Applied to the inner Animated.View, so it must accept Reanimated's CSS transition props. */
  style?: React.ComponentProps<typeof Animated.View>['style'];
  outerStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  checked?: boolean;
  haptic?: Haptic;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'imagebutton';
  hitSlop?: number;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={
        checked === undefined ? { disabled: !!disabled } : { disabled: !!disabled, checked }
      }
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onLongPress ? '长按可快速操作' : undefined}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onLongPress={onLongPress ? () => { fireHaptic('light'); onLongPress(); } : undefined}
      onPress={onPress ? () => { fireHaptic(haptic); onPress(); } : undefined}
      style={outerStyle}>
      <Animated.View style={[pressRest, pressed && pressActive, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  accent,
  tint,
  entering,
  exiting,
  layout,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Animated.View>['style'];
  accent?: string;
  /** faint category wash behind the content, so rows read as grouped without extra chrome */
  tint?: string;
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  exiting?: React.ComponentProps<typeof Animated.View>['exiting'];
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      layout={layout}
      style={[
        styles.card,
        // Only the colors ride this transition, so switching appearance cross-fades
        // instead of snapping and nothing else on the card re-lays-out.
        !reduced && colorFade,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        Shadow,
        style,
      ]}>
      {tint ? <View style={[styles.tint, { backgroundColor: `${tint}16` }]} pointerEvents="none" /> : null}
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {children}
    </Animated.View>
  );
}

const colorFade = {
  transitionProperty: ['backgroundColor', 'borderColor'] as ('backgroundColor' | 'borderColor')[],
  transitionDuration: ['240ms', '240ms'] as '240ms'[],
  transitionTimingFunction: [EASE_UI, EASE_UI],
};

/**
 * One-shot sheen sweep across a gradient surface. Fires on an action the user just took
 * (a successful schedule), never loops — the hero is seen too often for ambient motion.
 */
function Sheen({ trigger, colors }: { trigger: number; colors: readonly [string, string, ...string[]] }) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced || trigger === 0) return;
    sweep.set(0);
    sweep.set(withTiming(1, { duration: 620, easing: TIMING_EASE_OUT }));
  }, [trigger, reduced, sweep]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-60 + sweep.get() * 420}%` }],
    opacity: sweep.get() > 0 ? 1 : 0,
  }));

  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export function GradientCard({
  colors,
  children,
  style,
  locations,
  sheen = 0,
  sheenColors,
}: {
  colors: readonly [string, string, ...string[]];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  locations?: readonly [number, number, ...number[]];
  /** bump this number to replay the sheen; 0 means "never played" */
  sheen?: number;
  sheenColors?: readonly [string, string, ...string[]];
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={locations}
      style={[styles.card, { borderWidth: 0 }, Shadow, style]}>
      {children}
      {sheenColors ? <Sheen trigger={sheen} colors={sheenColors} /> : null}
    </LinearGradient>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionRow}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {children}
      </ThemedText>
      <View style={{ backgroundColor: theme.border, height: 1, flex: 1 }} />
      {right}
    </View>
  );
}

/** Light tints need dark label text, so selected chips stay readable in both schemes. */
function readableOn(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#111827' : '#FFFFFF';
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  small,
  haptic,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  small?: boolean;
  haptic?: Haptic;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const tint = color ?? theme.accent;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      haptic={haptic ?? (selected ? 'none' : 'select')}
      style={[
        styles.chip,
        small && styles.chipSmall,
        { backgroundColor: selected ? tint : theme.backgroundSelected },
      ]}>
      <ThemedText type="small" style={{ color: selected ? readableOn(tint) : theme.textSecondary }}>
        {label}
      </ThemedText>
    </PressableScale>
  );
}

export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}22` }]}>
      <View style={[styles.tagDot, { backgroundColor: color }]} />
      <ThemedText type="small" style={{ color }}>{label}</ThemedText>
    </View>
  );
}

const pillSlide = {
  transitionProperty: 'left',
  transitionDuration: DURATION.toggle,
  transitionTimingFunction: EASE_UI,
} as const;

const pillStill = { transitionProperty: 'none' } as const;

/** Segmented control with a sliding pill — one motion vocabulary for every switcher in the app. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const index = Math.max(0, items.findIndex((item) => item.id === value));
  const slot = `${100 / items.length}%` as `${number}%`;

  return (
    <View style={[styles.segments, { backgroundColor: theme.backgroundSelected }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.segmentPill,
          {
            left: `${(index * 100) / items.length}%` as `${number}%`,
            width: slot,
            backgroundColor: theme.backgroundElement,
            ...(reduced ? pillStill : pillSlide),
          },
        ]}
      />
      {items.map((item) => (
        <PressableScale
          key={item.id}
          onPress={() => onChange(item.id)}
          outerStyle={styles.segment}
          style={styles.segmentInner}>
          <ThemedText type="smallBold" style={{ color: item.id === value ? theme.text : theme.textSecondary }}>
            {item.label}
          </ThemedText>
        </PressableScale>
      ))}
    </View>
  );
}

export function ProgressBar({
  value,
  color,
  colors,
  track,
  height = 8,
}: {
  value: number;
  color?: string;
  /** gradient fill; takes precedence over `color` */
  colors?: readonly [string, string, ...string[]];
  track?: string;
  height?: number;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const fill = { width: `${clamped * 100}%` as `${number}%`, borderRadius: height / 2 };

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: track ?? theme.backgroundSelected, borderRadius: height / 2 },
      ]}>
      {colors ? (
        <Animated.View style={[barFillBase, fill]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : (
        <Animated.View style={[barFillBase, fill, { backgroundColor: color ?? theme.accent }]} />
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  haptic = 'select',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: Haptic;
}) {
  const theme = useTheme();
  const gradients = useGradients();
  const visuals: StyleProp<ViewStyle> =
    variant === 'danger'
      ? { backgroundColor: `${theme.danger}22` }
      : variant === 'ghost'
        ? { backgroundColor: theme.backgroundSelected }
        : undefined;

  const content = (
    <ThemedText type="default" style={{ color: variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.danger : theme.text, fontWeight: '700' }}>
      {label}
    </ThemedText>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={variant === 'danger' ? 'medium' : haptic}
      outerStyle={style}
      style={[styles.button, disabled && styles.disabled, visuals]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

export function Stepper({
  label,
  value,
  suffix,
  display,
  onStep,
  min,
  max,
}: {
  label: string;
  value: number;
  suffix: string;
  /** overrides the raw number, e.g. a clock label */
  display?: string;
  onStep: (delta: number) => void;
  min: number;
  max: number;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <View style={styles.stepperRow}>
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      <StepperButton label="−" disabled={value <= min} onPress={() => onStep(-5)} />
      <Animated.Text
        key={value}
        entering={reduced ? undefined : FadeInDown.duration(180)}
        style={{ minWidth: 68, textAlign: 'center', color: theme.text, fontVariant: ['tabular-nums'] }}>
        {display ?? `${value} ${suffix}`}
      </Animated.Text>
      <StepperButton label="+" disabled={value >= max} onPress={() => onStep(5)} />
    </View>
  );
}

function StepperButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.stepperButton,
        { backgroundColor: theme.backgroundSelected },
        disabled && styles.disabled,
      ]}>
      <ThemedText style={{ color: theme.text }}>{label}</ThemedText>
    </PressableScale>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  const enter = useEnter();
  return (
    <Animated.View entering={enter(0)} style={styles.empty}>
      <View style={[styles.emptyOrb, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}33`}]} />
      <ThemedText type="smallBold">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
          {hint}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  tint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // Absolutely positioned and childless except for its own gradient, so a translateX
  // sweep costs no layout for the card's real content.
  sheen: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6 },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  chipSmall: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  segments: { flexDirection: 'row', borderRadius: Radius.pill, padding: 3, overflow: 'hidden' },
  segmentPill: { position: 'absolute', top: 3, bottom: 3, borderRadius: Radius.pill },
  segment: { flex: 1 },
  segmentInner: { paddingVertical: Spacing.two, alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  track: { width: '100%', overflow: 'hidden' },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 4,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
    minHeight: 46,
  },
  disabled: { opacity: 0.45 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: { paddingVertical: Spacing.five, alignItems: 'center', gap: Spacing.two },
  emptyOrb: { width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  emptyHint: { textAlign: 'center' },
});
