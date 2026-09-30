import { Pressable, StyleSheet } from 'react-native'
import { Plus } from 'lucide-react-native'
import { AppText } from './app-text'
import { brand, radii } from '@/theme'

export function CompactCTA({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: brand.heroInk, opacity: pressed ? 0.82 : 1 }]}>
    <Plus size={16} color="#FFFFFF" strokeWidth={2} /><AppText variant="label" numberOfLines={1} style={[styles.label, { color: '#FFFFFF' }]}>{label}</AppText>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 44, borderRadius: radii.button, borderCurve: 'continuous', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }, label: { fontSize: 14, lineHeight: 18, fontWeight: '700', flexShrink: 1 } })
