export const colors = {
  primary: '#0F172A',       // slate-900  — headers, dark surfaces
  secondary: '#059669',     // emerald-600 — CTAs, success, progress (slightly darker for AA contrast)
  tertiary: '#2563EB',      // blue-600   — interactive, info, "Up Next" (replaces vivid indigo)
  surface: '#F8FAFC',       // slate-50   — page background (neutral, no blue tint)
  surfaceCard: '#FFFFFF',
  surfaceContainerLow: '#F1F5F9',   // slate-100 — subtle fills
  surfaceContainerHigh: '#E2E8F0',  // slate-200 — stronger fills
  onPrimary: '#FFFFFF',
  onSurface: '#0F172A',             // slate-900 — primary text
  onSurfaceVariant: '#475569',      // slate-600 — secondary text
  outline: '#94A3B8',               // slate-400 — borders, placeholders
  outlineVariant: '#E2E8F0',        // slate-200 — subtle dividers
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  success: '#059669',
} as const;

export const typography = {
  displayLg: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 48, lineHeight: 58, letterSpacing: -0.96 },
  headlineLg: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, lineHeight: 40, letterSpacing: -0.32 },
  headlineMd: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 24, lineHeight: 34 },
  headlineSm: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 20, lineHeight: 28 },
  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: 18, lineHeight: 29 },
  bodyMd: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
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
