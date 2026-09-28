'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Order, OrderStatus } from '@/lib/types'

interface Props {
  order: Order
  onUpdateStatus: (id: string, status: OrderStatus, trackingNumber?: string) => Promise<void>
  onAssignDelivery: (id: string, type: 'courier' | 'self') => Promise<void>
  onSaveAdminNote: (id: string, note: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
}

export default function OrderDetailActions({ order, onUpdateStatus, onAssignDelivery, onSaveAdminNote, onCancel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adminNote, setAdminNote] = useState(order.admin_notes ?? '')
  const [noteSaved, setNoteSaved] = useState(false)

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      router.refresh()
    })
  }

  function saveNote() {
    startTransition(async () => {
      await onSaveAdminNote(order.id, adminNote)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
      router.refresh()
    })
  }

  const noActions = ['cancelled', 'delivered'].includes(order.status)

  return (
    <div className="space-y-3">
      {isPending && (
        <p className="text-xs text-orange-400 font-medium animate-pulse text-center">Saving…</p>
      )}

      {/* ── Step 1: Payment Verification ─────────────────────────── */}
      {order.status === 'payment_verification' && (
        <>
          <button
            disabled={isPending}
            onClick={() => run(() => onUpdateStatus(order.id, 'product_verification'))}
            className="w-full py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
          >
            ✓ Approve Payment
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm('Reject this payment? Order will be cancelled.'))
                run(() => onUpdateStatus(order.id, 'cancelled'))
            }}
            className="w-full py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            ✕ Reject Payment
          </button>
        </>
      )}

      {/* ── Step 2: Product Verification → assign delivery ──────── */}
      {order.status === 'product_verification' && !order.delivery_type && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 text-center font-medium">Assign delivery method to proceed</p>
          <button
            disabled={isPending}
            onClick={() => run(() => onAssignDelivery(order.id, 'courier'))}
            className="w-full py-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-sm font-semibold hover:bg-blue-500/25 transition-colors disabled:opacity-50"
          >
            🚚 Assign Courier
          </button>
          <button
            disabled={isPending}
            onClick={() => run(() => onAssignDelivery(order.id, 'self'))}
            className="w-full py-2.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 text-sm font-semibold hover:bg-orange-500/25 transition-colors disabled:opacity-50"
          >
            🏍️ Self Delivery
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm('Reject this order? It will be cancelled.'))
                run(() => onUpdateStatus(order.id, 'cancelled'))
            }}
            className="w-full py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            ✕ Reject Order
          </button>
        </div>
      )}

      {/* ── Step 2b: Delivery assigned → move to item_verification ─ */}
      {order.status === 'product_verification' && order.delivery_type && (
        <div className="space-y-2">
          <div className={`rounded-lg px-4 py-2 text-center text-sm font-semibold ${
            order.delivery_type === 'courier'
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
          }`}>
            {order.delivery_type === 'courier' ? '🚚 Courier Assigned' : '🏍️ Self Delivery'}
          </div>
          <button
            disabled={isPending}
            onClick={() => run(() => onUpdateStatus(order.id, 'item_verification'))}
            className="w-full py-2.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-sm font-semibold hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            🔍 Start Item Verification
          </button>
          <button
            disabled={isPending}
            onClick={() => run(() => onAssignDelivery(order.id, order.delivery_type === 'courier' ? 'self' : 'courier'))}
            className="w-full py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Switch to {order.delivery_type === 'courier' ? 'Self Delivery' : 'Courier'}
          </button>
        </div>
      )}

      {/* ── Step 3: Item Verification → shipped ─────────────────── */}
      {order.status === 'item_verification' && (
        <div className="space-y-2">
          <div className="rounded-lg px-4 py-2 text-center text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            🔍 Item is being inspected before shipping
          </div>
          <button
            disabled={isPending}
            onClick={() => {
              const num = prompt('Tracking number (leave blank to skip):') ?? ''
              run(() => onUpdateStatus(order.id, 'shipped', num || undefined))
            }}
            className="w-full py-2.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-sm font-semibold hover:bg-purple-500/25 transition-colors disabled:opacity-50"
          >
             Mark as Shipped
          </button>
        </div>
      )}

      {/* ── Step 4: Shipped → delivered ─────────────────────────── */}
      {order.status === 'shipped' && (
        <button
          disabled={isPending}
          onClick={() => run(() => onUpdateStatus(order.id, 'delivered'))}
          className="w-full py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
        >
          ✓ Mark as Delivered
        </button>
      )}

      {/* ── Cancel (any non-final status) ───────────────────────── */}
      {!['cancelled', 'delivered'].includes(order.status) && (
        <button
          disabled={isPending}
          onClick={() => {
            if (confirm('Cancel this order? Both sides will be cancelled and items restored.'))
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

      {/* ── Admin Notes ──────────────────────────────────────────── */}
      <div className="pt-4 border-t border-zinc-800 space-y-2">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Notes</p>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Add internal notes for this order…"
          rows={3}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
        />
        <button
          disabled={isPending}
          onClick={saveNote}
          className="w-full py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {noteSaved ? '✓ Saved' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}
