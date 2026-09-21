// Server Component — no 'use client'. All reads use service_role (RLS bypass).
// Mutations use Server Actions.

import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import StatusBadge from '@/components/StatusBadge'
import OrderDetailActions from '@/components/OrderDetailActions'
import type { Order, OrderStatus } from '@/lib/types'

// ─── Auth helper ──────────────────────────────────────────────────────────────
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
async function updateOrderStatus(id: string, status: OrderStatus, trackingNumber?: string) {
  'use server'
  const db = createAdminClient()
  const update: Record<string, unknown> = { status }
  if (trackingNumber) update.tracking_number = trackingNumber
  await db.from('orders').update(update).eq('id', id)

  if (status === 'delivered') {
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
}

async function assignDeliveryType(id: string, type: 'courier' | 'self') {
  'use server'
  const db = createAdminClient()
  await db.from('orders').update({ delivery_type: type }).eq('id', id)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = createAdminClient()

  // Fetch the order with joined profiles and swap items
  const { data: orderRaw, error } = await db
    .from('orders')
    .select(`
      *,
      from_profile:profiles!from_user_id(username, full_name, email),
      to_profile:profiles!to_user_id(username, full_name),
      swap_request:swap_requests!swap_request_id(
        offered_product:products!offered_product_id(title, image_urls),
        requested_product:products!requested_product_id(title, image_urls)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !orderRaw) notFound()
  const order = orderRaw as Order

  // Fetch the linked order (other party's order for the same swap)
  const { data: linkedOrderRaw } = order.swap_request_id
    ? await db
        .from('orders')
        .select(
          'id, delivery_name, delivery_phone, delivery_address, delivery_city, status, tracking_number, from_profile:profiles!from_user_id(username, full_name)',
        )
        .eq('swap_request_id', order.swap_request_id)
        .neq('id', id)
        .maybeSingle()
    : { data: null }

  const linkedOrder = linkedOrderRaw as Order | null

  const offeredImg = order.swap_request?.offered_product?.image_urls?.[0]
  const requestedImg = order.swap_request?.requested_product?.image_urls?.[0]

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/orders" className="text-zinc-500 hover:text-zinc-300 text-sm">
            ← Orders
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 text-sm font-mono">
            {order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-zinc-100">
              Order {order.id.replaceAll('-', '').slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={order.status as OrderStatus} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column (details) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Swap items */}
            {order.swap_request && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="font-bold text-zinc-100 mb-4">Svap Items</h2>
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-3">
                    {offeredImg
                      ? <img src={offeredImg} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      : <div className="w-16 h-16 rounded-lg bg-zinc-800" />}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Offered</p>
                      <p className="font-medium text-zinc-100 text-sm">
                        {order.swap_request.offered_product?.title ?? '—'}
                      </p>
                    </div>
                  </div>
                  <span className="text-orange-400 font-bold text-xl">⇄</span>
                  <div className="flex-1 flex items-center gap-3 flex-row-reverse text-right">
                    {requestedImg
                      ? <img src={requestedImg} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      : <div className="w-16 h-16 rounded-lg bg-zinc-800" />}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">Requested</p>
                      <p className="font-medium text-zinc-100 text-sm">
                        {order.swap_request.requested_product?.title ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Pickup addresses — both parties */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-bold text-zinc-100 mb-4">Pickup Addresses</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-800 pb-2">
                    Party 1 — @{(order.from_profile as { username?: string })?.username ?? '—'}
                  </p>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <Field label="Full Name"  value={order.delivery_name} />
                    <Field label="Phone"      value={order.delivery_phone} />
                    <Field label="City"       value={order.delivery_city} />
                    <Field label="Address"    value={order.delivery_address} />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-800 pb-2">
                    Party 2
                    {linkedOrder ? ` — @${(linkedOrder.from_profile as { username?: string })?.username ?? '—'}` : ''}
                  </p>
                  {linkedOrder ? (
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <Field label="Full Name"  value={linkedOrder.delivery_name} />
                      <Field label="Phone"      value={linkedOrder.delivery_phone} />
                      <Field label="City"       value={linkedOrder.delivery_city} />
                      <Field label="Address"    value={linkedOrder.delivery_address} />
                      <div className="pt-1">
                        <Link href={`/orders/${linkedOrder.id}`} className="text-xs text-orange-400 hover:underline">
                          View their order →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 italic">
                      Other party hasn't completed checkout yet.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-bold text-zinc-100 mb-4">Payment</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Transaction Reference" value={order.transaction_ref ?? '—'} mono />
                <Field label="Shipping Cost"         value={`PKR ${order.shipping_cost.toLocaleString()}`} />
                {order.premium_amount > 0 && (
                  <Field label="Cash Boost (rider collects)" value={`PKR ${order.premium_amount.toLocaleString()}`} />
                )}
                <Field label="Total" value={`PKR ${order.total.toLocaleString()}`} accent />
              </div>
            </section>

            {/* Tracking */}
            {order.tracking_number && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="font-bold text-zinc-100 mb-2">Tracking</h2>
                <p className="font-mono text-sm text-zinc-300">{order.tracking_number}</p>
              </section>
            )}
          </div>

          {/* ── Right column (parties + actions) ── */}
          <div className="space-y-4">

            {/* Parties */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-bold text-zinc-100 mb-1">Parties</h2>
              <p className="text-xs text-zinc-500 mb-4">Sender → Receiver</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs">From (Sender)</p>
                  <p className="font-medium">@{(order.from_profile as { username?: string })?.username ?? '—'}</p>
                  <p className="text-zinc-400">{(order.from_profile as { full_name?: string })?.full_name}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">To (Receiver)</p>
                  <p className="font-medium">@{(order.to_profile as { username?: string })?.username ?? '—'}</p>
                  <p className="text-zinc-400">{(order.to_profile as { full_name?: string })?.full_name}</p>
                </div>
              </div>
            </section>

            {/* Client component handles interactive action buttons */}
            <OrderDetailActions
              order={order}
              onUpdateStatus={updateOrderStatus}
              onAssignDelivery={assignDeliveryType}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Static field display ─────────────────────────────────────────────────────
function Field({
  label, value, mono, accent,
}: {
  label: string; value: string; mono?: boolean; accent?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`${mono ? 'font-mono text-xs' : ''} ${accent ? 'text-orange-400 font-bold' : 'text-zinc-100'}`}>
        {value}
      </p>
    </div>
  )
}
