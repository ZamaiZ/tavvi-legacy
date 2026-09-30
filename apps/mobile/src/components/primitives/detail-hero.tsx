import type { LucideIcon } from 'lucide-react-native'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Svg, { LinearGradient, Rect, Stop } from 'react-native-svg'
import { AppText } from './app-text'
import type { StatusTone } from './status-badge'
import { brand, layout, radii, useAppTheme } from '@/theme'

type Props = { icon?: LucideIcon; initials?: string; status: string; tone: StatusTone; title: string; meta: string; variant?: 'invitation' | 'restaurant' }

export function DetailHero({ icon: Icon, initials, status, tone, title, meta, variant = 'invitation' }: Props) {
  const width = useWindowDimensions().width - layout.screenHorizontal * 2
  const { colors, resolved } = useAppTheme()
  const isRestaurant = variant === 'restaurant'
  const heroInk = resolved === 'dark' ? '#17120A' : brand.heroInk
  const gradient = resolved === 'dark' ? brand.heroGradientDark : brand.heroGradient
  const statusTone = tone === 'accent' ? [colors.goldText, colors.goldSoft] : tone === 'success' ? [colors.successText, colors.successSurface] : tone === 'warning' ? [colors.warningText, colors.warningSurface] : tone === 'danger' ? [colors.dangerText, colors.dangerSurface] : [colors.muted, colors.neutralSurface]
  const statusText = isRestaurant ? heroInk : statusTone[0]
  const statusFill = isRestaurant ? 'rgba(255,255,255,0.32)' : statusTone[1]

  return (
    <View style={[styles.root, isRestaurant ? styles.restaurant : styles.invitation, { width, backgroundColor: isRestaurant ? gradient[1] : colors.surface }]}>
      {isRestaurant ? (
        <Svg pointerEvents="none" width={width} height={130} viewBox={`0 0 ${width} 130`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <LinearGradient id="restaurantDetailGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="0.52" stopColor={gradient[1]} />
            <Stop offset="1" stopColor={gradient[2]} />
          </LinearGradient>
          <Rect width={width} height={130} fill="url(#restaurantDetailGold)" />
        </Svg>
      ) : null}
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: isRestaurant ? brand.ink : colors.goldSoft }]}>
          {Icon ? <Icon size={20} color={colors.goldText} strokeWidth={1.8} /> : <AppText variant="label" style={{ color: colors.gold, fontSize: 15 }}>{initials}</AppText>}
        </View>
        <View style={[styles.badge, { backgroundColor: statusFill }]}>
          <AppText variant="badge" numberOfLines={1} style={{ color: statusText }}>{status}</AppText>
        </View>
      </View>
      <View style={styles.copy}>
        <AppText variant={isRestaurant ? 'titleLg' : 'title'} maxFontSizeMultiplier={1.5} textBreakStrategy="simple" style={{ color: isRestaurant ? heroInk : colors.foreground }}>
          {title}
        </AppText>
        <AppText variant="meta" numberOfLines={2} style={{ color: isRestaurant ? 'rgba(29,23,14,0.72)' : colors.muted }}>{meta}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative', overflow: 'hidden', borderCurve: 'continuous' },
  invitation: { borderRadius: radii.hero, padding: 14, gap: 10 },
  restaurant: { borderRadius: radii.hero, padding: 16, gap: 12, minHeight: 118 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tile: { width: 44, height: 44, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  badge: { minHeight: 24, borderRadius: radii.full, borderCurve: 'continuous', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 3 },
})
