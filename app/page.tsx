// Server Component — uses service_role key so RLS does not block counts.
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { adminApi } from '@/lib/backend'
import Link from 'next/link'
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
  ExternalLink,
} from 'lucide-react'

async function getSessionUser() {
  const cookieStore = await cookies()
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* read-only */ }
        },
      },
    },
  )
  const { data: { user } } = await serverClient.auth.getUser()
  return user
}

export default async function Dashboard() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const result = (await adminApi('/admin/dashboard')).data
  const stats = {
    pendingVerification: result.pendingVerification, totalOrders: result.totalOrders,
    totalUsers: result.totalUsers, activeProducts: result.activeProducts,
    swappedProducts: result.swappedProducts, deliveredOrders: result.deliveredOrders,
  }
  interface RecentOrder { id:string; swap_request_id:string; delivery_name:string; delivery_city:string; total:number; status:string; created_at:string; from_profile?:{full_name?:string}|null }
  const recentOrders = result.recentOrders as RecentOrder[]
  function getName(o:RecentOrder){return o.from_profile?.full_name||o.delivery_name||'Guest User'}

  return (
    <div className="flex min-h-screen bg-black text-zinc-100">
      <Sidebar />

      <main className="flex-1 px-4 sm:px-6 md:px-8 pt-20 md:pt-8 pb-10 overflow-y-auto w-full max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
            Overview of SVAP svap marketplace activity &amp; statistics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/swaps" className="block group">
            <div className="p-4 sm:p-5 rounded-xl bg-zinc-950 border border-orange-500/40 group-hover:border-orange-500 bg-gradient-to-b from-orange-500/10 to-transparent transition-all shadow-lg">
              <div className="flex items-center justify-between text-orange-400 mb-2">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Awaiting Verification</span>
                <AlertCircle className="w-4 h-4 animate-pulse shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.pendingVerification}</p>
              <p className="text-[11px] sm:text-xs text-orange-400/80 mt-1.5 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Click to verify payments <ArrowRight className="w-3 h-3" />
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
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1.5">{stats.swappedProducts} already svapped</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <h2 className="font-bold text-white text-xs sm:text-sm">Recent Platform Activity</h2>
            </div>
            <Link
              href="/swaps"
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
              <table className="w-full text-xs sm:text-sm text-left min-w-[600px]">
                <thead>
                  <tr className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider border-b border-zinc-800 bg-black/40">
                    <th className="px-4 sm:px-6 py-3.5">Customer</th>
                    <th className="px-4 sm:px-6 py-3.5">City</th>
                    <th className="px-4 sm:px-6 py-3.5">Total</th>
                    <th className="px-4 sm:px-6 py-3.5">Status</th>
                    <th className="px-4 sm:px-6 py-3.5">Date</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 whitespace-nowrap">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-medium text-zinc-200">
                        {getName(order)}
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
                          href={`/swaps/${order.swap_request_id}`}
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
