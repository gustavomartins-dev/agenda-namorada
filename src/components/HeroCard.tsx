import { LinearGradient } from 'expo-linear-gradient';
import { Clock3, Plus, Sparkles } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AgendaEvent } from '@/domain/agenda';
import {
  categoryTheme,
  colors,
  fonts,
  gradients,
  radii,
  shadows,
  spacing,
} from '@/theme/tokens';

import { PrimaryButton } from './PrimaryButton';

type HeroCardProps = {
  nextEvent?: AgendaEvent;
  onCreate: () => void;
};

export function HeroCard({ nextEvent, onCreate }: HeroCardProps) {
  const category = nextEvent ? categoryTheme[nextEvent.category] : undefined;

  return (
    <LinearGradient
      colors={gradients.hero}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.card}
    >
      <View pointerEvents="none" style={styles.bigHeart}>
        <Text style={styles.bigHeartText}>♥</Text>
      </View>
      <View pointerEvents="none" style={styles.sparkle}>
        <Sparkles size={18} color="rgba(255, 214, 232, 0.55)" />
      </View>

      <View style={styles.content}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>
            {nextEvent ? 'SEU PRÓXIMO PLANO' : 'SEU ESPAÇO, SUAS REGRAS'}
          </Text>
        </View>

        {nextEvent ? (
          <>
            <Text numberOfLines={2} style={styles.title}>
              {nextEvent.title}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Clock3 size={14} color={colors.softPink} />
                <Text style={styles.metaText}>{nextEvent.startTime}</Text>
              </View>
              <View style={[styles.metaChip, { backgroundColor: category?.soft }]}>
                <Text style={[styles.metaText, { color: category?.color }]}>
                  {category?.emoji} {category?.label}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Seu dia, do seu jeitinho.</Text>
            <Text style={styles.description}>
              Organize o que importa e deixe um espacinho para você. 💜
            </Text>
          </>
        )}

        <PrimaryButton
          compact
          icon={Plus}
          label={nextEvent ? 'Novo plano' : 'Criar primeiro plano'}
          onPress={onCreate}
          style={styles.button}
        />
      </View>

      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="Kuromi abraçando uma agenda lilás"
        resizeMode="contain"
        source={require('../../assets/images/kuromi-planner.png')}
        style={styles.character}
      />
      <LinearGradient
        colors={['rgba(33, 16, 45, 0)', 'rgba(22, 11, 32, 0.52)']}
        pointerEvents="none"
        style={styles.characterFade}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    minHeight: 226,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(231, 212, 255, 0.2)',
    ...shadows.card,
  },
  content: {
    width: '62%',
    minHeight: 226,
    padding: spacing.lg,
    zIndex: 3,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(14, 9, 20, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.hotPink,
  },
  badgeText: {
    color: colors.softPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -0.2,
  },
  description: {
    color: colors.lavender,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(14, 9, 20, 0.56)',
  },
  metaText: {
    color: colors.softPink,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  button: {
    marginTop: spacing.md,
  },
  character: {
    position: 'absolute',
    width: 195,
    height: 250,
    right: -18,
    bottom: -17,
    zIndex: 1,
  },
  characterFade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 190,
    height: 55,
    zIndex: 2,
  },
  bigHeart: {
    position: 'absolute',
    right: 110,
    top: 18,
    opacity: 0.1,
    transform: [{ rotate: '-12deg' }],
  },
  bigHeartText: {
    color: colors.softPink,
    fontSize: 58,
  },
  sparkle: {
    position: 'absolute',
    right: 18,
    top: 18,
    zIndex: 2,
  },
});
