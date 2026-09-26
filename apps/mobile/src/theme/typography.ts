const jakarta = (weight: 400 | 500 | 600 | 700 | 800) => ({
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
})[weight]

export const typeStyles = {
  display: { fontFamily: jakarta(800), fontSize: 31, lineHeight: 32, fontWeight: '800', letterSpacing: -1.1 },
  title: { fontFamily: jakarta(800), fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.66 },
  titleLg: { fontFamily: jakarta(800), fontSize: 24, lineHeight: 26, fontWeight: '800', letterSpacing: -0.72 },
  dialog: { fontFamily: jakarta(800), fontSize: 18, lineHeight: 22, fontWeight: '800', letterSpacing: -0.36 },
  empty: { fontFamily: jakarta(700), fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.34 },
  rowTitle: { fontFamily: jakarta(700), fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.15 },
  body: { fontFamily: jakarta(500), fontSize: 14.5, lineHeight: 20, fontWeight: '500' },
  meta: { fontFamily: jakarta(500), fontSize: 13, lineHeight: 19, fontWeight: '500' },
  rowMeta: { fontFamily: jakarta(500), fontSize: 12.5, lineHeight: 17, fontWeight: '500' },
  label: { fontFamily: jakarta(600), fontSize: 12, lineHeight: 16, fontWeight: '600' },
  caps: { fontFamily: jakarta(700), fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  badge: { fontFamily: jakarta(700), fontSize: 11.5, lineHeight: 14, fontWeight: '700' },
  pill: { fontFamily: jakarta(600), fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.22 },
  heading: { fontFamily: jakarta(700), fontSize: 16, lineHeight: 22, fontWeight: '700' },
  bodyMedium: { fontFamily: jakarta(500), fontSize: 14.5, lineHeight: 20, fontWeight: '500' },
  caption: { fontFamily: jakarta(500), fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const

export const loginTypeStyles = {
  display: { fontFamily: 'Inter', fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontFamily: 'Inter', fontSize: 20, lineHeight: 26, fontWeight: '600' },
  heading: { fontFamily: 'Inter', fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily: 'Inter', fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyMedium: { fontFamily: 'Inter', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  label: { fontFamily: 'Inter', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  meta: { fontFamily: 'Inter', fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontFamily: 'Inter', fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const

export const tabularNumbers = { fontVariant: ['tabular-nums'] as const }
