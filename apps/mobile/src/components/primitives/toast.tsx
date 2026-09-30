import { CircleAlert, CircleCheck } from 'lucide-react-native'
import { useSyncExternalStore } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { motion } from '@/theme'

type ToastType = 'success' | 'error'
type ToastState = { id: number; message: string; type: ToastType } | null

const DURATION = 2000
let current: ToastState = null
let nextId = 0
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit(next: ToastState) {
  current = next
  listeners.forEach((listener) => listener())
}

// Um aviso por vez, no topo, abaixo da Dynamic Island (README §9.8): um novo
// substitui o anterior e reinicia o tempo.
export const toast = {
  show(message: string, options: { type?: ToastType } = {}) {
    if (timer) clearTimeout(timer)
    nextId += 1
    emit({ id: nextId, message, type: options.type ?? 'success' })
    AccessibilityInfo.announceForAccessibility(message)
    timer = setTimeout(() => {
      timer = null
      emit(null)
    }, DURATION)
  },
  hide() {
    if (timer) clearTimeout(timer)
    timer = null
    emit(null)
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => current
const entering = FadeInUp.duration(motion.panelIn).reduceMotion(ReduceMotion.System)
const exiting = FadeOutUp.duration(motion.panelOut).reduceMotion(ReduceMotion.System)

export function ToastHost() {
  const insets = useSafeAreaInsets()
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {state ? (
        <Animated.View key={state.id} entering={entering} exiting={exiting} pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={state.message} accessibilityHint="Toque para dispensar" onPress={toast.hide} style={styles.pill}>
            {state.type === 'error'
              ? <CircleAlert size={17} color="#EE8C80" strokeWidth={2} />
              : <CircleCheck size={17} color="#D0AC6E" strokeWidth={2} />}
            <Text numberOfLines={1} style={styles.text}>{state.message}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  pill: { height: 40, maxWidth: '100%', paddingLeft: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderCurve: 'continuous', backgroundColor: '#17150F', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  text: { flexShrink: 1, color: '#F2EEE6', fontSize: 14, lineHeight: 18, fontWeight: '500' },
})
