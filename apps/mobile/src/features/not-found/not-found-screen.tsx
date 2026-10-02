import { Image } from 'expo-image'
import { router, type Href } from 'expo-router'
import { ArrowLeft, House } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppText } from '@/components/primitives/app-text'
import { PrimaryCTA } from '@/components/primitives/primary-cta'
import { SecondaryCTA } from '@/components/primitives/secondary-cta'
import { useAppTheme } from '@/theme'

const marks = {
  light: require('../../../assets/images/brand/tavvi-brandmark-gold-on-light.png'),
  dark: require('../../../assets/images/brand/tavvi-brandmark-gold-on-dark.png'),
} as const

// Mesma cascata da 404 web (apps/web/src/features/not-found/styles/not-found.css):
// 460 ms, 70 ms entre elementos, subida de 10 px e a curva expo out. No
// Reanimated 4.5 o FadeInDown começa 25 px abaixo e sobe; o withInitialValues
// troca para 10. Com "reduzir movimento" no sistema, a tela aparece direto.
function entering(step: number) {
  return FadeInDown.duration(460)
    .delay(step * 70)
    .easing(Easing.bezier(0.16, 1, 0.3, 1))
    .withInitialValues({ translateY: 10 })
    .reduceMotion(ReduceMotion.System)
}

// A 404 do console, igual à do admin web: rota inexistente (+not-found) e
// convite ou restaurante que a API não encontra.
//
// `backHref` existe para as telas de detalhe que são abas escondidas: o
// voltar das abas vai para a primeira (Convites), e o detalhe do restaurante
// precisa voltar para Restaurantes, como o chevron e o voltar do Android dele.
export function NotFoundScreen({ backHref }: { backHref?: Href } = {}) {
  const insets = useSafeAreaInsets()
  const { colors, resolved } = useAppTheme()

  function goHome() {
    router.replace('/')
  }

  // Sem histórico (link externo abrindo o app direto aqui), a saída é a
  // mesma da ação principal.
  function goBack() {
    if (backHref) router.replace(backHref)
    else if (router.canGoBack()) router.back()
    else goHome()
  }

  return <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }]}>
    <View style={styles.column}>
      <Animated.View entering={entering(0)}>
        <Image source={marks[resolved]} contentFit="contain" style={styles.mark} />
      </Animated.View>
      <Animated.View entering={entering(1)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText variant="display" tone="primary" maxFontSizeMultiplier={1.2} style={styles.code}>404</AppText>
      </Animated.View>
      <Animated.View entering={entering(2)}>
        <AppText variant="titleLg" accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.title}>
          Página não encontrada<AppText variant="titleLg" tone="primary" style={styles.dot}>.</AppText>
        </AppText>
      </Animated.View>
      <Animated.View entering={entering(3)}>
        <AppText variant="body" tone="muted" maxFontSizeMultiplier={1.5} style={styles.message}>
          O endereço pode ter mudado ou não existe mais.
        </AppText>
      </Animated.View>
      <Animated.View entering={entering(4)} style={styles.actions}>
        <PrimaryCTA label="Ir para Convites" icon={House} onPress={goHome} />
        <SecondaryCTA label="Voltar" icon={ArrowLeft} onPress={goBack} />
      </Animated.View>
    </View>
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  column: { width: '100%', maxWidth: 400, alignItems: 'center' },
  mark: { width: 48, height: 48 },
  code: { marginTop: 22, fontSize: 84, lineHeight: 84, fontWeight: '800', letterSpacing: -4, fontVariant: ['tabular-nums'], textAlign: 'center' },
  title: { marginTop: 18, fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.9, textAlign: 'center' },
  dot: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
  message: { marginTop: 10, maxWidth: 300, textAlign: 'center' },
  actions: { width: '100%', marginTop: 28, gap: 10 },
})
