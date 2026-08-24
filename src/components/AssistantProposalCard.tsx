import { LinearGradient } from 'expo-linear-gradient';
import {
  BellRing,
  CalendarCheck2,
  Check,
  Clock3,
  Pencil,
  Trash2,
  X,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProposalState } from '@/domain/chat';
import {
  colors,
  fonts,
  gradients,
  MIN_TOUCH_SIZE,
  radii,
  spacing,
} from '@/theme/tokens';
import type { EventProposal } from '../../shared/assistant';

function formatProposalDate(value: string | null): string {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatProposalTime(value: string | null): string {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

const actionCopy = {
  create_event: { label: 'NOVO COMPROMISSO', icon: CalendarCheck2 },
  update_event: { label: 'ALTERAR COMPROMISSO', icon: Pencil },
  delete_event: { label: 'EXCLUIR COMPROMISSO', icon: Trash2 },
  none: { label: 'SEM AÇÃO', icon: CalendarCheck2 },
} as const;

export function AssistantProposalCard({
  proposal,
  state = 'pending',
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: EventProposal;
  state?: ProposalState;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const meta = actionCopy[proposal.type];
  const Icon = meta.icon;
  const inactive = state !== 'pending';

  return (
    <View style={[styles.card, proposal.type === 'delete_event' && styles.deleteCard]}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Icon size={13} color={colors.hotPink} />
          <Text style={styles.badgeText}>{meta.label}</Text>
        </View>
        <Text style={styles.skull}>☠</Text>
      </View>

      <Text style={styles.title}>{proposal.title}</Text>
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <CalendarCheck2 size={16} color={colors.primary} />
          <Text style={styles.detailText}>{formatProposalDate(proposal.startAt)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Clock3 size={16} color={colors.primary} />
          <Text style={styles.detailText}>
            {formatProposalTime(proposal.startAt)} — {formatProposalTime(proposal.endAt)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <BellRing size={16} color={colors.hotPink} />
          <Text style={styles.detailText}>
            {proposal.reminderMinutesBefore === null
              ? 'Sem lembrete'
              : `${proposal.reminderMinutesBefore} min antes`}
          </Text>
        </View>
      </View>
      {proposal.notes ? <Text style={styles.notes}>{proposal.notes}</Text> : null}

      {inactive ? (
        <View style={styles.statePill}>
          {state === 'confirmed' ? (
            <Check size={15} color={colors.success} />
          ) : (
            <X size={15} color={colors.textMuted} />
          )}
          <Text style={styles.stateText}>
            {state === 'confirmed'
              ? 'Confirmado e aplicado'
              : state === 'failed'
                ? 'Não foi possível aplicar'
                : 'Proposta cancelada'}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <X size={17} color={colors.textMuted} />
            <Text style={styles.cancelText}>Agora não</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <LinearGradient colors={gradients.primary} style={styles.confirmGradient}>
              <Check size={18} color={colors.inkOnAccent} strokeWidth={3} />
              <Text style={styles.confirmText}>{busy ? 'Salvando...' : 'Confirmar'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.canvasSoft,
    padding: spacing.md,
    overflow: 'hidden',
  },
  deleteCard: { borderColor: 'rgba(255, 107, 122, 0.5)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 92, 157, 0.11)',
  },
  badgeText: {
    color: colors.softPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  skull: { color: colors.hotPink, fontSize: 18 },
  title: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  details: { gap: 7, marginTop: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailText: { color: colors.lavender, fontFamily: fonts.bodyMedium, fontSize: 12 },
  notes: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  cancelButton: {
    minHeight: MIN_TOUCH_SIZE,
    flex: 0.44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 11 },
  confirmButton: { minHeight: MIN_TOUCH_SIZE, flex: 0.56, borderRadius: radii.md, overflow: 'hidden' },
  confirmGradient: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmText: { color: colors.inkOnAccent, fontFamily: fonts.bodyExtraBold, fontSize: 12 },
  statePill: {
    minHeight: MIN_TOUCH_SIZE,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  stateText: { color: colors.textMuted, fontFamily: fonts.bodyBold, fontSize: 11 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.48 },
});
