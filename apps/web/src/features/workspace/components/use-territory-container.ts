'use client'

import { useSyncExternalStore } from 'react'

// O Base UI monta diálogos no <body>, fora de `.workspace-territory`, e ali
// eles perdem os tokens Tavvi (herdam o `--primary` do :root). Montar o
// portal dentro do território mantém cores, raios e tema claro/escuro do
// painel sem mexer nos tokens globais.
//
// O elemento não muda depois de montado, então não há o que assinar. No
// servidor não existe `document`: o portal só abre depois de um clique.
function subscribe() {
  return () => {}
}

// No console (`admin.`) não há `.workspace-territory`: o alerta vai para
// `.admin-territory`, que tem os mesmos tokens e a fonte do console. Sem
// território nenhum o Base UI esperaria para sempre por um container `null`
// e o alerta nunca abriria.
export function useTerritoryContainer() {
  return useSyncExternalStore(
    subscribe,
    () => document.querySelector<HTMLElement>('.workspace-territory') ?? document.querySelector<HTMLElement>('.admin-territory'),
    () => null,
  )
}
