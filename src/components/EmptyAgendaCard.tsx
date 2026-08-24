import { CalendarHeart, Plus } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';

import { PrimaryButton } from './PrimaryButton';

type EmptyAgendaCardProps = {
  title?: string;
  description?: string;
  onCreate: () => void;
};

export function EmptyAgendaCard({
  title = 'Um dia todinho em branco',
  description = 'Sem pressa e sem caos. Quando quiser, coloque aqui o seu próximo planinho.',
  onCreate,
}: EmptyAgendaCardProps) {
  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.heartWatermark}>
        <Text style={styles.heartWatermarkText}>♥</Text>
      </View>
      <View style={styles.iconWrap}>
        <CalendarHeart size={29} color={colors.primary} strokeWidth={1.8} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <PrimaryButton compact icon={Plus} label="Adicionar" onPress={onCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  copy: {
    marginVertical: spacing.md,
    maxWidth: '82%',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  heartWatermark: {
    position: 'absolute',
    right: -9,
    top: -25,
    opacity: 0.055,
    transform: [{ rotate: '15deg' }],
  },
  heartWatermarkText: {
    color: colors.softPink,
    fontSize: 150,
  },
});
