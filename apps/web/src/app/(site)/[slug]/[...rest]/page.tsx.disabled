import { notFound } from 'next/navigation'

// O cardápio não tem subpáginas. Qualquer `/<slug>/...` chega aqui só com o
// restaurante publicado (senão o layout de `[slug]` responde antes) e cai na
// 404 "página" deste restaurante, em `[slug]/not-found.tsx`.
export default function Page() {
  notFound()
}
