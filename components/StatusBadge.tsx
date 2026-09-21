import type { OrderStatus } from '@/lib/types'

const config: Record<OrderStatus, { label: string; className: string }> = {
  pending_verification: { label: 'Pending Verification', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  confirmed:            { label: 'Confirmed',            className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  shipped:              { label: 'Shipped',              className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  delivered:            { label: 'Delivered',            className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled:            { label: 'Cancelled',            className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const c = config[status] ?? { label: status, className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.className}`}>
      {c.label}
    </span>
  )
}
