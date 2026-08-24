import { Platform } from 'react-native';

export const colors = {
  canvas: '#0E0914',
  canvasSoft: '#160C20',
  surface: '#1A1123',
  surfaceElevated: '#271934',
  surfaceSoft: '#311E40',
  primary: '#B778FF',
  primaryPressed: '#9654DF',
  hotPink: '#FF5C9D',
  softPink: '#FFD6E8',
  lavender: '#E7D4FF',
  white: '#FFF8FF',
  text: '#FFF8FF',
  textMuted: '#C8B8D2',
  textSubtle: '#93839E',
  border: '#3C294C',
  borderBright: '#62437A',
  success: '#70D6A3',
  warning: '#FFC86B',
  danger: '#FF6B7A',
  inkOnAccent: '#170B1D',
  overlay: 'rgba(6, 2, 9, 0.72)',
} as const;

export const gradients = {
  background: ['#21102D', colors.canvas, '#09060D'] as const,
  hero: ['#5B257B', '#2A123A', '#160B20'] as const,
  primary: ['#D59BFF', '#A45CF2', '#8242C7'] as const,
  love: ['#4A1E54', '#301633', '#211020'] as const,
  pink: ['#FF8DB9', '#FF5C9D'] as const,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  display: 'Fredoka_700Bold',
  displaySemiBold: 'Fredoka_600SemiBold',
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 7 },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
  glow: Platform.select({
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 9 },
    default: {},
  }),
} as const;

export const categoryTheme = {
  personal: {
    label: 'Pessoal',
    color: colors.primary,
    soft: '#3A2351',
    emoji: '✦',
  },
  study: {
    label: 'Estudos',
    color: '#8CB7FF',
    soft: '#1D2D49',
    emoji: '✎',
  },
  health: {
    label: 'Bem-estar',
    color: colors.success,
    soft: '#18392F',
    emoji: '♡',
  },
  love: {
    label: 'Especial',
    color: colors.hotPink,
    soft: '#4B1E36',
    emoji: '♥',
  },
} as const;

export const MIN_TOUCH_SIZE = 48;
