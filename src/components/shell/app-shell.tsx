import { useEffect, useState, type PropsWithChildren } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'
import { usePathname } from 'expo-router'
import { MobileDock, type MobilePanel } from './mobile-dock'
import { useAppTheme } from '@/theme'

export function AppShell({ children }: PropsWithChildren) { const { colors } = useAppTheme(); const [panel, setPanel] = useState<MobilePanel>('none'); const pathname = usePathname(); useEffect(() => setPanel('none'), [pathname]); useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (panel !== 'none') { setPanel('none'); return true } return false }); return () => sub.remove() }, [panel]); return <View style={[styles.root, { backgroundColor: colors.background }]}><View style={styles.content}>{children}</View><MobileDock panel={panel} setPanel={setPanel} /></View> }
const styles = StyleSheet.create({ root: { flex: 1 }, content: { flex: 1 } })
