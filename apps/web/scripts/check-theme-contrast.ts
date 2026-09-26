import { contrastRatio } from '../src/lib/color'
import { THEME_PRESET_IDS } from '../src/domain/theme'
import { PRESETS } from '../src/lib/theme/presets'
import { LINE_CONTRAST_RANGE, CONTRAST_MINIMUMS, resolveTheme } from '../src/lib/theme/resolve'

const sampleAccents = ['#241e0a', '#8a2d1a', '#1a4d8a', '#0f5132', '#e0603f']
let failureCount = 0

function checkMinimum(label: string, ratio: number, minimum: number) {
  const valid = ratio >= minimum
  if (!valid) failureCount += 1
  console.log(
    `    ${valid ? 'ok   ' : 'FAIL'} ${label.padEnd(11)} ${ratio.toFixed(2).padStart(5)}:1  (minimum ${minimum})`,
  )
}

function checkRange(label: string, ratio: number) {
  const valid = ratio >= LINE_CONTRAST_RANGE.min && ratio <= LINE_CONTRAST_RANGE.max
  if (!valid) failureCount += 1
  const reason = ratio < LINE_CONTRAST_RANGE.min ? 'lost on background' : 'competes with text'
  console.log(
    `    ${valid ? 'ok   ' : 'FAIL'} ${label.padEnd(11)} ${ratio.toFixed(2).padStart(5)}:1  ` +
      `(range ${LINE_CONTRAST_RANGE.min}-${LINE_CONTRAST_RANGE.max})${valid ? '' : ` -- ${reason}`}`,
  )
}

function checkFace(label: string, variables: Record<string, string>) {
  console.log(`  ${label}`)
  const base = variables['--m-base']
  checkMinimum('ink', contrastRatio(base, variables['--m-ink']), CONTRAST_MINIMUMS.ink)
  checkMinimum('muted', contrastRatio(base, variables['--m-muted']), CONTRAST_MINIMUMS.muted)
  checkMinimum('accent', contrastRatio(base, variables['--m-accent']), CONTRAST_MINIMUMS.accent)
  checkMinimum(
    'on-accent',
    contrastRatio(variables['--m-accent'], variables['--m-on-accent']),
    CONTRAST_MINIMUMS.onAccent,
  )
  checkRange('line', contrastRatio(base, variables['--m-line']))
}

for (const presetId of THEME_PRESET_IDS) {
  console.log(`\n${PRESETS[presetId].label} (${presetId}) -- preset colors`)
  const defaultTheme = resolveTheme({
    preset: presetId,
    base: null,
    accent: null,
    density: 'confortavel',
  })
  checkFace('light mode', defaultTheme.styleLight)
  checkFace('dark mode', defaultTheme.styleDark)

  for (const accent of sampleAccents) {
    console.log(`\n${PRESETS[presetId].label} (${presetId}) -- custom accent ${accent}`)
    const theme = resolveTheme({
      preset: presetId,
      base: null,
      accent,
      density: 'confortavel',
    })
    checkFace('light mode', theme.styleLight)
    checkFace('dark mode', theme.styleDark)
  }
}

console.log(
  failureCount === 0
    ? '\nALL TOKENS MEET THE RULE'
    : `\n${failureCount} TOKEN(S) OUT OF RANGE`,
)
process.exit(failureCount === 0 ? 0 : 1)
