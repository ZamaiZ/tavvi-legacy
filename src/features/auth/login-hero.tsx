import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import { ThemeToggle } from '@/components/primitives/theme-toggle'
import { createNotchedPath } from '@/components/shell/notched-path'
import { brand, type ThemePreference } from '@/theme'
import type { LoginPalette } from './login-theme'

type LoginHeroProps = {
  width: number
  palette: LoginPalette
  preference: ThemePreference
  onThemeChange(next: ThemePreference): void | Promise<void>
}

const HERO_HEIGHT = 264

const brandmark = require('../../../assets/images/brand/tavvi-brandmark.png')
const lockup = require('../../../assets/images/brand/tavvi-lockup-horizontal.png')

export function LoginHero({ width, palette, preference, onThemeChange }: LoginHeroProps) {
  const path = createNotchedPath({ width, height: HERO_HEIGHT, radius: 28, notchW: 76, notchH: 72, curve: 22 })

  return (
    <View style={[styles.root, { width }]}>
      <Svg
        width={width}
        height={HERO_HEIGHT}
        viewBox={`0 0 ${width} ${HERO_HEIGHT}`}
        style={StyleSheet.absoluteFill}
        accessible={false}
      >
        <Defs>
          <LinearGradient id="heroFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.heroStart} />
            <Stop offset="1" stopColor={palette.heroEnd} />
          </LinearGradient>
          <RadialGradient id="heroGlow" cx="84%" cy="82%" rx="48%" ry="64%">
            <Stop offset="0" stopColor={brand.lime} stopOpacity={0.22} />
            <Stop offset="1" stopColor={brand.lime} stopOpacity={0} />
          </RadialGradient>
          <ClipPath id="heroClip">
            <Path d={path} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#heroClip)">
          <Path d={path} fill="url(#heroFill)" />
          <Rect width={width} height={HERO_HEIGHT} fill="url(#heroGlow)" />
          <SvgImage
            href={brandmark}
            x={width - 172}
            y={66}
            width={252}
            height={252}
            opacity={0.2}
            preserveAspectRatio="xMidYMid meet"
          />
        </G>
        <Path d={path} fill="none" stroke={palette.border} strokeWidth={1} />
      </Svg>

      <View style={styles.content}>
        <View style={styles.topContent}>
          <Image source={lockup} contentFit="contain" accessibilityLabel="Tavvi" style={styles.lockup} />
          <View style={[styles.badge, { backgroundColor: brand.limeSoft }]}>
            <View style={[styles.badgeDot, { backgroundColor: brand.lime, boxShadow: `0 0 0 3px ${brand.limeSoft}` }]} />
            <AppText family="login" variant="caption" style={{ color: brand.lime, fontSize: 11 }}>
              Console · Acesso de administrador
            </AppText>
          </View>
        </View>

        <View style={[styles.copy, { maxWidth: width - 142 }]}>
          <AppText
            family="login"
            variant="display"
            maxFontSizeMultiplier={1.35}
            style={[styles.title, { color: palette.heroText }]}
          >
            Bem-vindo de volta<AppText family="login" variant="display" style={{ color: brand.lime }}>.</AppText>
          </AppText>
          <AppText family="login" variant="meta" maxFontSizeMultiplier={1.5} style={{ color: palette.heroMuted }}>
            Restaurantes, cardápios, mesas e pedidos em um só lugar.
          </AppText>
        </View>
      </View>

      <ThemeToggle
        value={preference}
        onChange={(next) => { void onThemeChange(next) }}
        size={54}
        style={styles.themeToggle}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative', height: HERO_HEIGHT },
  content: { height: HERO_HEIGHT, padding: 22, justifyContent: 'space-between' },
  topContent: { alignItems: 'flex-start', gap: 16 },
  lockup: { width: 78, height: 31 },
  badge: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 13 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  copy: { gap: 10 },
  title: { fontSize: 31, lineHeight: 32, fontWeight: '700', letterSpacing: -1.1 },
  themeToggle: { position: 'absolute', top: 0, right: 0, borderRadius: 19, borderCurve: 'continuous' },
})
