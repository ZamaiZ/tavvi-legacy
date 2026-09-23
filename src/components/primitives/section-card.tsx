import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function SectionCard({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useAppTheme()
  return <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.line }]}><AppText variant="caps" style={{ color: colors.subtle, marginBottom: 12 }}>{title}</AppText>{children}</View>
}

const styles = StyleSheet.create({ root: { borderWidth: 1, borderRadius: radii.panel, borderCurve: 'continuous', padding: 16 } })
