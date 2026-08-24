import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Quote } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';

type LoveNoteCardProps = {
  note: string;
};

export function LoveNoteCard({ note }: LoveNoteCardProps) {
  return (
    <LinearGradient colors={gradients.love} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Heart size={18} color={colors.softPink} fill={colors.hotPink} />
        </View>
        <Text style={styles.eyebrow}>RECADINHO DO GUSTAVO</Text>
      </View>
      <Quote size={24} color="rgba(255, 214, 232, 0.25)" style={styles.quote} />
      <Text style={styles.note}>{note}</Text>
      <View style={styles.stitch} />
      <Text style={styles.signature}>com carinho, sempre 💜</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 185, 0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 92, 157, 0.14)',
  },
  eyebrow: {
    color: colors.softPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  quote: {
    position: 'absolute',
    right: 19,
    top: 19,
  },
  note: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.md,
  },
  stitch: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 214, 232, 0.22)',
    marginTop: spacing.md,
  },
  signature: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
