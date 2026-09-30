const systemFont = undefined

export const typeStyles = {
  display: { fontFamily: systemFont, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontFamily: systemFont, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  titleLg: { fontFamily: systemFont, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.6 },
  dialog: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  empty: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  rowTitle: { fontFamily: systemFont, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  body: { fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400' },
  meta: { fontFamily: systemFont, fontSize: 14, lineHeight: 19, fontWeight: '400' },
  rowMeta: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontFamily: systemFont, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caps: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0.26, textTransform: 'uppercase' },
  badge: { fontFamily: systemFont, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  pill: { fontFamily: systemFont, fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0.22 },
  heading: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  bodyMedium: { fontFamily: systemFont, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  caption: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const

export const loginTypeStyles = {
  display: { fontFamily: systemFont, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  title: typeStyles.title,
  heading: typeStyles.heading,
  body: typeStyles.body,
  bodyMedium: typeStyles.bodyMedium,
  label: typeStyles.label,
  meta: typeStyles.caption,
  caption: typeStyles.caption,
} as const

export const tabularNumbers = { fontVariant: ['tabular-nums'] as const }
