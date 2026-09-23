'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Order, OrderStatus } from '@/lib/types'

interface Props {
  order: Order
  onUpdateStatus: (id: string, status: OrderStatus, trackingNumber?: string) => Promise<void>
  onAssignDelivery: (id: string, type: 'courier' | 'self') => Promise<void>
  onCancel: (id: string) => Promise<void>
}

export default function OrderDetailActions({ order, onUpdateStatus, onAssignDelivery, onCancel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  const noActions = !['pending_verification', 'confirmed', 'shipped'].includes(order.status)

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
      <h2 className="font-bold text-zinc-100 mb-1">
        Actions
        {isPending && <span className="ml-2 text-xs text-zinc-500 font-normal animate-pulse">Saving…</span>}
      </h2>

      {order.status === 'pending_verification' && (
        <>
          <button
            disabled={isPending}
            onClick={() => run(() => onUpdateStatus(order.id, 'confirmed'))}
            className="w-full py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
          >
            ✓ Approve Payment
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm('Reject this payment? Status will be set to cancelled.'))
                run(() => onUpdateStatus(order.id, 'cancelled'))
            }}
            className="w-full py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            ✕ Reject Payment
          </button>
        </>
      )}

      {order.status === 'confirmed' && !order.delivery_type && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 text-center">Assign delivery method first</p>
          <button
            disabled={isPending}
            onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
            className="w-full py-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-sm font-semibold hover:bg-blue-500/25 transition-colors disabled:opacity-50"
          >
            🚚 Assign to Courier Company
          </button>
          <button
            disabled={isPending}
            onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
            className="w-full py-2.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 text-sm font-semibold hover:bg-orange-500/25 transition-colors disabled:opacity-50"
          >
            🏍️ Self Deliver
          </button>
        </div>
      )}

      {order.status === 'confirmed' && order.delivery_type && (
        <div className="space-y-2">
          <div
            className={`rounded-lg px-4 py-2 text-center text-sm font-semibold ${
              order.delivery_type === 'courier'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
            }`}
          >
            {order.delivery_type === 'courier' ? '🚚 Assigned to Courier' : '🏍️ Self Delivery'}
          </div>
          <button
            disabled={isPending}
            onClick={() => {
              const num = prompt('Tracking number (leave blank to skip):') ?? ''
              run(() => onUpdateStatus(order.id, 'shipped', num || undefined))
            }}
            className="w-full py-2.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-sm font-semibold hover:bg-purple-500/25 transition-colors disabled:opacity-50"
          >
            📦 Mark as Shipped
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              run(() =>
                onAssignDelivery(order.id, order.delivery_type === 'courier' ? 'self' : 'courier'),
              )
            }
            className="w-full py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Switch to {order.delivery_type === 'courier' ? 'Self Delivery' : 'Courier'}
          </button>
        </div>
      )}

      {order.status === 'shipped' && (
        <button
          disabled={isPending}
          onClick={() => run(() => onUpdateStatus(order.id, 'delivered'))}
          className="w-full py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
        >
          ✓ Mark as Delivered
        </button>
      )}

      {!['cancelled', 'delivered'].includes(order.status) && (
        <button
          disabled={isPending}
          onClick={() => {
            if (confirm('Kya aap yeh order cancel karna chahte hain? Dono taraf ke orders cancel ho jayenge.'))
              run(() => onCancel(order.id))
          }}
          className="w-full py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
        >
          Cancel Order &amp; Restore Items
        </button>
      )}

      {noActions && (
        <p className="text-zinc-500 text-xs text-center">No actions available for this status.</p>
      )}
    </section>
  )
}
