import { Pressable, StyleSheet } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { radii, useAppTheme } from '@/theme'

export function IconButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress(): void }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.72 }]}><Icon size={18} color={colors.foreground} strokeWidth={1.9} /></Pressable>
}

const styles = StyleSheet.create({ root: { width: 44, height: 44, borderRadius: radii.tile, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' } })
