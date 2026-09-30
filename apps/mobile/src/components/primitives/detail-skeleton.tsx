import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radii, useAppTheme } from '@/theme'

export function DetailSkeleton({ kind }: { kind: 'invitation' | 'restaurant' }) {
  const { colors } = useAppTheme()
  const reduceMotion = useReducedMotion()
  const pulse = useSharedValue(1)
  useEffect(() => { pulse.value = reduceMotion ? 1 : withRepeat(withTiming(0.55, { duration: 850 }), -1, true) }, [pulse, reduceMotion])
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <Animated.View accessibilityLabel="Carregando detalhes" style={[styles.root, animated]}>
      <View style={[styles.hero, { backgroundColor: colors.surface }]}>
        <View style={styles.heroTop}><View style={[styles.icon, { backgroundColor: colors.field }]} /><View style={[styles.status, { backgroundColor: colors.field }]} /></View>
        <View style={styles.titleBlock}><View style={[styles.title, { backgroundColor: colors.field }]} /><View style={[styles.subtitle, { backgroundColor: colors.field }]} /></View>
      </View>
      <View style={styles.section}>
        <View style={[styles.label, { backgroundColor: colors.field }]} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}><View style={[styles.line, { backgroundColor: colors.field }]} /></View>
      </View>
      <View style={styles.section}>
        <View style={[styles.label, { backgroundColor: colors.field }]} />
        <View style={[styles.card, kind === 'restaurant' ? styles.tallCard : styles.timelineCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.line, { backgroundColor: colors.field }]} />
          <View style={[styles.line, styles.shortLine, { backgroundColor: colors.field }]} />
          {kind === 'restaurant' ? <View style={[styles.line, styles.shortLine, { backgroundColor: colors.field }]} /> : null}
        </View>
      </View>
      {kind === 'restaurant' ? <View style={styles.footer}><View style={[styles.label, { backgroundColor: colors.field }]} /><View style={[styles.line, styles.shortLine, { backgroundColor: colors.field }]} /></View> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  hero: { minHeight: 118, borderRadius: radii.hero, borderCurve: 'continuous', padding: 16, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 44, height: 44, borderRadius: radii.tile, borderCurve: 'continuous' },
  status: { width: 76, height: 24, borderRadius: radii.full },
  titleBlock: { gap: 7 },
  title: { width: '68%', height: 18, borderRadius: 7 },
  subtitle: { width: '42%', height: 12, borderRadius: 6 },
  section: { gap: 7 },
  label: { width: 106, height: 10, borderRadius: 5, marginLeft: 14 },
  card: { minHeight: 52, borderRadius: radii.card, borderCurve: 'continuous', padding: 14, justifyContent: 'center', gap: 10 },
  tallCard: { minHeight: 116, justifyContent: 'flex-start' },
  timelineCard: { minHeight: 98, justifyContent: 'flex-start' },
  line: { width: '72%', height: 11, borderRadius: 6 },
  shortLine: { width: '48%' },
  footer: { gap: 12, paddingTop: 2 },
})
