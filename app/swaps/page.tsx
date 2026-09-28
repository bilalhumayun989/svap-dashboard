// Server Component — swap-grouped orders list.
// Queries swap_requests with nested orders + profiles + products.
// All mutations happen in /swaps/[swapId].

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import SwapsClient from '@/components/SwapsClient'
import type { SwapRow, SwapPartyOrder, SwapPartyProfile, SwapProduct, OrderStatus } from '@/lib/types'

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

  const db = createAdminClient()

  // Fetch swap_requests with all related data in one query.
  // !inner on orders means only swaps that have at least one order are returned.
  const { data: rawSwaps, error } = await db
    .from('swap_requests')
    .select(`
      id,
      status,
      created_at,
      premium_amount,
      from_user_id,
      to_user_id,
      sender:profiles!swap_requests_from_user_id_fkey(id, username, full_name, email, phone),
      receiver:profiles!swap_requests_to_user_id_fkey(id, username, full_name, email, phone),
      offered_product:products!swap_requests_offered_product_id_fkey(id, title, image_urls),
      requested_product:products!swap_requests_requested_product_id_fkey(id, title, image_urls),
      orders!inner(
        id, from_user_id, to_user_id, status, delivery_type, tracking_number,
        transaction_ref, shipping_cost, premium_amount, discount, total,
        delivery_name, delivery_phone, delivery_address, delivery_city,
        admin_notes, created_at
      )
    `)
    .order('created_at', { ascending: false })

  if (error) console.error('[swaps/page] fetch error:', error)

  // ── Map raw DB rows → SwapRow ──────────────────────────────────────────────
  const swaps: SwapRow[] = (rawSwaps ?? []).map((s: any) => {
    const senderProfile = (Array.isArray(s.sender) ? s.sender[0] : s.sender) as SwapPartyProfile | null
    const receiverProfile = (Array.isArray(s.receiver) ? s.receiver[0] : s.receiver) as SwapPartyProfile | null
    const offeredProduct = (Array.isArray(s.offered_product) ? s.offered_product[0] : s.offered_product) as SwapProduct | null
    const requestedProduct = (Array.isArray(s.requested_product) ? s.requested_product[0] : s.requested_product) as SwapProduct | null

    const orders: SwapPartyOrder[] = (s.orders ?? []) as SwapPartyOrder[]

    // Party 1 = order whose from_user_id === swap_requests.from_user_id (sender)
    const party1Order = orders.find(o => o.from_user_id === s.from_user_id) ?? null
    // Party 2 = order whose from_user_id === swap_requests.to_user_id (receiver)
    const party2Order = orders.find(o => o.from_user_id === s.to_user_id) ?? null

    return {
      swapId: s.id,
      swapStatus: s.status ?? 'pending',
      createdAt: s.created_at,
      premiumAmount: s.premium_amount ?? 0,
      sender: senderProfile ?? { id: s.from_user_id, username: '—', full_name: '—' },
      receiver: receiverProfile ?? { id: s.to_user_id, username: '—', full_name: '—' },
      offeredProduct: offeredProduct,
      requestedProduct: requestedProduct ?? null,
      party1Order,
      party2Order,
    }
  })

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
              Manage swap pairs — <span className="text-zinc-300 font-semibold">{swaps.length}</span> swap{swaps.length !== 1 ? 's' : ''}
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
            <strong>Error loading swaps:</strong> {error.message}
          </div>
        )}

        <SwapsClient swaps={swaps} />
      </main>
    </div>
  )
}
