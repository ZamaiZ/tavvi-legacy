import { Search, X } from 'lucide-react-native'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText(value: string): void; placeholder: string }) {
  const { colors } = useAppTheme()
  return <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <Search size={18} color={colors.subtle} strokeWidth={1.8} />
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtle} autoCorrect={false} returnKeyType="search" accessibilityLabel={placeholder} style={[styles.input, { color: colors.foreground }]} />
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={8} onPress={() => onChangeText('')} style={[styles.clear, { backgroundColor: colors.field }]}><X size={14} color={colors.muted} /></Pressable> : null}
  </View>
}

const styles = StyleSheet.create({ root: { height: 50, borderRadius: radii.search, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, input: { flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 20, paddingVertical: 0 }, clear: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' } })
