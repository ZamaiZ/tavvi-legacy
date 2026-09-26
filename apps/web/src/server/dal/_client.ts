import 'server-only'
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/domain/database.types'
import { env } from '@/server/env'
import { cookieNameFor, type Territory } from '@/server/territory'

function cookieOptionsFor(territory: Territory): CookieOptionsWithName {
  return {
    name: cookieNameFor[territory],
    // `domain` NÃO é definido, de propósito. Sem o atributo Domain o cookie
    // nasce host-only, e host-only é exatamente o isolamento entre
    // territórios: a sessão do admin não existe no domínio público.
    // Definir o domínio pai aqui seria o único jeito de quebrar a barreira.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}

export async function createUserClient(
  territory: Territory,
): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: cookieOptionsFor(territory),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server components não podem escrever cookies nem headers de
            // resposta. A renovação de sessão e os headers anti-cache são
            // responsabilidade do proxy; ignorar aqui é o comportamento
            // documentado pelo Supabase.
          }
        },
      },
    },
  )
}

// O proxy precisa de um cliente para renovar a sessão. Ele obtém o cliente
// AQUI em vez de criar o próprio, para que a fronteira continue valendo sem
// exceção — inclusive no arquivo de maior poder do projeto.
export function createProxyClient(
  request: NextRequest,
  response: NextResponse,
  territory: Territory,
): SupabaseClient<Database> {
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: cookieOptionsFor(territory),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          }
          // Estes headers impedem que um CDN ou proxy reverso guarde uma
          // resposta que carrega cookie de sessão e a sirva para outra
          // pessoa. Sem eles, a sessão de um usuário pode vazar para outro.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    },
  )
}
