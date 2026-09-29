'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import type { SwapRow, OrderStatus } from '@/lib/types'
import {
  Search,
  AlertTriangle,
  ArrowRightLeft,
  Package,
  ChevronRight,
  Filter,
  Calendar,
  User,
  Banknote,
  ArrowRight
} from 'lucide-react'

interface Props {
  swaps: SwapRow[]
}

const FILTERS = [
  { value: 'all', label: 'All Swaps' },
  { value: 'payment_verification', label: 'Payment Pending' },
  { value: 'product_verification', label: 'Item Verification' },
  { value: 'item_verification', label: 'Item Checked' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

function swapNumber(swapId: string): string {
  return swapId.replaceAll('-', '').slice(0, 6).toUpperCase()
}

export default function SwapsClient({ swaps }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const unassigned = swaps.filter(s => {
    const needsDelivery = (o: SwapRow['party1Order']) =>
      o && o.status === 'item_verification' && !o.delivery_type
    return needsDelivery(s.party1Order) || needsDelivery(s.party2Order)
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return swaps.filter(s => {
      // Filter
      if (filter !== 'all') {
        const statuses = [s.party1Order?.status, s.party2Order?.status].filter(Boolean)
        if (!statuses.includes(filter as OrderStatus)) return false
      }

      // Search
      if (!q) return true
      const swapNo = swapNumber(s.swapId).toLowerCase()
      const fields = [
        s.sender.username, s.sender.full_name, s.sender.phone ?? '',
        s.receiver.username, s.receiver.full_name, s.receiver.phone ?? '',
        s.party1Order?.transaction_ref ?? '',
        s.party2Order?.transaction_ref ?? '',
        s.party1Order?.tracking_number ?? '',
        s.party2Order?.tracking_number ?? '',
        swapNo,
      ]
      return fields.some(f => f.toLowerCase().includes(q))
    })
  }, [swaps, search, filter])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Alert Banner */}
      {unassigned.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5 text-amber-400 backdrop-blur-sm">
          <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm sm:text-base text-amber-300">Action Required</h4>
            <p className="text-xs sm:text-sm text-amber-400/80">
              {unassigned.length} svap{unassigned.length > 1 ? 's' : ''} awaiting delivery partner assignment
            </p>
          </div>
        </div>
      )}

      {/* Top Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-zinc-900/80 p-3 sm:p-4 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search username, phone, tracking ref, svap ID..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/50 transition-all"
          />
        </div>

        <div className="relative shrink-0">
          <Filter className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full md:w-auto bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-8 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer"
          >
            {FILTERS.map(f => (
              <option key={f.value} value={f.value} className="bg-zinc-950 text-zinc-200">
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards List / Grid */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl py-16 px-4 text-center">
          <p className="text-zinc-400 font-medium text-base">No svaps match your criteria.</p>
          <p className="text-zinc-600 text-xs sm:text-sm mt-1">Try resetting search parameters or filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(s => {
            const offered = s.offeredProduct
            const requested = s.requestedProduct
            const offeredImg = offered?.image_urls?.[0]
            const requestedImg = requested?.image_urls?.[0]
            const isCashOnly = !offered

            return (
              <Link
                key={s.swapId}
                href={`/swaps/${s.swapId}`}
                className="group block bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-orange-500/5"
              >
                {/* Header: Swap ID, Date, & Arrow */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xs sm:text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg">
                      #{swapNumber(s.swapId)}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-orange-400 transition-colors">
                    <span>View Svap</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Body: 2 Main Parties Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Party 1 (Sender / Offered) */}
                  <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isCashOnly ? (
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                          <Banknote className="w-6 h-6" />
                        </div>
                      ) : offeredImg ? (
                        <img src={offeredImg} className="w-12 h-12 rounded-xl object-cover border border-zinc-700/80 shrink-0 shadow-sm" alt="" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-zinc-500" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
                          <User className="w-3 h-3 text-zinc-500" />
                          <span className="text-zinc-200 font-semibold truncate">@{s.sender.username}</span>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">
                          {isCashOnly ? `PKR ${s.premiumAmount.toLocaleString()}` : (offered?.title ?? '—')}
                        </p>
                        {!isCashOnly && s.premiumAmount > 0 && (
                          <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                            + PKR {s.premiumAmount.toLocaleString()} cash
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {s.party1Order ? (
                        <StatusBadge status={s.party1Order.status} />
                      ) : (
                        <span className="inline-block px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-zinc-700/60 whitespace-nowrap">
                          Not checked out
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Party 2 (Receiver / Requested) */}
                  <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {requestedImg ? (
                        <img src={requestedImg} className="w-12 h-12 rounded-xl object-cover border border-zinc-700/80 shrink-0 shadow-sm" alt="" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-zinc-500" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
                          <User className="w-3 h-3 text-zinc-500" />
                          <span className="text-zinc-200 font-semibold truncate">@{s.receiver.username}</span>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">
                          {requested?.title ?? '—'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {s.party2Order ? (
                        <StatusBadge status={s.party2Order.status} />
                      ) : (
                        <span className="inline-block px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-zinc-700/60 whitespace-nowrap">
                          Not checked out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}