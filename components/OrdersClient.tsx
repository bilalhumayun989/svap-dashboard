'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import type { Order, OrderStatus } from '@/lib/types'

// ─── Actions are passed as props from the Server Component ───────────────────
interface OrdersClientProps {
  orders: Order[]
  initialStatus: string
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  onAssignDelivery: (id: string, type: 'courier' | 'self') => Promise<void>
  onMarkShipped: (id: string, trackingNumber: string | null) => Promise<void>
  onMarkDelivered: (id: string) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'all',                  label: 'All Orders' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'confirmed',            label: 'Confirmed' },
  { value: 'shipped',              label: 'Shipped' },
  { value: 'delivered',            label: 'Delivered' },
  { value: 'cancelled',            label: 'Cancelled' },
]

function DeliveryTypeBadge({ type }: { type: 'courier' | 'self' | null }) {
  if (!type) return <span className="text-zinc-600 text-xs">—</span>
  if (type === 'courier')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-500/15 text-blue-400 border-blue-500/30">
        🚚 Courier
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-orange-500/15 text-orange-400 border-orange-500/30">
      🏍️ Self
    </span>
  )
}

function isImageTransactionRef(value: string | null | undefined) {
  if (!value) return false

  const trimmed = value.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false

  const noQuery = trimmed.split('?')[0].toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)(?:#.*)?$/i.test(noQuery)
    || noQuery.includes('/storage/v1/object/')
}

export default function OrdersClient({
  orders,
  initialStatus,
  onApprove,
  onReject,
  onAssignDelivery,
  onMarkShipped,
  onMarkDelivered,
}: OrdersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [search, setSearch] = useState('')

  // Client-side filter (no re-fetch needed for search/status)
  const filtered = orders.filter((o) => {
    const matchStatus =
      statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      o.delivery_name.toLowerCase().includes(q) ||
      (o.transaction_ref ?? '').toLowerCase().includes(q) ||
      (o.tracking_number ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const unassigned = orders.filter(
    (o) => o.status === 'confirmed' && !o.delivery_type,
  )

  // Helper: run a server action then refresh RSC tree
  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  return (
    <div>
      {/* Unassigned delivery alert */}
      {unassigned.length > 0 && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-amber-400 text-xl">⚠️</span>
          <div>
            <p className="text-amber-400 font-semibold text-sm">
              {unassigned.length} confirmed order{unassigned.length > 1 ? 's' : ''} awaiting delivery assignment
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Filter by &apos;Confirmed&apos; to assign courier or self-delivery
            </p>
          </div>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, txn ref, tracking…"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {isPending && (
          <span className="self-center text-xs text-zinc-500 animate-pulse">
            Updating…
          </span>
        )}
      </div>

      {/* Orders table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            No orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left px-6 py-3">Customer</th>
                  <th className="text-left px-6 py-3">City</th>
                  <th className="text-left px-3 py-3 w-[110px]">Txn Ref</th>
                  <th className="text-left px-6 py-3">Total</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Delivery</th>
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const txnRef = order.transaction_ref?.trim()
                  const isImageRef = isImageTransactionRef(txnRef ?? null)

                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors ${
                        order.status === 'confirmed' && !order.delivery_type
                          ? 'bg-amber-500/5'
                          : ''
                      }`}
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium hover:text-orange-400 transition-colors"
                        >
                          {order.delivery_name}
                        </Link>
                        <p className="text-xs text-zinc-500">{order.delivery_phone}</p>
                      </td>
                      <td className="px-6 py-3 text-zinc-400">{order.delivery_city}</td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center justify-start min-w-[72px]">
                          {txnRef ? (
                            isImageRef ? (
                              <a
                                href={txnRef}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 shadow-sm transition-colors hover:border-orange-500/60 hover:shadow-orange-500/10"
                                aria-label={`Open payment screenshot for ${order.delivery_name}`}
                              >
                                <img
                                  src={txnRef}
                                  alt="Payment screenshot"
                                  className="h-10 w-10 object-cover block"
                                  loading="lazy"
                                />
                              </a>
                            ) : (
                              <span className="font-mono text-[11px] text-zinc-300 break-all">{txnRef}</span>
                            )
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-orange-400 font-semibold">
                        PKR {order.total.toLocaleString()}
                      </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={order.status as OrderStatus} />
                    </td>
                    <td className="px-6 py-3">
                      <DeliveryTypeBadge type={order.delivery_type} />
                    </td>
                    <td className="px-6 py-3 text-zinc-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>

                    {/* ── Action buttons ── */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center flex-wrap">

                        {/* Step 1 — Verify payment */}
                        {order.status === 'pending_verification' && (
                          <>
                            <button
                              disabled={isPending}
                              onClick={() => run(() => onApprove(order.id))}
                              className="px-3 py-1 text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => {
                                if (confirm('Reject this order? Status will be set to cancelled.'))
                                  run(() => onReject(order.id))
                              }}
                              className="px-3 py-1 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Step 2 — Assign delivery */}
                        {order.status === 'confirmed' && !order.delivery_type && (
                          <>
                            <button
                              disabled={isPending}
                              onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
                              className="px-3 py-1 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                            >
                              🚚 Courier
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
                              className="px-3 py-1 text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/25 transition-colors disabled:opacity-50"
                            >
                              🏍️ Self
                            </button>
                          </>
                        )}

                        {/* Step 3 — Mark shipped */}
                        {order.status === 'confirmed' && order.delivery_type && (
                          <button
                            disabled={isPending}
                            onClick={() => {
                              const num = prompt('Enter tracking number (leave blank to skip):') ?? ''
                              run(() => onMarkShipped(order.id, num || null))
                            }}
                            className="px-3 py-1 text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/25 transition-colors disabled:opacity-50"
                          >
                            Mark Shipped
                          </button>
                        )}

                        {/* Step 4 — Mark delivered */}
                        {order.status === 'shipped' && (
                          <button
                            disabled={isPending}
                            onClick={() => run(() => onMarkDelivered(order.id))}
                            className="px-3 py-1 text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-50"
                          >
                            Mark Delivered
                          </button>
                        )}

                        <Link
                          href={`/orders/${order.id}`}
                          className="px-3 py-1 text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
