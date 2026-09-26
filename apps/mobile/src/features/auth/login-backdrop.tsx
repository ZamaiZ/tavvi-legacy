import { StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { LoginPalette } from './login-theme'

export function LoginBackdrop({ palette }: { palette: LoginPalette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" accessible={false}>
        <Defs>
          <RadialGradient id="loginGlow" cx="25%" cy="4%" rx="70%" ry="45%">
            <Stop offset="0" stopColor={palette.glow} />
            <Stop offset="1" stopColor={palette.screen} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="390" height="844" fill={palette.screen} />
        <Rect width="390" height="844" fill="url(#loginGlow)" />
      </Svg>
    </View>
  )
}
