import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CalendarDays,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileHeart,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  AgendaEventDraft,
  CategoryId,
  NotificationIssue,
} from '@/domain/agenda';
import { useAgenda } from '@/store/AgendaProvider';
import {
  categoryTheme,
  colors,
  fonts,
  MIN_TOUCH_SIZE,
  radii,
  spacing,
} from '@/theme/tokens';
import {
  formatLongDate,
  fromDateKey,
  isValidTime,
  shiftDateKey,
  toDateKey,
} from '@/utils/date';

const durationOptions = [30, 60, 90, 120] as const;
const reminderOptions = [null, 10, 30, 60, 120] as const;
const categoryOptions = Object.keys(categoryTheme) as CategoryId[];

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function notificationIssueMessage(issue: NotificationIssue): string {
  switch (issue) {
    case 'permission-denied':
      return 'O compromisso foi salvo, mas as notificações estão bloqueadas nas configurações do aparelho.';
    case 'past':
      return 'O compromisso foi salvo, mas o horário escolhido para o lembrete já passou.';
    case 'unsupported':
      return 'O compromisso foi salvo. Lembretes locais não estão disponíveis na versão web.';
    case 'cancel-failed':
      return 'Não consegui cancelar o lembrete anterior, então mantive o compromisso sem alterações para evitar alarmes duplicados.';
    default:
      return 'O compromisso foi salvo, mas não consegui programar o lembrete agora.';
  }
}

export default function EventFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; date?: string | string[] }>();
  const id = getSingleParam(params.id) ?? 'new';
  const requestedDate = getSingleParam(params.date);
  const isCreating = id === 'new';
  const {
    addEvent,
    deleteEvent,
    getEvent,
    hydrated,
    updateEvent,
  } = useAgenda();
  const existingEvent = getEvent(id);
  const initializedFor = useRef<string | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : toDateKey(new Date()),
  );
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [category, setCategory] = useState<CategoryId>('personal');
  const [notes, setNotes] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(30);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existingEvent || initializedFor.current === existingEvent.id) {
      return;
    }

    setTitle(existingEvent.title);
    setDate(existingEvent.date);
    setStartTime(existingEvent.startTime);
    setDurationMinutes(existingEvent.durationMinutes);
    setCategory(existingEvent.category);
    setNotes(existingEvent.notes);
    setReminderMinutesBefore(existingEvent.reminderMinutesBefore);
    initializedFor.current = existingEvent.id;
  }, [existingEvent]);

  const selectedDate = useMemo(() => fromDateKey(date), [date]);

  const save = async () => {
    if (saving) {
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Dê um nome para esse planinho.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!isValidTime(startTime)) {
      setError('Digite um horário válido no formato 09:30.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    setError('');

    const draft: AgendaEventDraft = {
      title: cleanTitle,
      date,
      startTime,
      durationMinutes,
      category,
      notes: notes.trim(),
      reminderMinutesBefore,
    };

    const result = isCreating
      ? await addEvent(draft)
      : await updateEvent(id, draft);

    if (!result.event) {
      setSaving(false);
      setError(
        result.notificationIssue === 'cancel-failed'
          ? notificationIssueMessage('cancel-failed')
          : 'Esse planinho não está mais disponível.',
      );
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result.notificationIssue) {
      Alert.alert(
        'Planinho salvo 💜',
        notificationIssueMessage(result.notificationIssue),
        [{ text: 'Entendi', onPress: () => router.back() }],
      );
    } else {
      router.back();
    }
  };

  const confirmDelete = () => {
    if (!existingEvent) {
      return;
    }

    Alert.alert(
      'Excluir esse planinho?',
      `“${existingEvent.title}” será removido da agenda.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteEvent(existingEvent.id);
            if (!result.event) {
              Alert.alert(
                'Não excluí o planinho',
                notificationIssueMessage('cancel-failed'),
              );
              return;
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ],
    );
  };

  if (hydrated && !isCreating && !existingEvent) {
    return (
      <AppScreen contentContainerStyle={styles.notFoundScreen} includeBottomInset>
        <View style={styles.notFoundIcon}>
          <FileHeart size={34} color={colors.primary} />
        </View>
        <Text style={styles.notFoundTitle}>Esse planinho não existe mais</Text>
        <Text style={styles.notFoundText}>
          Ele pode ter sido excluído ou não ter sido salvo corretamente.
        </Text>
        <PrimaryButton label="Voltar para a agenda" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.screenContent} includeBottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.dragHandle} />
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Fechar sem salvar"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <X size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <Sparkles size={13} color={colors.hotPink} />
              <Text style={styles.eyebrow}>
                {isCreating ? 'NOVO PLANINHO' : 'EDITAR PLANINHO'}
              </Text>
            </View>
            <Text style={styles.headerTitle}>
              {isCreating ? 'O que vamos organizar?' : 'Deixe tudo do seu jeito'}
            </Text>
          </View>
          {!isCreating ? (
            <Pressable
              accessibilityLabel="Excluir compromisso"
              accessibilityRole="button"
              hitSlop={8}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <Trash2 size={20} color={colors.danger} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.form}>
          <FieldLabel label="Nome do planinho" required />
          <TextInput
            accessibilityLabel="Nome do planinho"
            autoCapitalize="sentences"
            maxLength={80}
            onChangeText={(value) => {
              setTitle(value);
              if (error) setError('');
            }}
            placeholder="Ex.: Dia de autocuidado"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="next"
            selectionColor={colors.hotPink}
            style={[styles.input, error && !title.trim() && styles.inputError]}
            value={title}
          />

          <View style={styles.fieldBlock}>
            <FieldLabel icon={CalendarDays} label="Data" />
            <View style={styles.datePicker}>
              <Pressable
                accessibilityLabel="Dia anterior"
                accessibilityRole="button"
                onPress={() => {
                  setDate((value) => shiftDateKey(value, -1));
                  void Haptics.selectionAsync();
                }}
                style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
              >
                <ChevronLeft size={21} color={colors.lavender} />
              </Pressable>
              <View style={styles.dateCopy}>
                <Text style={styles.dateText}>{formatLongDate(selectedDate)}</Text>
                <Text style={styles.dateHint}>Toque nas setas para mudar o dia</Text>
              </View>
              <Pressable
                accessibilityLabel="Próximo dia"
                accessibilityRole="button"
                onPress={() => {
                  setDate((value) => shiftDateKey(value, 1));
                  void Haptics.selectionAsync();
                }}
                style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
              >
                <ChevronRight size={21} color={colors.lavender} />
              </Pressable>
            </View>
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.timeColumn}>
              <FieldLabel icon={Clock3} label="Horário" />
              <TextInput
                accessibilityLabel="Horário"
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={(value) => {
                  setStartTime(formatTimeInput(value));
                  if (error) setError('');
                }}
                placeholder="09:00"
                placeholderTextColor={colors.textSubtle}
                selectionColor={colors.hotPink}
                style={[styles.input, !isValidTime(startTime) && styles.inputError]}
                value={startTime}
              />
            </View>
            <View style={styles.durationColumn}>
              <FieldLabel label="Duração" />
              <View style={styles.durationGrid}>
                {durationOptions.map((duration) => {
                  const selected = durationMinutes === duration;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={duration}
                      onPress={() => {
                        setDurationMinutes(duration);
                        void Haptics.selectionAsync();
                      }}
                      style={({ pressed }) => [
                        styles.durationChip,
                        selected && styles.durationChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          selected && styles.durationTextSelected,
                        ]}
                      >
                        {duration >= 60 ? `${duration / 60}h` : `${duration}m`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel label="Categoria" />
            <View accessibilityRole="radiogroup" style={styles.categoryGrid}>
              {categoryOptions.map((categoryId) => {
                const item = categoryTheme[categoryId];
                const selected = category === categoryId;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={categoryId}
                    onPress={() => {
                      setCategory(categoryId);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      selected && {
                        backgroundColor: item.soft,
                        borderColor: item.color,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.categoryEmoji, { color: item.color }]}>
                      {item.emoji}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryText,
                        selected && { color: item.color },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel icon={BellRing} label="Lembrar antes" />
            <View accessibilityRole="radiogroup" style={styles.reminderGrid}>
              {reminderOptions.map((minutes) => {
                const selected = reminderMinutesBefore === minutes;
                const label =
                  minutes === null
                    ? 'Sem lembrete'
                    : minutes >= 60
                      ? `${minutes / 60}h antes`
                      : `${minutes}min antes`;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={minutes ?? 'none'}
                    onPress={() => {
                      setReminderMinutesBefore(minutes);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.reminderChip,
                      selected && styles.reminderChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderText,
                        selected && styles.reminderTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel icon={FileHeart} label="Notinhas" />
            <TextInput
              accessibilityLabel="Notas do compromisso"
              maxLength={240}
              multiline
              onChangeText={setNotes}
              placeholder="Detalhes, endereço, uma motivação..."
              placeholderTextColor={colors.textSubtle}
              selectionColor={colors.hotPink}
              style={[styles.input, styles.notesInput]}
              textAlignVertical="top"
              value={notes}
            />
            <Text style={styles.counter}>{notes.length}/240</Text>
          </View>

          {error ? (
            <View accessibilityLiveRegion="assertive" style={styles.errorBox}>
              <Text style={styles.errorHeart}>♥</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            disabled={saving}
            icon={Save}
            label={isCreating ? 'Guardar na agenda' : 'Salvar mudanças'}
            onPress={save}
          />
          <Text style={styles.saveHint}>
            Tudo fica salvo somente neste aparelho. Privado e do seu jeitinho.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function FieldLabel({
  label,
  required = false,
  icon: Icon,
}: {
  label: string;
  required?: boolean;
  icon?: typeof CalendarDays;
}) {
  return (
    <View style={styles.labelRow}>
      {Icon ? <Icon size={15} color={colors.primary} /> : null}
      <Text style={styles.label}>{label}</Text>
      {required ? <Text style={styles.required}>*</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderBright,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  closeButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 107, 122, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 122, 0.24)',
  },
  headerSpacer: {
    width: MIN_TOUCH_SIZE,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrow: {
    color: colors.hotPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 3,
  },
  form: {
    gap: spacing.sm,
  },
  fieldBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 22,
  },
  label: {
    color: colors.lavender,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  required: {
    color: colors.hotPink,
    fontFamily: fonts.bodyBold,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputError: {
    borderColor: 'rgba(255, 107, 122, 0.7)',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 74,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xs,
  },
  dateArrow: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  dateCopy: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  dateText: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    textAlign: 'center',
  },
  dateHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timeColumn: {
    flex: 0.42,
    gap: spacing.xs,
  },
  durationColumn: {
    flex: 0.58,
    gap: spacing.xs,
  },
  durationGrid: {
    minHeight: 54,
    flexDirection: 'row',
    gap: 5,
  },
  durationChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  durationText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  durationTextSelected: {
    color: colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  reminderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  reminderChip: {
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reminderChipSelected: {
    borderColor: colors.hotPink,
    backgroundColor: 'rgba(255, 92, 157, 0.12)',
  },
  reminderText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  reminderTextSelected: {
    color: colors.softPink,
  },
  categoryChip: {
    width: '48.5%',
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  categoryEmoji: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 16,
  },
  categoryText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 116,
    paddingTop: spacing.md,
  },
  counter: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    textAlign: 'right',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 107, 122, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 122, 0.28)',
    marginVertical: spacing.xs,
  },
  errorHeart: {
    color: colors.danger,
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  saveHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  notFoundScreen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  notFoundIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  notFoundTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 22,
    textAlign: 'center',
  },
  notFoundText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 330,
  },
});
