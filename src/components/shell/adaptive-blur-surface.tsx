import type { PropsWithChildren } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useAppTheme } from '@/theme'

export function AdaptiveBlurSurface({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) {
  const { colors } = useAppTheme()
  return <View style={[styles.surface, { backgroundColor: colors.surface }, style]}>{children}</View>
}
const styles = StyleSheet.create({ surface: { overflow: 'hidden', borderRadius: 16, borderCurve: 'continuous' } })
