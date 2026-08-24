import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import {
  Bot,
  CircleStop,
  Heart,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react-native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AssistantProposalCard } from '@/components/AssistantProposalCard';
import { PageHeader } from '@/components/PageHeader';
import { loadChatMessages, saveChatMessages } from '@/data/chatStorage';
import type { AgendaEvent, NotificationIssue } from '@/domain/agenda';
import type { ChatMessage, ProposalState } from '@/domain/chat';
import {
  AssistantApiError,
  checkAssistantServer,
  sendAssistantMessage,
  transcribeRecording,
} from '@/services/assistantClient';
import {
  executeConfirmedProposal,
  ProposalExecutionError,
} from '@/services/proposalExecutor';
import { useAgenda } from '@/store/AgendaProvider';
import {
  colors,
  fonts,
  MIN_TOUCH_SIZE,
  radii,
  shadows,
  spacing,
} from '@/theme/tokens';
import {
  agendaInstantToIso,
  agendaWallTimeToDate,
} from '@/utils/timeZone';
import {
  AGENDA_TIME_ZONE,
  type AgendaEventContext,
} from '../../../shared/assistant';

const AUTO_STOP_AUDIO_MS = 89_000;
const MAX_CONTEXT_EVENTS = 200;
const MAX_CONTEXT_NOTES = 500;

function makeMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEventContext(event: AgendaEvent): AgendaEventContext | null {
  const startAt = agendaWallTimeToDate(event.date, event.startTime);
  if (!startAt) return null;
  const endAt = new Date(startAt.getTime() + event.durationMinutes * 60_000);
  const startAtIso = agendaInstantToIso(startAt);
  const endAtIso = agendaInstantToIso(endAt);
  if (!startAtIso || !endAtIso) return null;
  return {
    id: event.id,
    title: event.title,
    startAt: startAtIso,
    endAt: endAtIso,
    notes: event.notes.slice(0, MAX_CONTEXT_NOTES),
    reminderMinutesBefore: event.reminderMinutesBefore,
    updatedAt: event.updatedAt,
  };
}

function issueMessage(
  issue: NotificationIssue | null,
  hasReminder: boolean,
): string {
  switch (issue) {
    case 'permission-denied':
      return 'Salvei o compromisso, mas as notificações estão bloqueadas no aparelho.';
    case 'past':
      return 'Salvei o compromisso, mas o horário do lembrete já passou.';
    case 'unsupported':
      return 'Salvei o compromisso. A versão web não agenda notificações locais.';
    case 'schedule-failed':
      return 'Salvei o compromisso, mas o lembrete não pôde ser programado agora.';
    case 'cancel-failed':
      return 'Não alterei o compromisso porque o lembrete anterior não pôde ser cancelado.';
    default:
      return hasReminder
        ? 'Prontinho! O compromisso e o lembrete já estão na sua agenda. 💜'
        : 'Prontinho! O compromisso já está na sua agenda. 💜';
  }
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function releaseRecording(uri: string | null): Promise<void> {
  if (!uri) return;
  if (Platform.OS === 'web') {
    URL.revokeObjectURL(uri);
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The cache may already have removed the temporary recording.
  }
}

export default function AssistantScreen() {
  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    preferences,
    hydrated,
  } = useAgenda();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [audioPhase, setAudioPhase] = useState<
    'idle' | 'recording' | 'preview' | 'transcribing'
  >('idle');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const stoppingRecording = useRef(false);
  const transcriptionAbort = useRef<AbortController | null>(null);
  const confirmationLocked = useRef(false);
  const currentAudioPhase = useRef(audioPhase);
  const currentRecordedUri = useRef(recordedUri);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const assistantReady = hydrated && historyReady;

  useEffect(() => {
    let active = true;
    void loadChatMessages().then((stored) => {
      if (!active) return;
      setMessages(stored);
      setHistoryReady(true);
    });
    void checkAssistantServer().then((online) => {
      if (active) setServerOnline(online);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (historyReady) {
      void saveChatMessages(messages).catch(() => undefined);
    }
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: !preferences.reduceMotion }),
    );
  }, [historyReady, messages, preferences.reduceMotion, sending]);

  useEffect(() => {
    currentAudioPhase.current = audioPhase;
    currentRecordedUri.current = recordedUri;
  }, [audioPhase, recordedUri]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        transcriptionAbort.current?.abort();
        void (async () => {
          if (currentAudioPhase.current === 'recording') {
            await recorder.stop().catch(() => undefined);
            await setAudioModeAsync({
              playsInSilentMode: true,
              allowsRecording: false,
            }).catch(() => undefined);
          }
          await releaseRecording(currentRecordedUri.current ?? recorder.uri);
          setRecordedUri(null);
          setRecordedDurationMs(0);
          setAudioPhase('idle');
        })();
      };
    }, [recorder]),
  );

  const eventContext = useMemo(
    () =>
      events
        .slice(-MAX_CONTEXT_EVENTS)
        .map(toEventContext)
        .filter((event): event is AgendaEventContext => event !== null),
    [events],
  );

  const appendAssistantError = useCallback((error: unknown) => {
    const message =
      error instanceof AssistantApiError
        ? error.message
        : 'Não consegui concluir isso agora. Tente novamente em instantes.';
    setMessages((current) => [
      ...current,
      {
        id: makeMessageId(),
        role: 'assistant',
        content: message,
        createdAt: Date.now(),
        status: 'error',
      },
    ]);
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sending || !assistantReady) return;
      const userMessage: ChatMessage = {
        id: makeMessageId(),
        role: 'user',
        content: clean,
        createdAt: Date.now(),
        status: 'sending',
      };
      setMessages((current) => [...current, userMessage]);
      setInput('');
      setSending(true);
      try {
        const response = await sendAssistantMessage({
          message: clean,
          events: eventContext,
          timeZone: AGENDA_TIME_ZONE,
        });
        setServerOnline(true);
        setMessages((current) => [
          ...current.map((message) =>
            message.id === userMessage.id
              ? { ...message, status: 'sent' as const }
              : message,
          ),
          {
            id: makeMessageId(),
            role: 'assistant',
            content: response.proposal.assistantMessage,
            createdAt: Date.now(),
            status: 'sent',
            proposal:
              response.proposal.type === 'none' ? undefined : response.proposal,
            proposalState:
              response.proposal.type === 'none' ? undefined : 'pending',
          },
        ]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        setServerOnline(false);
        setMessages((current) =>
          current.map((message) =>
            message.id === userMessage.id
              ? { ...message, status: 'error' }
              : message,
          ),
        );
        appendAssistantError(error);
      } finally {
        setSending(false);
      }
    },
    [appendAssistantError, assistantReady, eventContext, sending],
  );

  const setProposalState = (id: string, state: ProposalState) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, proposalState: state } : message,
      ),
    );
  };

  const confirmProposal = async (message: ChatMessage) => {
    const proposal = message.proposal;
    if (
      !proposal ||
      !proposal.requiresConfirmation ||
      proposal.type === 'none' ||
      !assistantReady ||
      confirmationLocked.current
    )
      return;
    confirmationLocked.current = true;
    setBusyProposalId(message.id);
    try {
      const result = await executeConfirmedProposal(proposal, {
        events,
        addEvent,
        updateEvent,
        deleteEvent,
      });

      setProposalState(message.id, 'confirmed');
      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: 'assistant',
          content:
            result.action === 'deleted'
              ? 'Certo — removi esse compromisso da agenda.'
              : issueMessage(
                  result.notificationIssue,
                  proposal.reminderMinutesBefore !== null,
                ),
          createdAt: Date.now(),
          status: 'sent',
        },
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setProposalState(message.id, 'failed');
      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: 'assistant',
          content:
            error instanceof ProposalExecutionError && error.code === 'expired'
              ? 'O horário dessa proposta ou do lembrete já passou. Me diga um novo horário para eu montar outra. 💜'
              : error instanceof ProposalExecutionError &&
                  error.code === 'notification'
                ? 'Não consegui cancelar o lembrete anterior, então mantive a agenda sem alterações para evitar dois alarmes. Tente novamente.'
              : 'Esse compromisso mudou desde a proposta ou não está mais disponível. Me peça de novo para eu conferir a agenda atual.',
          createdAt: Date.now(),
          status: 'error',
        },
      ]);
    } finally {
      confirmationLocked.current = false;
      setBusyProposalId(null);
    }
  };

  const stopRecording = useCallback(async () => {
    if (audioPhase !== 'recording' || stoppingRecording.current) return;
    stoppingRecording.current = true;
    try {
      const duration = recorder.getStatus().durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      if (!uri || duration < 500) {
        await releaseRecording(uri);
        setAudioPhase('idle');
        Alert.alert('Áudio muito curto', 'Segure a ideia por pelo menos um segundinho.');
        return;
      }
      setRecordedDurationMs(duration);
      setRecordedUri(uri);
      setAudioPhase('preview');
    } catch {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => undefined);
      await releaseRecording(recorder.uri);
      setRecordedUri(null);
      setRecordedDurationMs(0);
      setAudioPhase('idle');
      Alert.alert(
        'Não consegui finalizar o áudio',
        'A gravação foi descartada com segurança. Tente novamente.',
      );
    } finally {
      stoppingRecording.current = false;
    }
  }, [audioPhase, recorder]);

  useEffect(() => {
    if (
      audioPhase === 'recording' &&
      recorderState.durationMillis >= AUTO_STOP_AUDIO_MS
    ) {
      void stopRecording();
    }
  }, [audioPhase, recorderState.durationMillis, stopRecording]);

  const startRecording = async () => {
    if (audioPhase !== 'idle' || !assistantReady) return;
    try {
      await releaseRecording(recordedUri);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microfone bloqueado',
          'Ative a permissão do microfone nas configurações para mandar áudio.',
        );
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordedUri(null);
      setRecordedDurationMs(0);
      setAudioPhase('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert('Não consegui gravar', 'Verifique o microfone e tente novamente.');
    }
  };

  const cancelRecording = async () => {
    if (audioPhase === 'transcribing') {
      transcriptionAbort.current?.abort();
    }
    let uri = recordedUri;
    if (audioPhase === 'recording') {
      await recorder.stop().catch(() => undefined);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(
        () => undefined,
      );
      uri = recorder.uri;
    }
    await releaseRecording(uri);
    setRecordedUri(null);
    setRecordedDurationMs(0);
    setAudioPhase('idle');
  };

  const sendRecording = async () => {
    if (!recordedUri || audioPhase !== 'preview') return;
    const uri = recordedUri;
    const abortController = new AbortController();
    transcriptionAbort.current = abortController;
    setAudioPhase('transcribing');
    try {
      const transcript = await transcribeRecording(
        uri,
        recordedDurationMs,
        abortController.signal,
      );
      setRecordedUri(null);
      setRecordedDurationMs(0);
      setAudioPhase('idle');
      await sendText(transcript);
    } catch (error) {
      if (!(error instanceof AssistantApiError && error.code === 'REQUEST_CANCELLED')) {
        appendAssistantError(error);
      }
      setAudioPhase('idle');
    } finally {
      transcriptionAbort.current = null;
      await releaseRecording(uri);
      setRecordedUri(null);
      setRecordedDurationMs(0);
    }
  };

  return (
    <AppScreen scroll={false} contentContainerStyle={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
        style={styles.keyboard}
      >
        <View style={styles.headerWrap}>
          <PageHeader
            eyebrow="Kuromi assistant"
            subtitle="Você fala, ela organiza — só salva com seu ok"
            title="Assistente mágica"
          />
          <View
            accessibilityLiveRegion="polite"
            style={[styles.serverPill, serverOnline === false && styles.serverPillOffline]}
          >
            {serverOnline === false ? (
              <WifiOff size={12} color={colors.warning} />
            ) : (
              <Heart size={11} color={colors.success} fill={colors.success} />
            )}
            <Text
              style={[
                styles.serverText,
                serverOnline === false && styles.serverTextOffline,
              ]}
            >
              {serverOnline === null
                ? 'VERIFICANDO SERVIDOR'
                : serverOnline
                  ? 'SERVIDOR PRIVADO'
                  : 'ASSISTENTE OFFLINE'}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => {
            const assistant = message.role === 'assistant';
            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  !assistant && styles.messageRowUser,
                ]}
              >
                {assistant ? (
                  <View style={styles.avatar}>
                    <Bot size={17} color={colors.softPink} />
                    <View style={styles.avatarDot} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    assistant ? styles.assistantBubble : styles.userBubble,
                    message.status === 'error' && styles.errorBubble,
                  ]}
                >
                  <Text style={styles.messageText}>{message.content}</Text>
                  {!assistant && message.status !== 'sent' ? (
                    <Text style={styles.messageStatus}>
                      {message.status === 'sending' ? 'ENVIANDO…' : 'NÃO ENVIADA'}
                    </Text>
                  ) : null}
                  {message.proposal ? (
                    <AssistantProposalCard
                      busy={!assistantReady || busyProposalId !== null}
                      onCancel={() => {
                        setProposalState(message.id, 'cancelled');
                        void Haptics.selectionAsync();
                      }}
                      onConfirm={() => void confirmProposal(message)}
                      proposal={message.proposal}
                      state={message.proposalState}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
          {sending ? (
            <View style={styles.messageRow}>
              <View style={styles.avatar}>
                <Sparkles size={16} color={colors.softPink} />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                <Text style={styles.typing}>●  ●  ●</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {audioPhase !== 'idle' ? (
          <View style={styles.audioPanel}>
            <View style={[styles.pulse, audioPhase === 'recording' && styles.pulseActive]}>
              {audioPhase === 'recording' ? (
                <Mic size={19} color={colors.hotPink} />
              ) : audioPhase === 'transcribing' ? (
                <RotateCcw size={19} color={colors.primary} />
              ) : (
                <Sparkles size={19} color={colors.primary} />
              )}
            </View>
            <View style={styles.audioCopy}>
              <Text style={styles.audioTitle}>
                {audioPhase === 'recording'
                  ? 'Gravando seu planinho...'
                  : audioPhase === 'transcribing'
                    ? 'Transcrevendo no computador...'
                    : 'Áudio pronto para enviar'}
              </Text>
              <Text style={styles.audioDuration}>
                {formatDuration(
                  audioPhase === 'recording'
                    ? recorderState.durationMillis
                    : recordedDurationMs,
                )}{' '}
                / 1:30
              </Text>
            </View>
            {audioPhase === 'recording' ? (
              <Pressable
                accessibilityLabel="Parar gravação"
                onPress={() => void stopRecording()}
                style={styles.audioAction}
              >
                <CircleStop size={25} color={colors.hotPink} />
              </Pressable>
            ) : audioPhase === 'preview' ? (
              <View style={styles.audioActions}>
                <Pressable
                  accessibilityLabel="Cancelar áudio"
                  onPress={() => void cancelRecording()}
                  style={styles.audioAction}
                >
                  <Trash2 size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Enviar áudio"
                  onPress={() => void sendRecording()}
                  style={[styles.audioAction, styles.audioSend]}
                >
                  <Send size={19} color={colors.inkOnAccent} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="Cancelar transcrição"
                onPress={() => void cancelRecording()}
                style={styles.audioAction}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            accessibilityLabel="Gravar mensagem de áudio"
            accessibilityRole="button"
            disabled={!assistantReady || sending || audioPhase !== 'idle'}
            onPress={() => void startRecording()}
            style={({ pressed }) => [
              styles.micButton,
              pressed && styles.pressed,
              (!assistantReady || sending || audioPhase !== 'idle') && styles.disabled,
            ]}
          >
            <Mic size={22} color={colors.softPink} />
          </Pressable>
          <TextInput
            accessibilityLabel="Mensagem para a assistente"
            maxLength={4_000}
            multiline
            onChangeText={setInput}
            onSubmitEditing={() => void sendText(input)}
            placeholder={
              assistantReady
                ? 'Ex.: dentista sexta às 15h...'
                : 'Preparando sua agenda...'
            }
            placeholderTextColor={colors.textSubtle}
            returnKeyType="send"
            selectionColor={colors.hotPink}
            style={styles.input}
            value={input}
          />
          <Pressable
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            disabled={!assistantReady || !input.trim() || sending}
            onPress={() => void sendText(input)}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.pressed,
              (!assistantReady || !input.trim() || sending) && styles.disabled,
            ]}
          >
            <Send size={20} color={colors.inkOnAccent} strokeWidth={2.7} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: spacing.sm },
  keyboard: { flex: 1 },
  headerWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  serverPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(112, 214, 163, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 163, 0.2)',
  },
  serverPillOffline: {
    backgroundColor: 'rgba(255, 200, 107, 0.08)',
    borderColor: 'rgba(255, 200, 107, 0.2)',
  },
  serverText: { color: colors.success, fontFamily: fonts.bodyExtraBold, fontSize: 8, letterSpacing: 0.8 },
  serverTextOffline: { color: colors.warning },
  messageList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, maxWidth: 680 },
  messageRowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  avatarDot: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.hotPink,
  },
  bubble: { maxWidth: '86%', borderRadius: radii.lg, padding: spacing.md },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: { backgroundColor: colors.primaryPressed, borderBottomRightRadius: 5 },
  errorBubble: { borderColor: 'rgba(255, 200, 107, 0.4)' },
  messageText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20 },
  messageStatus: {
    color: colors.softPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 8,
    letterSpacing: 0.7,
    marginTop: 5,
    textAlign: 'right',
  },
  typingBubble: { minWidth: 74, paddingVertical: spacing.sm },
  typing: { color: colors.primary, fontSize: 9, letterSpacing: 2 },
  audioPanel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  pulse: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183, 120, 255, 0.14)',
  },
  pulseActive: { backgroundColor: 'rgba(255, 92, 157, 0.15)' },
  audioCopy: { flex: 1 },
  audioTitle: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 12 },
  audioDuration: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 10, marginTop: 2 },
  audioActions: { flexDirection: 'row', gap: 5 },
  audioAction: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  audioSend: { backgroundColor: colors.primary },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(14, 9, 20, 0.97)',
  },
  micButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  sendButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.42 },
});
