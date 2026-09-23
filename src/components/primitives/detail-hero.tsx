import type { LucideIcon } from 'lucide-react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { AppText } from './app-text'
import type { StatusTone } from './status-badge'
import { brand, radii } from '@/theme'

export function DetailHero({ icon: Icon, initials, status, tone, title, meta, largeTitle = false }: { icon?: LucideIcon; initials?: string; status: string; tone: StatusTone; title: string; meta: string; largeTitle?: boolean }) {
  const width = useWindowDimensions().width - 36
  const heroTone = tone === 'accent' ? brand.lime : tone === 'success' ? '#79C77C' : tone === 'warning' ? '#E7AF5C' : tone === 'danger' ? '#FF8A84' : '#A9AEA3'
  return <View style={[styles.root, { width }]}>
    <Svg pointerEvents="none" viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" style={styles.background}>
      <Defs><LinearGradient id="detailHeroFill" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#121510" /><Stop offset="1" stopColor="#0E120C" /></LinearGradient><RadialGradient id="detailHeroGlow" cx="100%" cy="100%" rx="85%" ry="85%"><Stop offset="0" stopColor={brand.lime} stopOpacity={0.16} /><Stop offset="1" stopColor={brand.lime} stopOpacity={0} /></RadialGradient></Defs>
      <Rect width={width} height={100} fill="url(#detailHeroFill)" /><Rect width={width} height={100} fill="url(#detailHeroGlow)" />
    </Svg>
    <View style={styles.top}><View style={styles.tile}>{Icon ? <Icon size={20} color={brand.lime} strokeWidth={1.8} /> : <AppText variant="label" style={{ color: brand.lime, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15 }}>{initials}</AppText>}</View><View style={[styles.heroBadge, { backgroundColor: 'rgba(244,246,240,0.08)' }]}><AppText variant="badge" numberOfLines={1} style={{ color: heroTone }}>{status}</AppText></View></View>
    <View style={styles.copy}><AppText variant={largeTitle ? 'titleLg' : 'title'} maxFontSizeMultiplier={1.5} textBreakStrategy="simple" style={styles.title}>{title}<AppText variant={largeTitle ? 'titleLg' : 'title'} style={{ color: brand.lime }}>.</AppText></AppText><AppText variant="meta" numberOfLines={2} style={styles.meta}>{meta}</AppText></View>
  </View>
}

const styles = StyleSheet.create({ root: { backgroundColor: '#121510', borderRadius: radii.hero, borderBottomLeftRadius: radii.hero, borderBottomRightRadius: radii.hero, padding: 20, gap: 18, overflow: 'hidden', borderCurve: 'continuous' }, background: StyleSheet.absoluteFill, top: { flexDirection: 'row', alignItems: 'center', gap: 10 }, tile: { width: 46, height: 46, borderRadius: radii.tile, borderCurve: 'continuous', backgroundColor: '#181B15', alignItems: 'center', justifyContent: 'center' }, heroBadge: { height: 26, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, copy: { gap: 5 }, title: { color: '#F4F6F0', flexShrink: 1 }, meta: { color: '#A9AEA3' } })
