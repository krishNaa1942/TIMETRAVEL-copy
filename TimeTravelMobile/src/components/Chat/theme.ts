/**
 * 🎨 CHAT THEME CONFIGURATION
 */

import { ChatTheme } from './types';
import { colors } from '@/theme/colors';

export const lightTheme: ChatTheme = {
  mode: 'light',
  userBubbleBackground: colors.primary,
  userBubbleText: '#FFFFFF',
  userBubbleTimestamp: 'rgba(255,255,255,0.7)',
  botBubbleBackground: colors.surface,
  botBubbleText: colors.text,
  botBubbleTimestamp: colors.gray,
  botBubbleBorder: colors.border,
  backgroundColor: colors.background,
  surfaceColor: colors.surface,
  borderColor: colors.border,
  primaryColor: colors.primary,
  errorColor: colors.error,
  successColor: colors.success,
  textPrimary: colors.text,
  textSecondary: colors.textSecondary,
  textMuted: colors.gray,
};

export const darkTheme: ChatTheme = {
  mode: 'dark',
  userBubbleBackground: colors.primary,
  userBubbleText: '#FFFFFF',
  userBubbleTimestamp: 'rgba(255,255,255,0.6)',
  botBubbleBackground: '#2A2A2A',
  botBubbleText: '#FFFFFF',
  botBubbleTimestamp: 'rgba(255,255,255,0.5)',
  botBubbleBorder: '#3A3A3A',
  backgroundColor: '#1A1A1A',
  surfaceColor: '#2A2A2A',
  borderColor: '#3A3A3A',
  primaryColor: colors.primary,
  errorColor: '#FF5252',
  successColor: '#4CAF50',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
};