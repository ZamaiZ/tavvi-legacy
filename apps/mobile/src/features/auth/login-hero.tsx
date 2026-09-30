import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import Svg, { Image as SvgImage } from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import type { LoginPalette } from './login-theme'

type LoginHeroProps = {
  width: number
  palette: LoginPalette
}

const HERO_HEIGHT = 230

const brandmark = require('../../../assets/images/brand/tavvi-brandmark-gold-on-dark.png')
const lockup = require('../../../assets/images/brand/tavvi-lockup-horizontal-gold-on-dark.png')

export function LoginHero({ width, palette }: LoginHeroProps) {
  return (
    <View style={[styles.root, { width }]}>
      <Svg width={width} height={HERO_HEIGHT} viewBox={`0 0 ${width} ${HERO_HEIGHT}`} style={StyleSheet.absoluteFill} accessible={false}>
        <SvgImage href={brandmark} x={width - 196} y={-60} width={340} height={340} opacity={0.07} preserveAspectRatio="xMidYMid meet" />
      </Svg>
      <View style={styles.content}>
        <View style={styles.topContent}>
          <Image source={lockup} contentFit="contain" accessibilityLabel="Tavvi" style={styles.lockup} />
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <AppText family="login" variant="caption" style={styles.badgeText}>Console</AppText>
          </View>
        </View>

        <View style={styles.copy}>
          <AppText
            family="login"
            variant="display"
            maxFontSizeMultiplier={1.35}
            style={[styles.title, { color: palette.heroText }]}
          >
            Administre a plataforma.
          </AppText>
          <AppText family="login" variant="meta" maxFontSizeMultiplier={1.5} style={{ color: palette.heroMuted }}>
            Convites e restaurantes, de onde você estiver.
          </AppText>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative', height: HERO_HEIGHT, overflow: 'hidden' },
  content: { height: HERO_HEIGHT, paddingTop: 4, paddingBottom: 18, justifyContent: 'flex-start' },
  topContent: { alignItems: 'flex-start', gap: 32 },
  lockup: { width: 80, height: 30 },
  badge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(208,172,110,0.12)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D6B67C' },
  badgeText: { color: '#D6B67C', fontSize: 11 },
  copy: { gap: 8, maxWidth: 330, marginTop: 12 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.75 },
})
