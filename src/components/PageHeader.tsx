import { useRouter } from 'expo-router';
import { Heart, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, MIN_TOUCH_SIZE, radii, spacing } from '@/theme/tokens';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showCornerShortcut?: boolean;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  showCornerShortcut = false,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        {eyebrow ? (
          <View style={styles.eyebrowRow}>
            <Sparkles size={13} color={colors.hotPink} strokeWidth={2.5} />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {showCornerShortcut ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir o cantinho da Nicolly"
          hitSlop={8}
          onPress={() => router.push('/corner')}
          style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
        >
          <Heart size={23} color={colors.softPink} fill={colors.hotPink} />
          <View style={styles.shortcutDot} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  eyebrow: {
    color: colors.hotPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 35,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  shortcut: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  shortcutDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    top: 7,
    right: 7,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
