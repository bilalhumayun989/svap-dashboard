import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function adminApi(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(values) { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* server component cookies are read-only */ } },
    } },
  )
  const { data: { session } } = await client.auth.getSession()
  if (!session?.access_token) throw new Error('Please sign in again.')
  const base = (process.env.SVAP_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `SVAP API returned ${response.status}`)
  return payload
}