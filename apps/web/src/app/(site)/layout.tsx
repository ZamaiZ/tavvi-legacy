import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { SITE_FONT_VARIABLES } from '@/lib/site-fonts'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`site-public min-h-full font-sans ${SITE_FONT_VARIABLES} ${ALL_THEME_FONT_VARIABLES}`}>{children}</div>
}
