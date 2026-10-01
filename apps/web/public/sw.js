// Service worker do Tavvi Painel (painel.) e do Tavvi Console (admin.).
//
// Três trabalhos:
// 1. Convite de instalação. O Chrome só entrega o beforeinstallprompt a
//    quem tem um fetch handler que faz algo de verdade; handler vazio é
//    ignorado.
// 2. Tela própria quando a rede cai (public/offline.html).
// 3. Notificações push: push, notificationclick e pushsubscriptionchange.
//
// NÃO guarda o app em cache. Só navegações GET passam pelo fetch handler;
// uploads, server actions, RSC, Supabase e imagens seguem direto para a
// rede, como se não houvesse service worker. Por isso cada deploy chega novo
// e ativar a versão nova na hora (skipWaiting) é seguro.
//
// Mudou o public/offline.html? Suba a versão de OFFLINE_CACHE.
const OFFLINE_CACHE = 'tavvi-offline-v1'
const OFFLINE_URL = '/offline.html'
// src/app/pwa/push-subscription/route.ts
const PUSH_SUBSCRIPTION_URL = '/pwa/push-subscription'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      // 'reload' ignora o cache HTTP: a cópia guardada é sempre a do deploy.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('tavvi-offline-') && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key)),
      )
      // Com navigation preload, a navegação sai para a rede enquanto o
      // service worker acorda, e o app não fica mais lento por tê-lo.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Tudo que não é navegação GET segue sem passar por aqui.
  if (request.mode !== 'navigate' || request.method !== 'GET') return

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse
        if (preloaded) return preloaded
        return await fetch(request)
      } catch {
        // Só chega aqui se a rede lançar (sem conexão). Respostas HTTP de
        // erro, como 404 e 500, passam como vieram.
        const cache = await caches.open(OFFLINE_CACHE)
        const offline = await cache.match(OFFLINE_URL)
        return offline ?? Response.error()
      }
    })(),
  )
})

// Payload { title, body, url, tag } (src/domain/push.ts). Mostra o aviso
// SEMPRE, mesmo com o app aberto: o Safari cancela a inscrição de quem
// recebe push sem mostrar nada, e o Chrome mostraria um aviso genérico.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  if (!data || typeof data !== 'object') data = {}
  const text = (value) => (typeof value === 'string' ? value : '')
  const tag = text(data.tag) || undefined

  event.waitUntil(
    self.registration.showNotification(text(data.title) || 'Tavvi', {
      body: text(data.body),
      icon: '/pwa/icon-192.png',
      // Silhueta branca: o Android desenha a barra de status com ela.
      badge: '/pwa/badge-96.png',
      lang: 'pt-BR',
      tag,
      // Mesma tag substitui o aviso anterior; renotify faz soar de novo.
      renotify: Boolean(tag),
      data: { url: text(data.url) || '/' },
    }),
  )
})

// Abre a tela do aviso. Só aceita URL desta origem; o resto vira a tela
// inicial. Uma janela do app já aberta é reaproveitada.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const requested = new URL(event.notification.data?.url || '/', self.location.origin)
      const target =
        requested.origin === self.location.origin
          ? requested.href
          : new URL('/', self.location.origin).href
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const exact = windows.find((client) => client.url === target)
      if (exact) return exact.focus()

      const open = windows[0]
      if (open) {
        await open.focus().catch(() => undefined)
        // navigate() só funciona em janela controlada por este service worker.
        const navigated = await open.navigate(target).catch(() => null)
        if (navigated) return navigated
      }
      return self.clients.openWindow(target)
    })(),
  )
})

// O navegador trocou a inscrição sozinho (expirou ou foi renovada). Refaz
// com a mesma chave VAPID e avisa o servidor; a sessão vai no cookie. Sem a
// inscrição antiga não há chave para refazer: o app reinscreve ao abrir.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const previous = event.oldSubscription
      const key = previous?.options?.applicationServerKey
      const fresh =
        event.newSubscription ??
        (key
          ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
          : null)
      if (!fresh) return
      await fetch(PUSH_SUBSCRIPTION_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldEndpoint: previous?.endpoint ?? null, subscription: fresh.toJSON() }),
      })
    })().catch(() => undefined),
  )
})
