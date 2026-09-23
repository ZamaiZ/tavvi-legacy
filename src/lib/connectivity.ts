import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

export function connectQueryLifecycle() {
  const unsubscribeNetInfo = NetInfo.addEventListener((state) => onlineManager.setOnline(Boolean(state.isConnected)))
  const subscription = AppState.addEventListener('change', (state) => { if (Platform.OS !== 'web') focusManager.setFocused(state === 'active') })
  return () => { unsubscribeNetInfo(); subscription.remove() }
}
