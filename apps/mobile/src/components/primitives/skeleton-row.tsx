import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radii, useAppTheme } from '@/theme'

export function SkeletonRow() {
  const { colors } = useAppTheme(); const reduceMotion = useReducedMotion(); const pulse = useSharedValue(1)
  useEffect(() => { pulse.value = reduceMotion ? 1 : withRepeat(withTiming(0.55, { duration: 850 }), -1, true) }, [pulse, reduceMotion])
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }))
  return <Animated.View accessibilityLabel="Carregando" style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.line }, animated]}>
    <View style={[styles.tile, { backgroundColor: colors.field }]} /><View style={styles.copy}><View style={[styles.long, { backgroundColor: colors.field }]} /><View style={[styles.short, { backgroundColor: colors.field }]} /></View><View style={[styles.badge, { backgroundColor: colors.field }]} />
  </Animated.View>
}

const styles = StyleSheet.create({ root: { height: 72, borderWidth: 1, borderRadius: radii.card, borderCurve: 'continuous', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, tile: { width: 42, height: 42, borderRadius: radii.tile, borderCurve: 'continuous' }, copy: { flex: 1, gap: 8 }, long: { width: '62%', height: 11, borderRadius: 6, opacity: 1 }, short: { width: '40%', height: 9, borderRadius: 5, opacity: 0.7 }, badge: { width: 64, height: 24, borderRadius: radii.chip, borderCurve: 'continuous', opacity: 0.45 } })
