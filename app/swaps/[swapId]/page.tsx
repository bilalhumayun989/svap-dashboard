// Server Component — swap detail page.
// Shows both party panels side by side. Each action button only touches
// that party's specific order id — the other panel is never modified.

import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { fixNotifications } from '@/lib/notifications'
import { cancelOrderAndRestoreItems } from '@/lib/cancelOrder'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import StatusBadge from '@/components/StatusBadge'
import SwapOrderPanel from '@/components/SwapOrderPanel'
import type { SwapPartyOrder, SwapPartyProfile, SwapProduct, OrderStatus } from '@/lib/types'
import { ArrowLeftRight, ArrowLeft, ShieldCheck } from 'lucide-react'

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
          catch { /* read-only */ }
        },
      },
    },
  )
  const { data: { user } } = await serverClient.auth.getUser()
  return user
}

// ─── Revalidate helper ────────────────────────────────────────────────────────
function revalidateAll(swapId: string) {
  revalidatePath('/swaps')
  revalidatePath(`/swaps/${swapId}`)
  revalidatePath('/orders')
}

// ─── Shared: find partner user id ─────────────────────────────────────────────
async function findPartnerUserId(
  db: ReturnType<typeof createAdminClient>,
  orderId: string,
  swapRequestId: string,
): Promise<string | null> {
  const { data } = await db
    .from('orders')
    .select('from_user_id')
    .eq('swap_request_id', swapRequestId)
    .neq('id', orderId)
    .maybeSingle()
  return data?.from_user_id ?? null
}

// ─── Server Actions ───────────────────────────────────────────────────────────
// Every action operates ONLY on the specific order id passed.
// The swapId is captured via closure from the page params.

async function makeApprovePayment(swapId: string) {
  async function approvePayment(orderId: string) {
    'use server'
    const db = createAdminClient()
    const { data: order } = await db
      .from('orders').select('status, from_user_id, swap_request_id').eq('id', orderId).single()
    if (!order || order.status !== 'payment_verification') return
    await db.from('orders').update({ status: 'product_verification' }).eq('id', orderId)
    const partnerUserId = await findPartnerUserId(db, orderId, order.swap_request_id)
    await fixNotifications(db, orderId, order.from_user_id, partnerUserId,
      'Payment Verified ✅',
      'Your payment has been verified! We are now checking your item before dispatch.',
      partnerUserId ? 'Swap Partner Update 🔄' : null,
      partnerUserId ? 'Your swap partner has confirmed their payment. Your own order will be processed independently.' : null,
    )
    revalidateAll(swapId)
  }
  return approvePayment
}

async function makeRejectPayment(swapId: string) {
  async function rejectPayment(orderId: string) {
    'use server'
    const db = createAdminClient()
    const { data: order } = await db
      .from('orders').select('from_user_id, swap_request_id').eq('id', orderId).single()
    await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    if (!order) return
    const partnerUserId = await findPartnerUserId(db, orderId, order.swap_request_id)
    await fixNotifications(db, orderId, order.from_user_id, partnerUserId,
      'Payment Rejected ❌',
      'Your payment could not be verified. Please contact support for assistance.',
      partnerUserId ? 'Swap Update ⚠️' : null,
      partnerUserId ? "Your swap partner's payment was rejected. This swap will not proceed further." : null,
    )
    revalidateAll(swapId)
  }
  return rejectPayment
}

async function makeVerifyItem(swapId: string) {
  async function verifyItem(orderId: string) {
    'use server'
    const db = createAdminClient()
    const { data: order } = await db
      .from('orders').select('status, from_user_id, swap_request_id').eq('id', orderId).single()
    if (!order || order.status !== 'product_verification') return
    await db.from('orders').update({ status: 'item_verification' }).eq('id', orderId)
    const partnerUserId = await findPartnerUserId(db, orderId, order.swap_request_id)
    await fixNotifications(db, orderId, order.from_user_id, partnerUserId,
      'Product Verified ✅',
      'Your product has been verified! We are now performing a final item check before shipping.',
      partnerUserId ? 'Swap Partner Update 🔄' : null,
      partnerUserId ? "Your swap partner's product has been verified. Their order is progressing independently." : null,
    )
    revalidateAll(swapId)
  }
  return verifyItem
}

async function makeAssignDelivery(swapId: string) {
  async function assignDelivery(orderId: string, type: 'courier' | 'self') {
    'use server'
    const db = createAdminClient()
    await db.from('orders').update({ delivery_type: type }).eq('id', orderId)
    revalidateAll(swapId)
  }
  return assignDelivery
}

async function makeMarkShipped(swapId: string) {
  async function markShipped(orderId: string, trackingNumber: string | null) {
    'use server'
    const db = createAdminClient()
    const { data: order } = await db
      .from('orders').select('from_user_id, swap_request_id, delivery_type').eq('id', orderId).single()
    await db.from('orders').update({
      status: 'shipped',
      ...(trackingNumber ? { tracking_number: trackingNumber } : {}),
    }).eq('id', orderId)
    if (!order) return
    const partnerUserId = await findPartnerUserId(db, orderId, order.swap_request_id)
    const trackingNote = trackingNumber ? ` Tracking: ${trackingNumber}` : ''
    const deliveryNote = order.delivery_type === 'self' ? 'Our rider is on the way to you.' : 'Your item is being sent via courier.'
    await fixNotifications(db, orderId, order.from_user_id, partnerUserId,
      'Order Shipped 📦',
      `Your order has been shipped! ${deliveryNote}${trackingNote}`,
      partnerUserId ? 'Swap Partner Update 📦' : null,
      partnerUserId ? "Your swap partner's item has been shipped. Your own order is being processed separately." : null,
    )
    revalidateAll(swapId)
  }
  return markShipped
}

async function makeMarkDelivered(swapId: string) {
  async function markDelivered(orderId: string) {
    'use server'
    const db = createAdminClient()
    const { data: order } = await db
      .from('orders').select('from_user_id, swap_request_id').eq('id', orderId).single()
    await db.from('orders').update({ status: 'delivered' }).eq('id', orderId)
    if (!order) return
    const partnerUserId = await findPartnerUserId(db, orderId, order.swap_request_id)

    // Check if both sides now delivered
    const { data: swapOrders } = await db
      .from('orders').select('id, status').eq('swap_request_id', order.swap_request_id)
    const allDelivered =
      (swapOrders ?? []).length >= 2 &&
      (swapOrders ?? []).every((o: { status: string }) => o.status === 'delivered')
    if (allDelivered) {
      await db.from('swap_requests').update({ status: 'completed' }).eq('id', order.swap_request_id)
    }

    await fixNotifications(db, orderId, order.from_user_id, partnerUserId,
      'Order Delivered 🎉',
      'Your item has been delivered! Enjoy your swap.',
      partnerUserId && !allDelivered ? 'Swap Partner Update ✅' : null,
      partnerUserId && !allDelivered ? "Your swap partner's item has been delivered. You will receive a separate notification when your item is delivered." : null,
    )
    revalidateAll(swapId)
  }
  return markDelivered
}

async function makeSaveAdminNote(swapId: string) {
  async function saveAdminNote(orderId: string, note: string) {
    'use server'
    const db = createAdminClient()
    await db.from('orders').update({ admin_notes: note || null }).eq('id', orderId)
    revalidateAll(swapId)
  }
  return saveAdminNote
}

async function makeCancelSwap(swapId: string) {
  async function cancelSwap(anyOrderId: string) {
    'use server'
    await cancelOrderAndRestoreItems(anyOrderId)
    revalidateAll(swapId)
  }
  return cancelSwap
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SwapDetailPage({
  params,
}: {
  params: Promise<{ swapId: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { swapId } = await params
  const db = createAdminClient()

  // Fetch swap_request + profiles + products
  const { data: swap, error: swapError } = await db
    .from('swap_requests')
    .select(`
      id, status, created_at, premium_amount, from_user_id, to_user_id,
      sender:profiles!swap_requests_from_user_id_fkey(id, username, full_name, email, phone),
      receiver:profiles!swap_requests_to_user_id_fkey(id, username, full_name, email, phone),
      offered_product:products!swap_requests_offered_product_id_fkey(id, title, image_urls),
      requested_product:products!swap_requests_requested_product_id_fkey(id, title, image_urls)
    `)
    .eq('id', swapId)
    .single()

  if (swapError || !swap) notFound()

  // Fetch both orders for this swap
  const { data: orders } = await db
    .from('orders')
    .select(`
      id, from_user_id, to_user_id, status, delivery_type, tracking_number,
      transaction_ref, shipping_cost, premium_amount, discount, total,
      delivery_name, delivery_phone, delivery_address, delivery_city,
      admin_notes, created_at
    `)
    .eq('swap_request_id', swapId)

  const allOrders = (orders ?? []) as SwapPartyOrder[]

  // Party 1 = sender's order (from_user_id === swap.from_user_id)
  const party1Order = allOrders.find(o => o.from_user_id === swap.from_user_id) ?? null
  // Party 2 = receiver's order (from_user_id === swap.to_user_id)
  const party2Order = allOrders.find(o => o.from_user_id === swap.to_user_id) ?? null

  const senderProfile = (Array.isArray(swap.sender) ? swap.sender[0] : swap.sender) as SwapPartyProfile
  const receiverProfile = (Array.isArray(swap.receiver) ? swap.receiver[0] : swap.receiver) as SwapPartyProfile
  const offeredProduct = (Array.isArray(swap.offered_product) ? swap.offered_product[0] : swap.offered_product) as SwapProduct | null
  const requestedProduct = (Array.isArray(swap.requested_product) ? swap.requested_product[0] : swap.requested_product) as SwapProduct | null

  const offeredImg = offeredProduct?.image_urls?.[0]
  const requestedImg = requestedProduct?.image_urls?.[0]
  const isCashOnly = !offeredProduct

  const swapNum = swapId.replaceAll('-', '').slice(0, 6).toUpperCase()

  // Build server actions (closure captures swapId for revalidatePath)
  const [
    approvePayment,
    rejectPayment,
    verifyItem,
    assignDelivery,
    markShipped,
    markDelivered,
    saveAdminNote,
    cancelSwap,
  ] = await Promise.all([
    makeApprovePayment(swapId),
    makeRejectPayment(swapId),
    makeVerifyItem(swapId),
    makeAssignDelivery(swapId),
    makeMarkShipped(swapId),
    makeMarkDelivered(swapId),
    makeSaveAdminNote(swapId),
    makeCancelSwap(swapId),
  ])

  // Determine if cancel is possible (either order still active)
  const canCancel = allOrders.some(o =>
    !['cancelled', 'delivered'].includes(o.status)
  )

  const cancelOrderId = party1Order?.id ?? party2Order?.id ?? ''

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link href="/swaps" className="inline-flex items-center gap-1 text-zinc-400 hover:text-orange-400 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" /> Orders
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 font-mono text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
            Swap #{swapNum}
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              Swap #{swapNum}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              {new Date(swap.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              swap.status === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
              swap.status === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
              'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              Swap: {swap.status}
            </span>
          </div>
        </div>

        {/* Swap Items */}
        <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-4 h-4 text-orange-400" />
            <h2 className="font-bold text-zinc-100">Swap Items</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-4 bg-zinc-900/60 border border-zinc-800/50 p-4 rounded-xl">
            {/* Offered / Cash */}
            <div className="sm:col-span-5 flex items-center gap-3">
              {isCashOnly ? (
                <div className="w-14 h-14 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 text-xs font-bold">PKR</span>
                </div>
              ) : offeredImg ? (
                <img src={offeredImg} className="w-14 h-14 rounded-lg object-cover border border-zinc-700 shrink-0" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-zinc-800 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
                  {isCashOnly ? 'Cash' : 'Offered'}
                </span>
                <p className="font-semibold text-zinc-100 text-sm truncate">
                  {isCashOnly ? `PKR ${swap.premium_amount.toLocaleString()} cash` : offeredProduct?.title ?? '—'}
                </p>
                {!isCashOnly && swap.premium_amount > 0 && (
                  <p className="text-xs text-emerald-400">+ PKR {swap.premium_amount.toLocaleString()} cash boost</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-1 flex justify-center">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>

            {/* Requested */}
            <div className="sm:col-span-5 flex sm:flex-row-reverse items-center gap-3 sm:text-right">
              {requestedImg ? (
                <img src={requestedImg} className="w-14 h-14 rounded-lg object-cover border border-zinc-700 shrink-0" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-zinc-800 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                  Requested
                </span>
                <p className="font-semibold text-zinc-100 text-sm truncate">{requestedProduct?.title ?? '—'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Two party panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <SwapOrderPanel
            party="Party 1 (Sender)"
            profile={senderProfile}
            order={party1Order}
            onApprovePayment={approvePayment}
            onRejectPayment={rejectPayment}
            onVerifyItem={verifyItem}
            onAssignDelivery={assignDelivery}
            onMarkShipped={markShipped}
            onMarkDelivered={markDelivered}
            onSaveAdminNote={saveAdminNote}
          />
          <SwapOrderPanel
            party="Party 2 (Receiver)"
            profile={receiverProfile}
            order={party2Order}
            onApprovePayment={approvePayment}
            onRejectPayment={rejectPayment}
            onVerifyItem={verifyItem}
            onAssignDelivery={assignDelivery}
            onMarkShipped={markShipped}
            onMarkDelivered={markDelivered}
            onSaveAdminNote={saveAdminNote}
          />
        </div>

        {/* Swap-level cancel */}
        {canCancel && (
          <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <h2 className="font-bold text-zinc-100 text-sm">Swap Controls</h2>
            </div>
            <form action={async () => {
              'use server'
              await cancelSwap(cancelOrderId)
            }}>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-semibold hover:bg-red-500/25 transition-colors"
              >
                Cancel Entire Swap &amp; Restore Items
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
