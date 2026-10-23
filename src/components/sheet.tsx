import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { PressableScale } from './kit';

import { TIMING_EASE_OUT, project, rubberband } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { impactHaptic } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

/**
 * The panel itself rides the native Modal slide (correct layering over the tab bar, free
 * interruptible in/out). The gesture adds a finger-driven dismissal on top of that.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const translateY = useSharedValue(0);
  const context = useSharedValue(0);
  const height = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reduced)
        .activeOffsetY([-12, 12])
        .onStart(() => {
          context.set(translateY.get());
          scheduleOnRN(setDragging, true);
        })
        .onUpdate((e) => {
          const next = context.get() + e.translationY;
          const h = height.get();
          // downward is free; pushing past the top resists instead of stopping dead
          translateY.set(next >= 0 ? next : rubberband(next, Math.max(1, h)));
        })
        .onEnd((e) => {
          scheduleOnRN(setDragging, false);
          const h = height.get();
          if (translateY.get() + project(e.velocityY) > h * 0.35) {
            translateY.set(
              withTiming(h, { duration: 200, easing: TIMING_EASE_OUT }, (finished) => {
                if (finished) {
                  translateY.set(0);
                  scheduleOnRN(onClose);
                }
              }),
            );
            scheduleOnRN(impactHaptic, 'medium');
          } else {
            translateY.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
            scheduleOnRN(impactHaptic, 'light');
          }
        }),
    [onClose, reduced, translateY, context, height],
  );

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdropWrap}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="关闭"
        />
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={(e) => height.set(e.nativeEvent.layout.height)}
            style={[
              panelStyle,
              styles.sheet,
              {
                backgroundColor: theme.background,
                borderTopLeftRadius: Radius.lg + 4,
                borderTopRightRadius: Radius.lg + 4,
                shadowColor: '#000',
                shadowOpacity: 0.16,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -8 },
              },
            ]}>
            <View style={styles.grabberZone}>
              <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
              <View style={styles.sheetHeader}>
                <ThemedText type="subtitle" style={styles.sheetTitle}>
                  {title}
                </ThemedText>
                <PressableScale onPress={onClose} haptic="none" hitSlop={14} accessibilityLabel="关闭">
                  <ThemedText type="default" themeColor="textSecondary">
                    关闭
                  </ThemedText>
                </PressableScale>
              </View>
            </View>
            <Animated.View
              entering={reduced ? undefined : FadeInUp.duration(260).delay(90)}
              style={styles.sheetBody}>
              <ScrollView
                contentContainerStyle={[styles.sheetContent, { paddingBottom: Spacing.six + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!dragging}>
                {children}
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        {
          color: theme.text,
          backgroundColor: theme.backgroundElement,
          borderColor: focused ? theme.accent : theme.border,
          borderWidth: focused ? 1.5 : 1,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(6,10,22,0.45)' },
  sheet: { maxHeight: '86%', overflow: 'hidden' },
  grabberZone: { alignItems: 'center', paddingTop: Spacing.two, gap: Spacing.one },
  grabber: { width: 42, height: 5, borderRadius: Radius.pill },
  sheetHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  sheetTitle: { fontSize: 24, lineHeight: 32 },
  sheetBody: { flexShrink: 1 },
  sheetContent: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
});
