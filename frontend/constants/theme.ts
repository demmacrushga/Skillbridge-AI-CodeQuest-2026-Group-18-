export const colors = {
  primary: '#0F172A',       // slate-900 black — headers, primary structure
  secondary: '#2563EB',     // royal blue-600 — CTAs, progress, primary interactive
  tertiary: '#3B82F6',      // electric blue-500 — secondary interactive, info, accents
  surface: '#F8FAFC',       // slate-50   — page background (neutral, crisp white/slate)
  surfaceCard: '#FFFFFF',   // pure white card background
  surfaceContainerLow: '#F1F5F9',   // slate-100 — subtle fills
  surfaceContainerHigh: '#E2E8F0',  // slate-200 — stronger fills
  onPrimary: '#FFFFFF',
  onSurface: '#0F172A',             // slate-900 black — primary text
  onSurfaceVariant: '#475569',      // slate-600 — secondary text
  onSurfaceMuted: '#64748B',        // slate-500 — subtle text
  outline: '#94A3B8',               // slate-400 — borders, placeholders
  outlineVariant: '#E2E8F0',        // slate-200 — subtle dividers
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#991B1B',
  success: '#2563EB',               // royal blue — verified / success indicator
  successContainer: '#EFF6FF',      // blue-50 — badge container
  onSuccessContainer: '#1E40AF',    // blue-800
  warning: '#D97706',               // amber-600 — warning / caution
  warningContainer: '#FFFBEB',      // amber-50
  onWarningContainer: '#92400E',    // amber-800
  tertiaryContainer: '#EFF6FF',     // blue-50
  onTertiaryContainer: '#1E40AF',   // blue-800
  darkHero: '#000000',              // pure black hero card background
  darkHeroBorder: '#262626',        // dark hero card border
  darkHeroCard: '#171717',          // dark stats strip background
} as const;

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
