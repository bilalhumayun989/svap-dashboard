'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'
import type { Order, OrderStatus } from '@/lib/types'
import {
  Truck,
  Bike,
  AlertTriangle,
  Eye,
  Search,
  Loader2,
  Calendar,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Ban
} from 'lucide-react'

interface OrdersClientProps {
  orders: Order[]
  initialStatus: string
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onAssignDelivery: (id: string, type: 'courier' | 'self') => Promise<void>
  onMarkShipped: (id: string, trackingNumber: string | null) => Promise<void>
  onMarkDelivered: (id: string) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

function DeliveryTypeBadge({ type }: { type: 'courier' | 'self' | null }) {
  if (!type) return <span className="text-zinc-600 text-xs font-mono">—</span>
  if (type === 'courier') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
        <Truck className="w-3.5 h-3.5 shrink-0" />
        Courier
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 whitespace-nowrap">
      <Bike className="w-3.5 h-3.5 shrink-0" />
      Self
    </span>
  )
}

function isImageTransactionRef(value: string | null | undefined) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false
  const noQuery = trimmed.split('?')[0].toLowerCase()
  return (
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)(?:#.*)?$/i.test(noQuery) ||
    noQuery.includes('/storage/v1/object/')
  )
}

export default function OrdersClient({
  orders,
  initialStatus,
  onApprove,
  onReject,
  onCancel,
  onAssignDelivery,
  onMarkShipped,
  onMarkDelivered,
}: OrdersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlStatus = searchParams.get('status') || initialStatus
  const [statusFilter, setStatusFilter] = useState(urlStatus)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (searchParams.get('status')) {
      setStatusFilter(searchParams.get('status')!)
    }
  }, [searchParams])

  const filtered = orders.filter((o) => {
    const orderStatusNormalized = (o.status || '').toLowerCase().trim()
    const targetFilterNormalized = statusFilter.toLowerCase().trim()

    const matchStatus =
      targetFilterNormalized === 'all' ||
      orderStatusNormalized === targetFilterNormalized

    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      (o.delivery_name || '').toLowerCase().includes(q) ||
      (o.transaction_ref || '').toLowerCase().includes(q) ||
      (o.tracking_number || '').toLowerCase().includes(q)

    return matchStatus && matchSearch
  })

  const unassigned = orders.filter(
    (o) => (o.status || '').toLowerCase().trim() === 'confirmed' && !o.delivery_type,
  )

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    const params = new URLSearchParams(searchParams.toString())
    if (newStatus === 'all') {
      params.delete('status')
    } else {
      params.set('status', newStatus)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden bg-black text-zinc-100 space-y-4 font-sans p-2 sm:p-4">
      {/* Alert banner */}
      {unassigned.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-amber-400 font-semibold text-xs sm:text-sm truncate">
              {unassigned.length} order{unassigned.length > 1 ? 's' : ''} awaiting delivery partner assignment
            </p>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-950 p-3 sm:p-4 rounded-xl border border-zinc-800/80">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Client Name, Ref, Tracking..."
              className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500/80 transition-colors cursor-pointer shrink-0"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-950 text-zinc-100">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isPending && (
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-orange-400 font-medium shrink-0 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden w-full">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            No orders matching criteria.
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View (Visible >= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-400 font-medium uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-3">City</th>
                    <th className="py-3 px-3">Txn Ref</th>
                    <th className="py-3 px-3">Total</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Delivery</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {filtered.map((order) => {
                    const isImageRef = isImageTransactionRef(order.transaction_ref)

                    return (
                      <tr key={order.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-4 px-4 align-middle">
                          <div className="space-y-0.5">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-bold text-zinc-100 hover:text-orange-400 transition-colors text-sm block truncate max-w-[160px]"
                              title={order.delivery_name || 'Guest User'}
                            >
                              {order.delivery_name || 'Guest User'}
                            </Link>
                            <div className="text-xs text-zinc-400 truncate">
                              {order.delivery_phone || 'N/A'}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-3 align-middle text-zinc-300 text-xs truncate">
                          {order.delivery_city || 'N/A'}
                        </td>

                        <td className="py-4 px-3 align-middle">
                          {isImageRef ? (
                            <a
                              href={order.transaction_ref!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-md overflow-hidden border border-zinc-700 hover:border-orange-500 transition-colors shrink-0"
                              title="View Payment Proof"
                            >
                              <img
                                src={order.transaction_ref!}
                                alt="Txn Proof"
                                className="w-10 h-10 object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400 truncate block font-mono max-w-[100px]">
                              {order.transaction_ref || 'N/A'}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-3 align-middle font-bold text-orange-400 text-sm whitespace-nowrap">
                          PKR {order.total?.toLocaleString()}
                        </td>

                        <td className="py-4 px-3 align-middle">
                          <div className="inline-block whitespace-nowrap">
                            <StatusBadge status={order.status as OrderStatus} />
                          </div>
                        </td>

                        <td className="py-4 px-3 align-middle">
                          <DeliveryTypeBadge type={order.delivery_type} />
                        </td>

                        <td className="py-4 px-3 align-middle text-xs text-zinc-400 whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-4 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {order.status === 'pending_verification' && (
                              <>
                                <button
                                  disabled={isPending}
                                  onClick={() => run(() => onApprove(order.id))}
                                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500 hover:text-black transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  disabled={isPending}
                                  onClick={() => {
                                    if (confirm('Reject this order?')) run(() => onReject(order.id))
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500 hover:text-white transition-all"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {order.status === 'confirmed' && !order.delivery_type && (
                              <>
                                <button
                                  disabled={isPending}
                                  onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
                                  className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-500 hover:text-white transition-all"
                                >
                                  Courier
                                </button>
                                <button
                                  disabled={isPending}
                                  onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
                                  className="px-2.5 py-1 text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-md hover:bg-orange-500 hover:text-black transition-all"
                                >
                                  Self
                                </button>
                              </>
                            )}

                            {order.status === 'confirmed' && order.delivery_type && (
                              <button
                                disabled={isPending}
                                onClick={() => {
                                  const num = prompt('Enter tracking number (optional):') ?? ''
                                  run(() => onMarkShipped(order.id, num || null))
                                }}
                                className="px-2.5 py-1 text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-md hover:bg-purple-500 hover:text-white transition-all"
                              >
                                Ship
                              </button>
                            )}

                            {order.status === 'shipped' && (
                              <button
                                disabled={isPending}
                                onClick={() => run(() => onMarkDelivered(order.id))}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500 hover:text-black transition-all"
                              >
                                Deliver
                              </button>
                            )}

                            {!['cancelled', 'delivered'].includes(order.status) && (
                              <button
                                disabled={isPending}
                                onClick={() => {
                                  if (confirm('Cancel this order and restore items?')) run(() => onCancel(order.id))
                                }}
                                className="px-2.5 py-1 text-xs font-medium bg-red-950/40 text-red-400 border border-red-800/40 rounded-md hover:bg-red-900/60 transition-all"
                              >
                                Cancel Order
                              </button>
                            )}

                            <Link
                              href={`/orders/${order.id}`}
                              className="px-2.5 py-1 text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-md transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Card View (Visible < lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 lg:hidden">
              {filtered.map((order) => {
                const isImageRef = isImageTransactionRef(order.transaction_ref)

                return (
                  <div
                    key={order.id}
                    className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3.5 space-y-3 flex flex-col justify-between"
                  >
                    {/* Header: Customer info & Total */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-800/60">
                      <div>
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-bold text-zinc-100 hover:text-orange-400 text-sm block"
                        >
                          {order.delivery_name || 'Guest User'}
                        </Link>
                        <p className="text-xs text-zinc-400 mt-0.5">{order.delivery_phone || 'N/A'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-orange-400 text-base">
                          PKR {order.total?.toLocaleString()}
                        </span>
                        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-1">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-medium">City</span>
                        <span className="text-zinc-300 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          {order.delivery_city || 'N/A'}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-medium">Delivery Type</span>
                        <div className="mt-0.5">
                          <DeliveryTypeBadge type={order.delivery_type} />
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center justify-between bg-black/40 border border-zinc-800/60 rounded-lg p-2 mt-1">
                        <div>
                          <span className="text-zinc-500 block text-[10px] uppercase font-medium">Status</span>
                          <div className="mt-1">
                            <StatusBadge status={order.status as OrderStatus} />
                          </div>
                        </div>

                        {/* Txn Proof */}
                        <div className="text-right">
                          <span className="text-zinc-500 block text-[10px] uppercase font-medium mb-1">Txn Ref</span>
                          {isImageRef ? (
                            <a
                              href={order.transaction_ref!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded overflow-hidden border border-zinc-700 shrink-0"
                            >
                              <img
                                src={order.transaction_ref!}
                                alt="Txn Proof"
                                className="w-8 h-8 object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-400 font-mono">
                              {order.transaction_ref || 'N/A'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                      {order.status === 'pending_verification' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            disabled={isPending}
                            onClick={() => run(() => onApprove(order.id))}
                            className="w-full py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (confirm('Reject this order?')) run(() => onReject(order.id))
                            }}
                            className="w-full py-2 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}

                      {order.status === 'confirmed' && !order.delivery_type && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            disabled={isPending}
                            onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
                            className="w-full py-2 text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-1"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Courier
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
                            className="w-full py-2 text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center gap-1"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            Self
                          </button>
                        </div>
                      )}

                      {order.status === 'confirmed' && order.delivery_type && (
                        <button
                          disabled={isPending}
                          onClick={() => {
                            const num = prompt('Enter tracking number (optional):') ?? ''
                            run(() => onMarkShipped(order.id, num || null))
                          }}
                          className="w-full py-2 text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Mark Shipped
                        </button>
                      )}

                      {order.status === 'shipped' && (
                        <button
                          disabled={isPending}
                          onClick={() => run(() => onMarkDelivered(order.id))}
                          className="w-full py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-1"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          Mark Delivered
                        </button>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {!['cancelled', 'delivered'].includes(order.status) && (
                          <button
                            disabled={isPending}
                            onClick={() => {
                              if (confirm('Cancel this order and restore items?')) run(() => onCancel(order.id))
                            }}
                            className="flex-1 py-1.5 text-xs font-medium bg-red-950/40 text-red-400 border border-red-800/40 rounded-lg hover:bg-red-900/60 transition-all flex items-center justify-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancel Order
                          </button>
                        )}

                        <Link
                          href={`/orders/${order.id}`}
                          className="flex-1 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Order
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}