import { useWindowDimensions, StyleSheet, View } from 'react-native'
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import { CompactCTA } from '@/components/primitives/compact-cta'
import { brand, radii } from '@/theme'
import { createNotchedPath } from './notched-path'

const HEIGHT = 226
const mark = require('../../../assets/images/brand/tavvi-brandmark.png')
type Props = { title: string; description: string; summary: string; action?: { label: string; onPress(): void } }

export function ListHero({ title, description, summary, action }: Props) {
  const width = useWindowDimensions().width - 36
  const path = createNotchedPath({ width, height: HEIGHT, radius: 30, notchW: 68, notchH: 68, curve: 26 })
  return <View style={[styles.root, { width, height: HEIGHT }]}>
    <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} style={StyleSheet.absoluteFill} accessible={false}>
      <Defs>
        <LinearGradient id="listHeroFill" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#121510" /><Stop offset="1" stopColor="#0E120C" /></LinearGradient>
        <RadialGradient id="listHeroGlow" cx="108%" cy="122%" rx="80%" ry="80%"><Stop offset="0" stopColor={brand.lime} stopOpacity={0.2} /><Stop offset="1" stopColor={brand.lime} stopOpacity={0} /></RadialGradient>
        <ClipPath id="listHeroClip"><Path d={path} /></ClipPath>
      </Defs>
      <G clipPath="url(#listHeroClip)"><Path d={path} fill="url(#listHeroFill)" /><Rect width={width} height={HEIGHT} fill="url(#listHeroGlow)" /><G rotation={-8} originX={width - 70} originY={HEIGHT - 70}><SvgImage href={mark} x={width - 300} y={HEIGHT - 300} width={230} height={230} opacity={0.2} preserveAspectRatio="xMidYMid meet" /></G></G>
      <Path d={path} fill="none" stroke="rgba(244,246,240,0.08)" strokeWidth={1} />
    </Svg>
    <View style={styles.content}>
      <View style={styles.pill}><View style={styles.dot} /><AppText variant="pill" style={{ color: '#C9F870' }}>Plataforma</AppText></View>
      <View style={styles.copy}><AppText variant="display" maxFontSizeMultiplier={1.35} numberOfLines={1} style={styles.title}>{title}<AppText variant="display" style={{ color: brand.lime }}>.</AppText></AppText><AppText variant="meta" numberOfLines={2} style={styles.description}>{description}</AppText></View>
      <View style={styles.base}><AppText variant="label" numberOfLines={1} ellipsizeMode="tail" style={styles.summary}>{summary}</AppText>{action ? <CompactCTA label={action.label} onPress={action.onPress} /> : <View style={styles.actionPlaceholder} />}</View>
    </View>
  </View>
}

const styles = StyleSheet.create({ root: { position: 'relative', borderRadius: radii.hero, overflow: 'hidden', borderCurve: 'continuous' }, content: { height: HEIGHT, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, justifyContent: 'space-between' }, pill: { height: 26, borderRadius: 13, borderCurve: 'continuous', paddingLeft: 10, paddingRight: 11, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(178,245,47,0.10)' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: brand.lime, boxShadow: '0 0 0 3px rgba(178,245,47,0.2)' }, copy: { gap: 8, maxWidth: 280 }, title: { color: '#F4F6F0' }, description: { color: '#A9AEA3', lineHeight: 19, maxWidth: 270 }, base: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, summary: { color: '#A9AEA3', flex: 1, minWidth: 0 }, actionPlaceholder: { width: 1, height: 1 } })
