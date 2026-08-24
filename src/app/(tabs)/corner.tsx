import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  Heart,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/PageHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAgenda } from '@/store/AgendaProvider';
import {
  colors,
  fonts,
  gradients,
  radii,
  shadows,
  spacing,
} from '@/theme/tokens';

export default function CornerScreen() {
  const { events, preferences, updatePreferences } = useAgenda();
  const [note, setNote] = useState(preferences.loveNote);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNote(preferences.loveNote);
  }, [preferences.loveNote]);

  const stats = useMemo(() => {
    const completed = events.filter((event) => event.completed).length;
    const days = new Set(events.map((event) => event.date)).size;
    return { total: events.length, completed, days };
  }, [events]);

  const saveNote = () => {
    const cleanNote = note.trim();
    if (!cleanNote) {
      return;
    }
    updatePreferences({ loveNote: cleanNote });
    setSaved(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <AppScreen contentContainerStyle={styles.screenContent}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <PageHeader
          eyebrow="Feito especialmente para você"
          subtitle="Um pedacinho seu dentro do app"
          title="Cantinho da Nicolly"
        />

        <LinearGradient colors={gradients.hero} style={styles.profileCard}>
          <View pointerEvents="none" style={styles.profileGlow} />
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Ícone da Kuromi com um coração roxo"
            source={require('../../../assets/app-icon-kuromi.png')}
            style={styles.profileImage}
          />
          <View style={styles.profileCopy}>
            <View style={styles.privateBadge}>
              <ShieldCheck size={12} color={colors.success} />
              <Text style={styles.privateBadgeText}>SEU APP PESSOAL</Text>
            </View>
            <Text style={styles.profileTitle}>Nicolly's space</Text>
            <Text style={styles.profileSubtitle}>
              Fofa, organizada e com atitude. Do jeitinho que tem que ser. 💜
            </Text>
          </View>
          <Sparkles
            color="rgba(255, 214, 232, 0.5)"
            size={20}
            style={styles.profileSparkle}
          />
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatCard label="planos" value={stats.total} />
          <StatCard label="concluídos" value={stats.completed} pink />
          <StatCard label="dias únicos" value={stats.days} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Heart size={18} color={colors.hotPink} fill={colors.hotPink} />
            </View>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Recadinho do Gustavo</Text>
              <Text style={styles.cardSubtitle}>Ele aparece na tela Hoje</Text>
            </View>
          </View>

          <TextInput
            accessibilityLabel="Recadinho do Gustavo"
            maxLength={180}
            multiline
            onChangeText={(value) => {
              setNote(value);
              setSaved(false);
            }}
            placeholder="Escreva um recadinho carinhoso..."
            placeholderTextColor={colors.textSubtle}
            selectionColor={colors.hotPink}
            style={styles.noteInput}
            textAlignVertical="top"
            value={note}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.counter}>{note.length}/180</Text>
            {saved ? (
              <View accessibilityLiveRegion="polite" style={styles.savedPill}>
                <CheckCircle2 size={13} color={colors.success} />
                <Text style={styles.savedText}>Salvo</Text>
              </View>
            ) : null}
          </View>
          <PrimaryButton
            disabled={!note.trim() || note.trim() === preferences.loveNote}
            icon={Save}
            label="Guardar recadinho"
            onPress={saveNote}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, styles.paletteIcon]}>
              <Palette size={18} color={colors.primary} />
            </View>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Sua vibe</Text>
              <Text style={styles.cardSubtitle}>Punk-kawaii em cada detalhe</Text>
            </View>
          </View>

          <View style={styles.paletteRow}>
            {[colors.canvas, colors.primary, colors.hotPink, colors.softPink].map(
              (color, index) => (
                <View
                  key={color}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    index === 0 && styles.darkSwatch,
                  ]}
                />
              ),
            )}
            <Text style={styles.paletteLabel}>Kuromi purple</Text>
          </View>

          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Efeitos delicados</Text>
              <Text style={styles.settingDescription}>
                Animações curtas ao abrir as telas
              </Text>
            </View>
            <Switch
              accessibilityLabel="Efeitos delicados"
              onValueChange={(enabled) => {
                updatePreferences({ reduceMotion: !enabled });
                void Haptics.selectionAsync();
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.surfaceSoft, true: colors.primaryPressed }}
              value={!preferences.reduceMotion}
            />
          </View>
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutHeart}>♥</Text>
          <Text style={styles.aboutTitle}>Um presente do Gustavo para a Nicolly</Text>
          <Text style={styles.aboutText}>
            Feito com carinho para uso pessoal. Kuromi é uma personagem da Sanrio;
            este aplicativo não é oficial nem possui afiliação com a marca.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function StatCard({
  value,
  label,
  pink = false,
}: {
  value: number;
  label: string;
  pink?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, pink && styles.statValuePink]}>{value}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 132,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  profileCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 178,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(231, 212, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  profileGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    left: -50,
    top: -50,
    backgroundColor: 'rgba(255, 92, 157, 0.12)',
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255, 214, 232, 0.45)',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  privateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(112, 214, 163, 0.12)',
    marginBottom: spacing.xs,
  },
  privateBadgeText: {
    color: colors.success,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  profileTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 23,
  },
  profileSubtitle: {
    color: colors.lavender,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  profileSparkle: {
    position: 'absolute',
    right: 17,
    top: 17,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 5,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  statValuePink: {
    color: colors.hotPink,
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 92, 157, 0.12)',
  },
  paletteIcon: {
    backgroundColor: 'rgba(183, 120, 255, 0.12)',
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  noteInput: {
    minHeight: 118,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.canvasSoft,
    borderWidth: 1,
    borderColor: colors.borderBright,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
  },
  inputFooter: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  savedText: {
    color: colors.success,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.lg,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  darkSwatch: {
    borderColor: colors.borderBright,
  },
  paletteLabel: {
    flex: 1,
    color: colors.lavender,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textAlign: 'right',
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  settingDescription: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  aboutCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderBright,
    backgroundColor: 'rgba(26, 17, 35, 0.56)',
  },
  aboutHeart: {
    color: colors.hotPink,
    fontSize: 28,
  },
  aboutTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  aboutText: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
