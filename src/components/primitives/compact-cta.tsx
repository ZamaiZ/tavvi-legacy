import { Pressable, StyleSheet } from 'react-native'
import { Plus } from 'lucide-react-native'
import { AppText } from './app-text'
import { brand, radii } from '@/theme'

export function CompactCTA({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: pressed ? brand.limePressed : brand.lime, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
    <Plus size={18} color={brand.ink} strokeWidth={2.2} /><AppText variant="label" numberOfLines={1} style={styles.label}>{label}</AppText>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 44, borderRadius: radii.button, borderCurve: 'continuous', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0, boxShadow: '0 10px 24px -10px rgba(178,245,47,0.6)' }, label: { color: brand.ink, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 18, fontWeight: '700', flexShrink: 1 } })
