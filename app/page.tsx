'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'
import type { Order, OrderStatus } from '@/lib/types'

interface Stats {
  pendingVerification: number
  totalOrders: number
  totalUsers: number
  activeProducts: number
  swappedProducts: number
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ pendingVerification: 0, totalOrders: 0, totalUsers: 0, activeProducts: 0, swappedProducts: 0 })
  const [recentPending, setRecentPending] = useState<Order[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      fetchData()
    })
  }, [])

  async function fetchData() {
    try {
      const [ordersRes, usersRes, productsRes, pendingRes] = await Promise.all([
        supabase.from('orders').select('id, status', { count: 'exact', head: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: false }),
        supabase.from('products').select('id, status', { count: 'exact', head: false }),
        supabase.from('orders')
          .select('id, delivery_name, delivery_city, total, status, transaction_ref, created_at, from_user_id')
          .eq('status', 'pending_verification')
          .order('created_at', { ascending: true })
          .limit(5),
      ])

      const pendingCount = (ordersRes.data ?? []).filter((o: { status: string }) => o.status === 'pending_verification').length
      const allProducts = (productsRes.data ?? []) as { status: string }[]

      setStats({
        pendingVerification: pendingCount,
        totalOrders: ordersRes.data?.length ?? 0,
        totalUsers: usersRes.data?.length ?? 0,
        activeProducts: allProducts.filter(p => p.status === 'active').length,
        swappedProducts: allProducts.filter(p => p.status === 'swapped').length,
      })
      setRecentPending((pendingRes.data ?? []) as Order[])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-zinc-500">Loading…</div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-black text-zinc-100 mb-1">Dashboard</h1>
        <p className="text-zinc-500 text-sm mb-8">Overview of SVAP marketplace activity</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Pending Verification" value={stats.pendingVerification} sub="Awaiting payment confirmation" accent />
          <StatCard label="Total Orders" value={stats.totalOrders} />
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Active Listings" value={stats.activeProducts} sub={`${stats.swappedProducts} already swapped`} />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h2 className="font-bold text-zinc-100">Oldest Pending Verifications</h2>
            <Link href="/orders?status=pending_verification" className="text-xs text-orange-400 hover:underline">View all →</Link>
          </div>
          {recentPending.length === 0 ? (
            <div className="px-6 py-10 text-center text-zinc-500 text-sm">No pending verifications 🎉</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left px-6 py-3">Customer</th>
                  <th className="text-left px-6 py-3">City</th>
                  <th className="text-left px-6 py-3">Txn Ref</th>
                  <th className="text-left px-6 py-3">Total</th>
                  <th className="text-left px-6 py-3">Submitted</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentPending.map((order) => (
                  <tr key={order.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-3 font-medium">{order.delivery_name}</td>
                    <td className="px-6 py-3 text-zinc-400">{order.delivery_city}</td>
                    <td className="px-6 py-3 font-mono text-xs text-zinc-300">{order.transaction_ref ?? '—'}</td>
                    <td className="px-6 py-3 text-orange-400 font-semibold">PKR {order.total.toLocaleString()}</td>
                    <td className="px-6 py-3 text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <Link href={`/orders/${order.id}`} className="text-xs text-orange-400 hover:underline">Review →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
