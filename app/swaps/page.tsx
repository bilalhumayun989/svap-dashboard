// Server Component — swap-grouped orders list.
// Queries swap_requests with nested orders + profiles + products.
// All mutations happen in /swaps/[swapId].

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { adminApi } from '@/lib/backend'
import Sidebar from '@/components/Sidebar'
import SwapsClient from '@/components/SwapsClient'
import type { SwapRow } from '@/lib/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getSessionUser() {
  const cookieStore = await cookies()
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* read-only in Server Component */ }
        },
      },
    },
  )
  const { data: { user } } = await serverClient.auth.getUser()
  return user
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SwapsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  let swaps: SwapRow[] = []
  let error: { message: string } | null = null
  try {
    const result = await adminApi('/admin/swaps')
    swaps = result.data as SwapRow[]
  } catch (e) {
    error = { message: e instanceof Error ? e.message : 'Could not load swaps' }
  }

  const pendingCount = swaps.filter(s =>
    [s.party1Order?.status, s.party2Order?.status].some(st =>
      st && ['payment_verification', 'product_verification', 'item_verification'].includes(st)
    )
  ).length

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-3 sm:p-6 overflow-x-hidden min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Orders</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 font-medium">
              Manage svap pairs — <span className="text-zinc-300 font-semibold">{swaps.length}</span> svap{swaps.length !== 1 ? 's' : ''}
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-3 py-1 text-xs font-semibold self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingCount} pending verification
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs">
            <strong>Error loading svaps:</strong> {error.message}
          </div>
        )}

        <SwapsClient swaps={swaps} />
      </main>
    </div>
  )
}
