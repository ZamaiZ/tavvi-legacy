import { Plus } from 'lucide-react-native'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Image as SvgImage, LinearGradient, Rect, Stop } from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import { brand, layout, useAppTheme } from '@/theme'

const HEIGHT = 82
const marks = {
  light: require('../../../assets/images/brand/tavvi-brandmark-gold-on-light.png'),
  dark: require('../../../assets/images/brand/tavvi-brandmark-gold-on-dark.png'),
} as const

export function InvitationSummaryHero({ pending, total, onCreate }: { pending: number; total: number; onCreate(): void }) {
  const width = useWindowDimensions().width - layout.screenHorizontal * 2
  const { resolved } = useAppTheme()
  const gradient = resolved === 'dark' ? brand.heroGradientDark : brand.heroGradient
  const ink = resolved === 'dark' ? '#17120A' : brand.heroInk
  const muted = resolved === 'dark' ? 'rgba(23,18,10,0.72)' : 'rgba(29,23,14,0.72)'

  return (
    <View style={[styles.root, { width, height: HEIGHT }]}>
      <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} style={StyleSheet.absoluteFill} accessible={false}>
        <LinearGradient id="invitationSummaryGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradient[0]} />
          <Stop offset="0.52" stopColor={gradient[1]} />
          <Stop offset="1" stopColor={gradient[2]} />
        </LinearGradient>
        <Rect width={width} height={HEIGHT} rx={20} fill="url(#invitationSummaryGold)" />
        <SvgImage href={marks[resolved]} x={width - 108} y={-22} width={132} height={132} opacity={0.12} preserveAspectRatio="xMidYMid meet" />
      </Svg>
      <View style={styles.content}>
        <View style={styles.summary}>
          <AppText variant="rowMeta" style={{ color: ink }}>Aguardando resgate</AppText>
          <View style={styles.countLine}>
            <AppText variant="titleLg" style={[styles.count, { color: ink }]}>{pending}</AppText>
            <AppText variant="rowMeta" style={{ color: muted }}>de {total} convites</AppText>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Novo convite" onPress={onCreate} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.82 : 1 }]}>
          <Plus size={16} color="#F2EEE6" strokeWidth={2.1} />
          <AppText variant="label" style={styles.actionText}>Novo</AppText>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative', borderRadius: 20, overflow: 'hidden', borderCurve: 'continuous' },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  summary: { gap: 1, minWidth: 0 },
  countLine: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  count: { fontSize: 30, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  action: { minHeight: 44, borderRadius: 999, borderCurve: 'continuous', backgroundColor: brand.ink, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: '#F2EEE6', fontWeight: '600' },
})
