export function script(mode: string) {
  const documentElement = document.documentElement
  if (!documentElement) return
  documentElement.classList.add(mode)
  documentElement.classList.remove(mode === 'light' ? 'dark' : 'light')
  documentElement.style.colorScheme = mode
}
