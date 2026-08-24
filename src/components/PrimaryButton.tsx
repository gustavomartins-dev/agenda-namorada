import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import {
  colors,
  fonts,
  gradients,
  MIN_TOUCH_SIZE,
  radii,
  shadows,
  spacing,
} from '@/theme/tokens';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  compact = false,
  style,
  accessibilityLabel,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        compact && styles.pressableCompact,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={gradients.primary}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.gradient, compact && styles.gradientCompact]}
      >
        {Icon ? <Icon size={18} color={colors.inkOnAccent} strokeWidth={2.6} /> : null}
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 54,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.glow,
  },
  pressableCompact: {
    minHeight: MIN_TOUCH_SIZE,
    alignSelf: 'flex-start',
  },
  gradient: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  gradientCompact: {
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.md,
  },
  label: {
    color: colors.inkOnAccent,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
