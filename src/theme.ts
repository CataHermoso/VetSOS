// VetSOS design tokens: white + violet, clean "medical" look.
// Red is reserved for warnings only.

export const colors = {
  background: '#FFFFFF',
  surface: '#F7F5FC',
  border: '#E4DEF2',

  primary: '#6B3FD4', // violet — main actions
  primaryPressed: '#5631B3',
  primarySoft: '#F3EEFF',
  onPrimary: '#FFFFFF',

  text: '#1E1636',
  textMuted: '#6E6788',

  success: '#1F9D6B',
  successSoft: '#E5F6EF',
  warning: '#D23B3B', // warnings only, never a main color
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  title: 28,
  subtitle: 18,
  body: 16,
  small: 14,
} as const;
