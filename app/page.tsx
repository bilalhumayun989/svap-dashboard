'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import StatusBadge from '@/components/StatusBadge'
import type { OrderStatus } from '@/lib/types'
import { 
  ShoppingBag, 
  Users, 
  Tag, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react'

interface Stats {
  pendingVerification: number
  totalOrders: number
  totalUsers: number
  activeProducts: number
  swappedProducts: number
  deliveredOrders: number
}

interface RecentOrder {
  id: string
  delivery_name: string
  delivery_city: string
  total: number
  status: string
  created_at: string
  from_profile?: { full_name?: string } | null
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    pendingVerification: 0,
    totalOrders: 0,
    totalUsers: 0,
    activeProducts: 0,
    swappedProducts: 0,
    deliveredOrders: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      fetchData()
    })
  }, [])

  async function fetchData() {
    try {
      // Direct count queries from Supabase DB to bypass local array filtering issues
      const [
        pendingRes,
        deliveredRes,
        totalOrdersRes,
        usersRes, 
        activeProdRes,
        swappedProdRes,
        recentOrdersRes
      ] = await Promise.all([
        // 1. Pending Verification Count (or pending)
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .ilike('status', 'pending%'),

        // 2. Delivered Orders Count
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'delivered'),

        // 3. Total Orders Count
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true }),

        // 4. Total Users Count
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true }),

        // 5. Active Products Count
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),

        // 6. Swapped Products Count
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'swapped'),

        // 7. Recent Orders List
        supabase
          .from('orders')
          .select(`
            id,
            delivery_name,
            delivery_city,
            total,
            status,
            created_at,
            from_profile:profiles!orders_from_user_id_fkey(full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(6)
      ])

      setStats({
        pendingVerification: pendingRes.count ?? 0,
        totalOrders: totalOrdersRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        activeProducts: activeProdRes.count ?? 0,
        swappedProducts: swappedProdRes.count ?? 0,
        deliveredOrders: deliveredRes.count ?? 0,
      })

      setRecentOrders((recentOrdersRes.data as unknown as RecentOrder[]) ?? [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3 min-h-screen">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium tracking-wide text-zinc-400">Loading SVAP Panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-zinc-100">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 md:px-8 pt-20 md:pt-8 pb-10 overflow-y-auto w-full max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
              Overview of SVAP swap marketplace activity & statistics
            </p>
          </div>
        </div>

        {/* Responsive Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/orders?status=pending_verification" className="block group">
            <div className="p-4 sm:p-5 rounded-xl bg-zinc-950 border border-orange-500/40 group-hover:border-orange-500 bg-gradient-to-b from-orange-500/10 to-transparent transition-all shadow-lg">
              <div className="flex items-center justify-between text-orange-400 mb-2">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Awaiting Verification</span>
                <AlertCircle className="w-4 h-4 animate-pulse shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.pendingVerification}</p>
              <p className="text-[11px] sm:text-xs text-orange-400/80 mt-1.5 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Click to verify bank transfers <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          </Link>

          <div className="p-4 sm:p-5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Total Orders</span>
              <ShoppingBag className="w-4 h-4 shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-white">{stats.totalOrders}</p>
            <p className="text-[11px] sm:text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {stats.deliveredOrders} Delivered
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-white">{stats.totalUsers}</p>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1.5">Registered platform accounts</p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Active Listings</span>
              <Tag className="w-4 h-4 shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-white">{stats.activeProducts}</p>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1.5">{stats.swappedProducts} already swapped</p>
          </div>
        </div>

        {/* Activity Overview Container */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h2 className="font-bold text-white text-xs sm:text-sm">Recent Platform Activity</h2>
            </div>
            <Link 
              href="/orders" 
              className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 transition-colors"
            >
              View all orders <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500 text-sm">
              No recent orders found.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs sm:text-sm text-left min-w-[650px]">
                <thead>
                  <tr className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider border-b border-zinc-800 bg-black/40">
                    <th className="px-4 sm:px-6 py-3.5">Customer / Recipient</th>
                    <th className="px-4 sm:px-6 py-3.5">City</th>
                    <th className="px-4 sm:px-6 py-3.5">Total Amount</th>
                    <th className="px-4 sm:px-6 py-3.5">Status</th>
                    <th className="px-4 sm:px-6 py-3.5">Date</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 whitespace-nowrap">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-medium text-zinc-200">
                        {order.from_profile?.full_name || order.delivery_name || 'Guest User'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-zinc-400">{order.delivery_city}</td>
                      <td className="px-4 sm:px-6 py-4 text-white font-bold">
                        PKR {order.total?.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <StatusBadge status={order.status as OrderStatus} />
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-zinc-500 text-[11px] sm:text-xs">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <Link 
                          href={`/orders/${order.id}`} 
                          className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                        >
                          Details <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}