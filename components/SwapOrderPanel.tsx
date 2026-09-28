'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import type { SwapPartyOrder, SwapPartyProfile } from '@/lib/types'
import {
  Truck,
  Bike,
  Check,
  X,
  Search,
  PackageCheck,
  Save,
  User,
  Phone,
  MapPin,
  Receipt,
  ExternalLink,
  Clock,
  ArrowRightLeft
} from 'lucide-react'

interface Props {
  party: 'Party 1 (Sender)' | 'Party 2 (Receiver)'
  profile: SwapPartyProfile
  order: SwapPartyOrder | null // null = not checked out yet
  // Server Actions — all scoped to this order's id only
  onApprovePayment: (id: string) => Promise<void>
  onRejectPayment: (id: string) => Promise<void>
  onVerifyItem: (id: string) => Promise<void>
  onAssignDelivery: (id: string, type: 'courier' | 'self') => Promise<void>
  onMarkShipped: (id: string, trackingNumber: string | null) => Promise<void>
  onMarkDelivered: (id: string) => Promise<void>
  onSaveAdminNote: (id: string, note: string) => Promise<void>
}

function isImageURL(url?: string | null) {
  if (!url) return false
  return (
    url.startsWith('http') &&
    (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url) ||
      url.includes('/storage/v1/object/'))
  )
}

function DeliveryBadge({ type }: { type: 'courier' | 'self' | null }) {
  if (!type) return null
  return type === 'courier' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Truck className="w-3.5 h-3.5" /> Courier
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
      <Bike className="w-3.5 h-3.5" /> Self Delivery
    </span>
  )
}

export default function SwapOrderPanel({
  party,
  profile,
  order,
  onApprovePayment,
  onRejectPayment,
  onVerifyItem,
  onAssignDelivery,
  onMarkShipped,
  onMarkDelivered,
  onSaveAdminNote,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adminNote, setAdminNote] = useState(order?.admin_notes ?? '')
  const [noteSaved, setNoteSaved] = useState(false)

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  function saveNote() {
    if (!order) return
    startTransition(async () => {
      await onSaveAdminNote(order.id, adminNote)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
      router.refresh()
    })
  }

  const isP1 = party === 'Party 1 (Sender)'
  const badgeColor = isP1
    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-5 space-y-5 shadow-xl">
      {/* Header Profile Section */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1">
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}
          >
            {party}
          </span>
          <h3 className="font-bold text-zinc-100 text-base flex items-center gap-1.5">
            <User className="w-4 h-4 text-zinc-400" />
            @{profile.username}
          </h3>
          <p className="text-xs text-zinc-400">{profile.full_name}</p>
          {profile.phone && (
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <Phone className="w-3 h-3 text-zinc-500" />
              {profile.phone}
            </p>
          )}
        </div>
        {order && <StatusBadge status={order.status} />}
      </div>

      {/* Not checked out state */}
      {!order && (
        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-6 text-center space-y-2">
          <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 w-fit mx-auto">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-zinc-300 text-xs font-semibold">Waiting for checkout</p>
          <p className="text-zinc-500 text-[11px]">
            This party has not placed their order yet.
          </p>
        </div>
      )}

      {order && (
        <>
          {/* Delivery info */}
          <div className="bg-zinc-950/50 rounded-xl p-3.5 border border-zinc-800/60 space-y-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-zinc-400" />
              Delivery Destination
            </p>
            <div className="space-y-0.5 text-xs">
              <p className="text-zinc-200 font-semibold">{order.delivery_name}</p>
              <p className="text-zinc-400">{order.delivery_phone}</p>
              <p className="text-zinc-400">
                {order.delivery_city}
                {order.delivery_address ? ` — ${order.delivery_address}` : ''}
              </p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-xs bg-zinc-950/50 border border-zinc-800/60 rounded-xl p-3">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Shipping</p>
              <p className="text-zinc-200 font-bold mt-0.5">
                PKR {order.shipping_cost.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Boost</p>
              <p className="text-zinc-200 font-bold mt-0.5">
                PKR {order.premium_amount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">Total</p>
              <p className="text-orange-400 font-bold mt-0.5">
                PKR {order.total.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Transaction Proof */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3 text-zinc-400" />
              Payment Proof
            </p>
            {isImageURL(order.transaction_ref) ? (
              <a
                href={order.transaction_ref!}
                target="_blank"
                rel="noreferrer"
                className="inline-block relative group"
              >
                <img
                  src={order.transaction_ref!}
                  className="w-20 h-20 object-cover rounded-xl border border-zinc-700/80 group-hover:border-orange-500 transition-colors shadow-sm"
                  alt="Payment proof"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                  <ExternalLink className="w-4 h-4 text-white" />
                </div>
              </a>
            ) : (
              <p className="text-xs font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl truncate">
                {order.transaction_ref || 'No proof attached'}
              </p>
            )}
          </div>

          {/* Delivery type + tracking */}
          {(order.delivery_type || order.tracking_number) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <DeliveryBadge type={order.delivery_type} />
              {order.tracking_number && (
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-md">
                  #{order.tracking_number}
                </span>
              )}
            </div>
          )}

          {/* Action Loading Indicator */}
          {isPending && (
            <div className="py-1 text-center">
              <p className="text-xs text-orange-400 animate-pulse font-medium">
                Processing action…
              </p>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="space-y-2 pt-1">
            {/* Step 1: payment_verification */}
            {order.status === 'payment_verification' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  disabled={isPending}
                  onClick={() => run(() => onApprovePayment(order.id))}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Approve Payment
                </button>
                <button
                  disabled={isPending}
                  onClick={() => {
                    if (confirm('Reject this payment? Order will be cancelled.'))
                      run(() => onRejectPayment(order.id))
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/25 transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Reject Payment
                </button>
              </div>
            )}

            {/* Step 2: product_verification */}
            {order.status === 'product_verification' && (
              <button
                disabled={isPending}
                onClick={() => run(() => onVerifyItem(order.id))}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-500/25 transition-all disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> Verify Item
              </button>
            )}

            {/* Step 3: item_verification -> assign delivery */}
            {order.status === 'item_verification' && !order.delivery_type && (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400 text-center font-medium">
                  Assign delivery method to proceed
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isPending}
                    onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-500/25 transition-all disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4" /> Courier
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/25 transition-all disabled:opacity-50"
                  >
                    <Bike className="w-4 h-4" /> Self
                  </button>
                </div>
              </div>
            )}

            {/* Step 3b: delivery assigned -> mark shipped */}
            {order.status === 'item_verification' && order.delivery_type && (
              <div className="space-y-2">
                <div
                  className={`rounded-xl px-3 py-2 text-center text-xs font-semibold flex items-center justify-center gap-1.5 ${
                    order.delivery_type === 'courier'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  }`}
                >
                  {order.delivery_type === 'courier' ? (
                    <>
                      <Truck className="w-4 h-4" /> Courier Assigned
                    </>
                  ) : (
                    <>
                      <Bike className="w-4 h-4" /> Self Delivery Assigned
                    </>
                  )}
                </div>
                <button
                  disabled={isPending}
                  onClick={() => {
                    const num = prompt('Tracking number (optional):') ?? ''
                    run(() => onMarkShipped(order.id, num || null))
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/25 transition-all disabled:opacity-50"
                >
                  <PackageCheck className="w-4 h-4" /> Mark as Shipped
                </button>
                <button
                  disabled={isPending}
                  onClick={() =>
                    run(() =>
                      onAssignDelivery(
                        order.id,
                        order.delivery_type === 'courier' ? 'self' : 'courier'
                      )
                    )
                  }
                  className="w-full inline-flex items-center justify-center gap-1 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Switch to{' '}
                  {order.delivery_type === 'courier' ? 'Self Delivery' : 'Courier'}
                </button>
              </div>
            )}

            {/* Step 4: shipped -> delivered */}
            {order.status === 'shipped' && (
              <button
                disabled={isPending}
                onClick={() => run(() => onMarkDelivered(order.id))}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Mark as Delivered
              </button>
            )}

            {['delivered', 'cancelled'].includes(order.status) && (
              <p className="text-zinc-500 text-xs text-center py-1">
                No further actions available.
              </p>
            )}
          </div>

          {/* Admin Notes */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Admin Notes Save only in Database.
            </p>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Internal notes for this order…"
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/80 transition-all resize-none"
            />
            <button
              disabled={isPending}
              onClick={saveNote}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {noteSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Saved
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Note
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}