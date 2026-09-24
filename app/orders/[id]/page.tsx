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
import { cancelOrderAndRestoreItems } from '@/lib/cancelOrder'
import type { Order, OrderStatus } from '@/lib/types'
import { ArrowLeftRight, Truck, MapPin, User, ShieldCheck, CreditCard, ArrowLeft } from 'lucide-react'

// ─── Auth Helper ──────────────────────────────────────────────────────────────
async function getSessionUser() {
  const cookieStore = await cookies()
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            /* read-only in Server Component — ignore */
          }
        },
      },
    },
  )
  const {
    data: { user },
  } = await serverClient.auth.getUser()
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

async function cancelOrder(id: string) {
  'use server'
  await cancelOrderAndRestoreItems(id)
}

// ─── Helper Components ────────────────────────────────────────────────────────
function Field({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string
  value?: string | number | null
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-sm font-semibold truncate ${
          accent ? 'text-orange-400 text-base' : 'text-zinc-200'
        } ${mono ? 'font-mono text-zinc-300' : ''}`}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

function isImageURL(url?: string | null) {
  if (!url) return false
  return (
    url.startsWith('http') &&
    (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url) || url.includes('/storage/v1/object/'))
  )
}

// ─── Page Component ───────────────────────────────────────────────────────────
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  const db = createAdminClient()

  // Fetch order details with relational joins
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

  // Fetch linked order (Party 2 order)
  const { data: linkedOrderRaw } = order.swap_request_id
    ? await db
        .from('orders')
        .select(
          'id, delivery_name, delivery_phone, delivery_address, delivery_city, status, tracking_number, shipping_cost, premium_amount, total, transaction_ref, from_profile:profiles!from_user_id(username, full_name)',
        )
        .eq('swap_request_id', order.swap_request_id)
        .neq('id', id)
        .maybeSingle()
    : { data: null }

  const linkedOrder = linkedOrderRaw as Order | null

  const offeredImg = order.swap_request?.offered_product?.image_urls?.[0]
  const requestedImg = order.swap_request?.requested_product?.image_urls?.[0]

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />
      
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-orange-400 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Orders
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 font-mono text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Page Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              Order #{order.id.replaceAll('-', '').slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              Placed on{' '}
              {new Date(order.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className="self-start sm:self-center shrink-0">
            <StatusBadge status={order.status as OrderStatus} />
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── Left Column (Order Details & Payments) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Swap Items Card */}
            {order.swap_request && (
              <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <ArrowLeftRight className="w-4 h-4 text-orange-400" />
                  <h2 className="font-bold text-zinc-100 text-base">Swap Items</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-4 bg-zinc-900/60 border border-zinc-800/50 p-4 rounded-xl">
                  {/* Offered Product */}
                  <div className="sm:col-span-5 flex items-center gap-3.5">
                    {offeredImg ? (
                      <img
                        src={offeredImg}
                        className="w-16 h-16 rounded-lg object-cover border border-zinc-700/60 shrink-0"
                        alt="Offered product"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs shrink-0">
                        No Image
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
                        Offered
                      </span>
                      <p className="font-semibold text-zinc-100 text-sm truncate">
                        {order.swap_request.offered_product?.title ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Icon Divider */}
                  <div className="sm:col-span-1 flex justify-center py-1 sm:py-0">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Requested Product */}
                  <div className="sm:col-span-5 flex sm:flex-row-reverse items-center gap-3.5 sm:text-right">
                    {requestedImg ? (
                      <img
                        src={requestedImg}
                        className="w-16 h-16 rounded-lg object-cover border border-zinc-700/60 shrink-0"
                        alt="Requested product"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs shrink-0">
                        No Image
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                        Requested
                      </span>
                      <p className="font-semibold text-zinc-100 text-sm truncate">
                        {order.swap_request.requested_product?.title ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Both Parties' Payment Details Side by Side */}
            <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <CreditCard className="w-4 h-4 text-orange-400" />
                <h2 className="font-bold text-zinc-100 text-base">Both Parties Payment Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Party 1 Payment */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <p className="text-xs text-orange-400 uppercase tracking-wider font-bold">
                      Party 1 Payment (@{(order.from_profile as { username?: string })?.username ?? '—'})
                    </p>
                    <StatusBadge status={order.status as OrderStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Shipping Cost"
                      value={`PKR ${order.shipping_cost?.toLocaleString() ?? '0'}`}
                    />
                    <Field
                      label="Cash Boost"
                      value={`PKR ${order.premium_amount?.toLocaleString() ?? '0'}`}
                    />
                    <div className="col-span-2 pt-1 border-t border-zinc-800/60">
                      <Field
                        label="Total Paid"
                        value={`PKR ${order.total?.toLocaleString() ?? '0'}`}
                        accent
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60">
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                      Transaction Proof
                    </p>
                    {isImageURL(order.transaction_ref) ? (
                      <a
                        href={order.transaction_ref!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-1"
                      >
                        <img
                          src={order.transaction_ref!}
                          alt="Party 1 Payment Proof"
                          className="w-16 h-16 object-cover rounded-lg border border-zinc-700 hover:border-orange-400 transition-colors"
                        />
                      </a>
                    ) : (
                      <p className="text-xs font-mono text-zinc-300 truncate bg-zinc-900 px-2.5 py-1.5 rounded border border-zinc-800">
                        {order.transaction_ref || 'No Ref Attached'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Party 2 Payment */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <p className="text-xs text-blue-400 uppercase tracking-wider font-bold">
                      Party 2 Payment ({linkedOrder ? `@${(linkedOrder.from_profile as { username?: string })?.username ?? '—'}` : '—'})
                    </p>
                    {linkedOrder && <StatusBadge status={linkedOrder.status as OrderStatus} />}
                  </div>

                  {linkedOrder ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          label="Shipping Cost"
                          value={`PKR ${linkedOrder.shipping_cost?.toLocaleString() ?? '0'}`}
                        />
                        <Field
                          label="Cash Boost"
                          value={`PKR ${linkedOrder.premium_amount?.toLocaleString() ?? '0'}`}
                        />
                        <div className="col-span-2 pt-1 border-t border-zinc-800/60">
                          <Field
                            label="Total Paid"
                            value={`PKR ${linkedOrder.total?.toLocaleString() ?? '0'}`}
                            accent
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/60">
                        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                          Transaction Proof
                        </p>
                        {isImageURL(linkedOrder.transaction_ref) ? (
                          <a
                            href={linkedOrder.transaction_ref!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-1"
                          >
                            <img
                              src={linkedOrder.transaction_ref!}
                              alt="Party 2 Payment Proof"
                              className="w-16 h-16 object-cover rounded-lg border border-zinc-700 hover:border-orange-400 transition-colors"
                            />
                          </a>
                        ) : (
                          <p className="text-xs font-mono text-zinc-300 truncate bg-zinc-900 px-2.5 py-1.5 rounded border border-zinc-800">
                            {linkedOrder.transaction_ref || 'No Ref Attached'}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-xs text-zinc-500 italic">
                        Party 2 has not submitted payment / completed checkout yet.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </section>

            {/* Pickup Addresses */}
            <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-orange-400" />
                <h2 className="font-bold text-zinc-100 text-base">Pickup & Delivery Addresses</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Party 1 Address */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <p className="text-xs text-orange-400 uppercase tracking-wider font-bold">
                      Party 1
                    </p>
                    <span className="text-xs text-zinc-400 font-mono">
                      @{(order.from_profile as { username?: string })?.username ?? '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    <Field label="Full Name" value={order.delivery_name} />
                    <Field label="Phone" value={order.delivery_phone} />
                    <Field label="City" value={order.delivery_city} />
                    <Field label="Address" value={order.delivery_address} />
                  </div>
                </div>

                {/* Party 2 Address */}
                <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <p className="text-xs text-blue-400 uppercase tracking-wider font-bold">
                      Party 2
                    </p>
                    {linkedOrder && (
                      <span className="text-xs text-zinc-400 font-mono">
                        @{(linkedOrder.from_profile as { username?: string })?.username ?? '—'}
                      </span>
                    )}
                  </div>
                  {linkedOrder ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      <Field label="Full Name" value={linkedOrder.delivery_name} />
                      <Field label="Phone" value={linkedOrder.delivery_phone} />
                      <Field label="City" value={linkedOrder.delivery_city} />
                      <Field label="Address" value={linkedOrder.delivery_address} />
                      <div className="pt-2 border-t border-zinc-800/60 mt-1">
                        <Link
                          href={`/orders/${linkedOrder.id}`}
                          className="text-xs font-semibold text-orange-400 hover:text-orange-300 hover:underline inline-flex items-center gap-1 transition-colors"
                        >
                          View Linked Order →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-xs text-zinc-500 italic">
                        Other party has not completed checkout yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Tracking Info */}
            {order.tracking_number && (
              <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-orange-400" />
                  <h2 className="font-bold text-zinc-100 text-base">Tracking Information</h2>
                </div>
                <div className="bg-zinc-900/60 border border-zinc-800/50 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Tracking Number:</span>
                  <span className="font-mono text-sm font-bold text-orange-400">
                    {order.tracking_number}
                  </span>
                </div>
              </section>
            )}
          </div>

          {/* ── Right Column (Parties & Admin Actions) ── */}
          <div className="space-y-6">

            {/* Parties Info Card */}
            <section className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-orange-400" />
                <h2 className="font-bold text-zinc-100 text-base">Party Overview</h2>
              </div>

              <div className="space-y-4 divide-y divide-zinc-800/60">
                <div className="pt-1">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                    From (Sender)
                  </p>
                  <p className="font-semibold text-sm text-zinc-100">
                    @{(order.from_profile as { username?: string })?.username ?? '—'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(order.from_profile as { full_name?: string })?.full_name || 'N/A'}
                  </p>
                </div>

                <div className="pt-3">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">
                    To (Receiver)
                  </p>
                  <p className="font-semibold text-sm text-zinc-100">
                    @{(order.to_profile as { username?: string })?.username ?? '—'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(order.to_profile as { full_name?: string })?.full_name || 'N/A'}
                  </p>
                </div>
              </div>
            </section>

            {/* Interactive Client Component Actions */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <h2 className="font-bold text-zinc-100 text-base">Admin Controls</h2>
              </div>
              <OrderDetailActions
                order={order}
                onUpdateStatus={updateOrderStatus}
                onAssignDelivery={assignDeliveryType}
                onCancel={cancelOrder}
              />
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}