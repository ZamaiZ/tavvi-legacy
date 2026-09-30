import { Fraunces, Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'], display: 'swap' })
const tavvi = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-tavvi', display: 'swap' })

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`site-public min-h-full font-sans ${inter.variable} ${fraunces.variable} ${tavvi.variable} ${ALL_THEME_FONT_VARIABLES}`}>{children}</div>
}
