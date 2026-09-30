import { StyleSheet, View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import type { LoginPalette } from './login-theme'

export function LoginBackdrop({ palette }: { palette: LoginPalette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" accessible={false}>
        <Rect width="390" height="844" fill={palette.screen} />
      </Svg>
    </View>
  )
}
