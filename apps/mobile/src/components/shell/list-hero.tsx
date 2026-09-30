import { useWindowDimensions, StyleSheet, View } from 'react-native'
import Svg, { Image as SvgImage, LinearGradient, Rect, Stop } from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import { CompactCTA } from '@/components/primitives/compact-cta'
import { brand, useAppTheme } from '@/theme'

const HEIGHT = 196
const marks = {
  light: require('../../../assets/images/brand/tavvi-brandmark-gold-on-light.png'),
  dark: require('../../../assets/images/brand/tavvi-brandmark-gold-on-dark.png'),
} as const
type Props = { title: string; description: string; summary: string; action?: { label: string; onPress(): void } }

export function ListHero({ title, description, summary, action }: Props) {
  const { width: viewportWidth } = useWindowDimensions()
  const { resolved } = useAppTheme()
  const width = viewportWidth - 32
  const gradient = resolved === 'dark' ? brand.heroGradientDark : brand.heroGradient
  const ink = resolved === 'dark' ? '#17120A' : '#1D170E'

  return (
    <View style={[styles.root, { width, height: HEIGHT }]}>
      <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} style={StyleSheet.absoluteFill} accessible={false}>
        <LinearGradient id="listHeroGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradient[0]} />
          <Stop offset="0.52" stopColor={gradient[1]} />
          <Stop offset="1" stopColor={gradient[2]} />
        </LinearGradient>
        <Rect width={width} height={HEIGHT} rx={20} fill="url(#listHeroGold)" />
        <SvgImage href={marks[resolved]} x={width - 52} y={12} width={40} height={40} opacity={0.11} preserveAspectRatio="xMidYMid meet" />
      </Svg>
      <View style={styles.content}>
        <AppText variant="pill" style={[styles.eyebrow, { color: ink }]}>TAVVI · CONSOLE</AppText>
        <View style={styles.copy}>
          <AppText variant="display" maxFontSizeMultiplier={1.35} numberOfLines={1} style={[styles.title, { color: ink }]}>{title}</AppText>
          <AppText variant="meta" numberOfLines={2} style={[styles.description, { color: 'rgba(29,23,14,0.72)' }]}>{description}</AppText>
        </View>
        <View style={styles.base}>
          <AppText variant="label" numberOfLines={1} ellipsizeMode="tail" style={[styles.summary, { color: 'rgba(29,23,14,0.72)' }]}>{summary}</AppText>
          {action ? <CompactCTA label={action.label} onPress={action.onPress} /> : <View style={styles.actionPlaceholder} />}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative', borderRadius: 20, overflow: 'hidden', borderCurve: 'continuous' },
  content: { height: HEIGHT, padding: 16, justifyContent: 'space-between' },
  eyebrow: { opacity: 0.76 },
  copy: { gap: 6, maxWidth: 280 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.7 },
  description: { lineHeight: 19, maxWidth: 270 },
  base: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summary: { flex: 1, minWidth: 0 },
  actionPlaceholder: { width: 1, height: 1 },
})
