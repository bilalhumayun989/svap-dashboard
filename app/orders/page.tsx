// Server Component — no 'use client'. All data fetched server-side via
// service_role key so RLS does NOT restrict access.

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import OrdersClient from '@/components/OrdersClient'
import { cancelOrderAndRestoreItems } from '@/lib/cancelOrder'
import type { Order } from '@/lib/types'

// ─── Auth helper (server-side, reads session cookie) ─────────────────────────
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
          catch { /* read-only in Server Component — ignore */ }
        },
      },
    },
  )
  const { data: { user } } = await serverClient.auth.getUser()
  return user
}

// ─── Server Actions ───────────────────────────────────────────────────────────
async function approveOrder(id: string) {
  'use server'
  const db = createAdminClient()
  await db.from('orders').update({ status: 'confirmed' }).eq('id', id)
}

async function rejectOrder(id: string) {
  'use server'
  const db = createAdminClient()
  await db.from('orders').update({ status: 'cancelled' }).eq('id', id)
}

async function cancelOrder(id: string) {
  'use server'
  await cancelOrderAndRestoreItems(id)
}

async function assignDelivery(id: string, type: 'courier' | 'self') {
  'use server'
  const db = createAdminClient()
  await db.from('orders').update({ delivery_type: type }).eq('id', id)
}

async function markShipped(id: string, trackingNumber: string | null) {
  'use server'
  const db = createAdminClient()
  await db
    .from('orders')
    .update({ status: 'shipped', ...(trackingNumber ? { tracking_number: trackingNumber } : {}) })
    .eq('id', id)
}

async function markDelivered(id: string) {
  'use server'
  const db = createAdminClient()
  await db.from('orders').update({ status: 'delivered' }).eq('id', id)

  // If both orders for the same swap are now delivered → complete the swap
  const { data: order } = await db
    .from('orders')
    .select('swap_request_id')
    .eq('id', id)
    .single()

  if (order?.swap_request_id) {
    const { data: swapOrders } = await db
      .from('orders')
      .select('id, status')
      .eq('swap_request_id', order.swap_request_id)

    const allDelivered =
      (swapOrders ?? []).length >= 2 &&
      (swapOrders ?? []).every((o: { status: string }) => o.status === 'delivered')

    if (allDelivered) {
      await db
        .from('swap_requests')
        .update({ status: 'completed' })
        .eq('id', order.swap_request_id)
    }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  // Auth check — must be logged-in admin
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { status: statusParam } = await searchParams
  const statusFilter = statusParam ?? 'all'

  // Fetch ALL orders server-side — service_role bypasses RLS
  const db = createAdminClient()
  const { data: orders, error } = await db
    .from('orders')
    .select(
      'id, swap_request_id, delivery_name, delivery_phone, delivery_city, total, status, delivery_type, transaction_ref, tracking_number, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[orders/page] fetch error:', error)
  }

  const allOrders = (orders ?? []) as Order[]

  // Count badges for header
  const pendingCount = allOrders.filter(
    (o) => o.status === 'pending_verification',
  ).length

  return (
   <div className="flex min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
  <Sidebar />
  <main className="flex-1 p-3 sm:p-6 overflow-x-hidden min-w-0">
    {/* Top Header Section */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Orders</h1>
        <p className="text-zinc-500 text-xs sm:text-sm mt-0.5 font-medium">
          Manage, verify and assign deliveries — <span className="text-zinc-300 font-semibold">{allOrders.length}</span> total order{allOrders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-3 py-1 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {pendingCount} pending verification
          </span>
        </div>
      )}
    </div>

    {/* Error Banner */}
    {error && (
      <div className="my-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs sm:text-sm flex items-center justify-between">
        <div>
          <strong className="font-semibold">Error loading orders:</strong> {error.message}
        </div>
      </div>
    )}

    {/* Orders Table Container */}
    <div className="mt-4">
      <OrdersClient
        orders={allOrders}
        initialStatus={statusFilter}
        onApprove={approveOrder}
        onReject={rejectOrder}
        onCancel={cancelOrder}
        onAssignDelivery={assignDelivery}
        onMarkShipped={markShipped}
        onMarkDelivered={markDelivered}
      />
    </div>
  </main>
</div>
  )
}
