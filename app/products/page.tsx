'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Product } from '@/lib/types'
import { Search, Filter, Trash2, Package, User } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  swapped: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  removed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      fetchProducts()
    })
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, title, condition, image_urls, status, created_at, user_id, owner:profiles!user_id(username, full_name)')
      .order('created_at', { ascending: false })

    setProducts((data ?? []) as unknown as Product[])
    setLoading(false)
  }

  async function removeProduct(id: string) {
    if (!confirm('Remove this product listing?')) return
    await supabase.from('products').update({ status: 'removed' }).eq('id', id)
    fetchProducts()
  }

  const filtered = products.filter((p) => {
    const matchSearch =
      search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.owner as { username?: string })?.username?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">Products</h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">{products.length} total product listings</p>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or username…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80 transition-colors"
            />
          </div>

          <div className="relative w-full sm:w-48">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-orange-500/80 appearance-none cursor-pointer transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="swapped">Swapped</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </div>

        {/* Content Container */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-sm">Loading listings…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-zinc-600 mb-1" />
              <span>No products found</span>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider border-b border-zinc-800/80 bg-zinc-900/40">
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-6 py-3.5">Owner</th>
                      <th className="px-6 py-3.5">Condition</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Listed Date</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filtered.map((product) => {
                      const img = product.image_urls?.[0]
                      const owner = product.owner as { username?: string; full_name?: string }
                      return (
                        <tr key={product.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {img ? (
                                <img src={img} className="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" alt="" />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <p className="font-semibold text-zinc-100 max-w-[220px] truncate">{product.title}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-zinc-200 font-medium">@{owner?.username ?? '—'}</p>
                            <p className="text-xs text-zinc-500">{owner?.full_name || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border bg-orange-500/10 text-orange-400 border-orange-500/20 capitalize">
                              {product.condition}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border capitalize ${STATUS_COLORS[product.status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                              {product.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-xs">
                            {new Date(product.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {product.status === 'active' && (
                              <button
                                onClick={() => removeProduct(product.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                {filtered.map((product) => {
                  const img = product.image_urls?.[0]
                  const owner = product.owner as { username?: string; full_name?: string }
                  return (
                    <div key={product.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {img ? (
                            <img src={img} className="w-12 h-12 rounded-lg object-cover border border-zinc-800 shrink-0" alt="" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-zinc-100 text-sm leading-tight">{product.title}</h3>
                            <span className="inline-block mt-1 text-[11px] text-zinc-500">
                              {new Date(product.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[product.status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                          {product.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                          <span>@{owner?.username ?? '—'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[11px] font-medium capitalize">
                          {product.condition}
                        </span>
                      </div>

                      {product.status === 'active' && (
                        <div className="pt-2 border-t border-zinc-800/60 flex justify-end">
                          <button
                            onClick={() => removeProduct(product.id)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove Product
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}