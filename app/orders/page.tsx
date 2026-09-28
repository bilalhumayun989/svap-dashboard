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

// ─── Notification Helper ──────────────────────────────────────────────────────
// The DB trigger (on_order_status_change) fires on ANY status update and sends
// the SAME notification to BOTH svap partners — which is wrong when only one
// order changed. This helper:
//   1. Deletes the trigger-generated notifications for this order (fired within
//      the last 10 seconds, so we catch only the ones just created).
//   2. Inserts precise, context-aware notifications for the right users.

async function fixNotifications(
  db: ReturnType<typeof createAdminClient>,
  orderId: string,         // the order whose status just changed
  ownUserId: string,       // user whose order was actually updated
  partnerUserId: string | null, // swap partner (may not have an order yet)
  ownTitle: string,
  ownBody: string,
  partnerTitle: string | null,  // null = don't notify partner
  partnerBody: string | null,
) {
  // Delete trigger-generated notifications for both users about THIS order
  // (created within last 30s to avoid touching older real notifications)
  const cutoff = new Date(Date.now() - 30_000).toISOString()
  await db
    .from('notifications')
    .delete()
    .in('user_id', partnerUserId ? [ownUserId, partnerUserId] : [ownUserId])
    .eq('type', 'order_status')
    .gte('created_at', cutoff)

  // Insert correct notification for the order owner
  await db.from('notifications').insert({
    user_id: ownUserId,
    type: 'order_status',
    title: ownTitle,
    body: ownBody,
    route: '/orders',
  })

  // Insert separate (different wording) notification for partner — only if
  // partner exists AND we have something meaningful to tell them
  if (partnerUserId && partnerTitle && partnerBody) {
    await db.from('notifications').insert({
      user_id: partnerUserId,
      type: 'order_status',
      title: partnerTitle,
      body: partnerBody,
      route: '/orders',
    })
  }
}

// ─── Server Actions ───────────────────────────────────────────────────────────
// Flow: payment_verification → product_verification → item_verification → shipped → delivered

// Step 1: payment_verification → product_verification
async function approveOrder(id: string) {
  'use server'
  const db = createAdminClient()

  const { data: order } = await db
    .from('orders')
    .select('id, status, from_user_id, swap_request_id')
    .eq('id', id)
    .single()

  if (!order || order.status !== 'payment_verification') return

  await db.from('orders').update({ status: 'product_verification' }).eq('id', id)

  let partnerUserId: string | null = null
  if (order.swap_request_id) {
    const { data: p } = await db.from('orders').select('from_user_id')
      .eq('swap_request_id', order.swap_request_id).neq('id', id).maybeSingle()
    partnerUserId = p?.from_user_id ?? null
  }

  await fixNotifications(db, id, order.from_user_id, partnerUserId,
    'Payment Verified ✅',
    'Your payment has been verified! We are now checking your item before dispatch.',
    partnerUserId ? 'Svap Partner Update 🔄' : null,
    partnerUserId ? 'Your svap partner has confirmed their payment. Your own order will be processed independently.' : null,
  )
}

// Step 2: product_verification → item_verification
async function approveProductVerification(id: string) {
  'use server'
  const db = createAdminClient()

  const { data: order } = await db
    .from('orders')
    .select('id, status, from_user_id, swap_request_id')
    .eq('id', id)
    .single()

  if (!order || order.status !== 'product_verification') return

  await db.from('orders').update({ status: 'item_verification' }).eq('id', id)

  let partnerUserId: string | null = null
  if (order.swap_request_id) {
    const { data: p } = await db.from('orders').select('from_user_id')
      .eq('swap_request_id', order.swap_request_id).neq('id', id).maybeSingle()
    partnerUserId = p?.from_user_id ?? null
  }

  await fixNotifications(db, id, order.from_user_id, partnerUserId,
    'Product Verified ✅',
    'Your product has been verified! We are now performing a final item check before shipping.',
    partnerUserId ? 'Svap Partner Update 🔄' : null,
    partnerUserId ? 'Your svap partner\'s product has been verified. Their order is progressing independently.' : null,
  )
}

async function rejectOrder(id: string) {
  'use server'
  const db = createAdminClient()

  const { data: order } = await db
    .from('orders')
    .select('from_user_id, swap_request_id')
    .eq('id', id)
    .single()

  await db.from('orders').update({ status: 'cancelled' }).eq('id', id)

  if (!order) return

  // Find partner
  let partnerUserId: string | null = null
  if (order.swap_request_id) {
    const { data: partnerOrder } = await db
      .from('orders')
      .select('from_user_id')
      .eq('swap_request_id', order.swap_request_id)
      .neq('id', id)
      .maybeSingle()
    partnerUserId = partnerOrder?.from_user_id ?? null
  }

  await fixNotifications(
    db,
    id,
    order.from_user_id,
    partnerUserId,
    'Payment Rejected ❌',
    'Your payment could not be verified. Please contact support for assistance.',
    partnerUserId ? 'Svap Update ⚠️' : null,
    partnerUserId ? 'Your svap partner\'s payment was rejected. This swap will not proceed further.' : null,
  )
}

async function cancelOrder(id: string) {
  'use server'
  await cancelOrderAndRestoreItems(id)
}

async function assignDelivery(id: string, type: 'courier' | 'self') {
  'use server'
  const db = createAdminClient()
  // delivery_type assignment does not change status — no notification needed
  await db.from('orders').update({ delivery_type: type }).eq('id', id)
}

async function markShipped(id: string, trackingNumber: string | null) {
  'use server'
  const db = createAdminClient()

  const { data: order } = await db
    .from('orders')
    .select('from_user_id, swap_request_id, delivery_type')
    .eq('id', id)
    .single()

  await db
    .from('orders')
    .update({ status: 'shipped', ...(trackingNumber ? { tracking_number: trackingNumber } : {}) })
    .eq('id', id)

  if (!order) return

  let partnerUserId: string | null = null
  if (order.swap_request_id) {
    const { data: partnerOrder } = await db
      .from('orders')
      .select('from_user_id')
      .eq('swap_request_id', order.swap_request_id)
      .neq('id', id)
      .maybeSingle()
    partnerUserId = partnerOrder?.from_user_id ?? null
  }

  const trackingNote = trackingNumber ? ` Tracking number: ${trackingNumber}` : ''
  const deliveryNote = order.delivery_type === 'self' ? 'Our rider is on the way to you.' : 'Your item is being sent via courier.'

  await fixNotifications(
    db,
    id,
    order.from_user_id,
    partnerUserId,
    'Order Shipped',
    `Your order has been shipped! ${deliveryNote}${trackingNote}`,
    partnerUserId ? 'Svap Partner Update ' : null,
    partnerUserId ? 'Your svap partner\'s item has been shipped. Your own order is being processed separately.' : null,
  )
}

async function markDelivered(id: string) {
  'use server'
  const db = createAdminClient()

  const { data: order } = await db
    .from('orders')
    .select('from_user_id, swap_request_id')
    .eq('id', id)
    .single()

  await db.from('orders').update({ status: 'delivered' }).eq('id', id)

  if (!order) return

  let partnerUserId: string | null = null
  let allDelivered = false

  if (order.swap_request_id) {
    const { data: partnerOrder } = await db
      .from('orders')
      .select('from_user_id, status')
      .eq('swap_request_id', order.swap_request_id)
      .neq('id', id)
      .maybeSingle()

    partnerUserId = partnerOrder?.from_user_id ?? null

    // Check if both sides are now delivered
    const { data: swapOrders } = await db
      .from('orders')
      .select('id, status')
      .eq('swap_request_id', order.swap_request_id)

    allDelivered =
      (swapOrders ?? []).length >= 2 &&
      (swapOrders ?? []).every((o: { status: string }) => o.status === 'delivered')

    if (allDelivered) {
      await db
        .from('swap_requests')
        .update({ status: 'completed' })
        .eq('id', order.swap_request_id)
    }
  }

  await fixNotifications(
    db,
    id,
    order.from_user_id,
    partnerUserId,
    'Order Delivered 🎉',
    'Your item has been delivered! Enjoy your svap.',
    partnerUserId && !allDelivered ? 'Svap Partner Update ✅' : null,
    partnerUserId && !allDelivered ? 'Your svap partner\'s item has been delivered. You will receive a separate notification when your item is delivered.' : null,
  )
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
    (o) => o.status === 'payment_verification' || o.status === 'product_verification' || o.status === 'item_verification',
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
        onApproveProduct={approveProductVerification}
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
