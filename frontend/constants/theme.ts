export type ThemeColors = Record<keyof typeof lightColors, string>;

// ---------------------------------------------------------------------------
// SkillBridge AI — Professional color system
// Inspired by the logo: deep navy, emerald growth, royal blue, indigo nodes
// ---------------------------------------------------------------------------

const brand = {
  navy: '#0F172A',          // logo arches + primary text
  royalBlue: '#2563EB',     // "AI" accent + interactive
  skyBlue: '#3B82F6',       // secondary interactive
  emerald: '#059669',       // growth / mentorship / success
  teal: '#14B8A6',          // tertiary accents
  indigo: '#6366F1',        // network nodes / AI magic
  violet: '#8B5CF6',        // premium accent
} as const;

export const lightColors = {
  // Brand
  primary: brand.navy,
  secondary: brand.emerald,
  tertiary: brand.royalBlue,
  quaternary: brand.indigo,

  // Surfaces
  surface: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  surfaceContainerLow: '#F1F5F9',
  surfaceContainerHigh: '#E2E8F0',

  // Text
  onPrimary: '#FFFFFF',
  onSurface: '#0F172A',
  onSurfaceVariant: '#475569',
  onSurfaceMuted: '#64748B',

  // Borders
  outline: '#94A3B8',
  outlineVariant: '#E2E8F0',

  // Semantic
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#991B1B',

  success: brand.emerald,
  successContainer: '#ECFDF5',
  onSuccessContainer: '#065F46',

  warning: '#D97706',
  warningContainer: '#FFFBEB',
  onWarningContainer: '#92400E',

  info: brand.royalBlue,
  infoContainer: '#EFF6FF',
  onInfoContainer: '#1E40AF',

  tertiaryContainer: '#EEF2FF',
  onTertiaryContainer: '#3730A3',

  // Special
  darkHero: '#0F172A',
  darkHeroBorder: '#1E293B',
  darkHeroCard: '#1E293B',
} as const;

export const darkColors = {
  // Brand
  primary: '#F8FAFC',
  secondary: '#34D399',
  tertiary: '#60A5FA',
  quaternary: '#818CF8',

  // Surfaces
  surface: '#0F172A',
  surfaceCard: '#1E293B',
  surfaceContainerLow: '#334155',
  surfaceContainerHigh: '#475569',

  // Text
  onPrimary: '#0F172A',
  onSurface: '#F8FAFC',
  onSurfaceVariant: '#CBD5E1',
  onSurfaceMuted: '#94A3B8',

  // Borders
  outline: '#64748B',
  outlineVariant: '#334155',

  // Semantic
  error: '#F87171',
  errorContainer: '#450A0A',
  onErrorContainer: '#FECACA',

  success: '#34D399',
  successContainer: '#064E3B',
  onSuccessContainer: '#D1FAE5',

  warning: '#FBBF24',
  warningContainer: '#451A03',
  onWarningContainer: '#FEF3C7',

  info: '#60A5FA',
  infoContainer: '#172554',
  onInfoContainer: '#DBEAFE',

  tertiaryContainer: '#312E81',
  onTertiaryContainer: '#E0E7FF',

  // Special
  darkHero: '#020617',
  darkHeroBorder: '#1E293B',
  darkHeroCard: '#1E293B',
} as const;

export function createThemeColors(isDark = false): ThemeColors {
  return isDark ? darkColors : lightColors;
}

/**
 * @deprecated Use `useTheme()` from `@/context/ThemeContext` for theme-aware colors.
 * This static export remains as the default light palette for files not yet migrated.
 */
export const colors = lightColors;

export const typography = {
  displayLg: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 48, lineHeight: 58, letterSpacing: -0.96 },
  headlineLg: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, lineHeight: 40, letterSpacing: -0.32 },
  headlineMd: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 24, lineHeight: 34 },
  headlineSm: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20, lineHeight: 28 },
  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: 18, lineHeight: 29 },
  bodyMd: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  labelMd: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 17, letterSpacing: 0.14 },
  labelSm: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 14 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
