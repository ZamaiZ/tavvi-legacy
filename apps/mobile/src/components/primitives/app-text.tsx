import { Text, type TextProps, type TextStyle } from 'react-native'
import { useAppTheme, typeStyles, loginTypeStyles } from '@/theme'

type TextVariant = keyof typeof typeStyles
type Props = TextProps & { variant?: TextVariant; tone?: 'default' | 'muted' | 'primary' | 'danger'; family?: 'app' | 'login' }

export function AppText({ variant = 'body', tone = 'default', family = 'app', style, ...props }: Props) {
  const { colors } = useAppTheme()
  const color = tone === 'muted' ? colors.muted : tone === 'primary' ? colors.accentText : tone === 'danger' ? colors.dangerText : colors.foreground
  const styles = family === 'login' ? loginTypeStyles : typeStyles
  const selected = styles[variant as keyof typeof styles] ?? typeStyles[variant]
  return <Text {...props} style={[selected as TextStyle, { color }, style]} />
}
