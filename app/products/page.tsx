'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { Product } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-green-500/15 text-green-400 border-green-500/30',
  swapped: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  removed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
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
    const matchSearch = search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.owner as { username?: string })?.username?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-black text-zinc-100 mb-1">Products</h1>
        <p className="text-zinc-500 text-sm mb-6">{products.length} total listings</p>

        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or username…"
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="swapped">Swapped</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-zinc-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">No products found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-6 py-3">Product</th>
                    <th className="text-left px-6 py-3">Owner</th>
                    <th className="text-left px-6 py-3">Condition</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Listed</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => {
                    const img = product.image_urls?.[0]
                    const owner = product.owner as { username?: string; full_name?: string }
                    return (
                      <tr key={product.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {img ? (
                              <img src={img} className="w-10 h-10 rounded-lg object-cover" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-800" />
                            )}
                            <p className="font-medium max-w-[200px] truncate">{product.title}</p>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-zinc-300">@{owner?.username ?? '—'}</p>
                          <p className="text-xs text-zinc-500">{owner?.full_name}</p>
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-orange-500/15 text-orange-400 border-orange-500/30 capitalize">
                            {product.condition}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[product.status] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-500 text-xs">{new Date(product.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-3 text-center">
                          {product.status === 'active' && (
                            <button
                              onClick={() => removeProduct(product.id)}
                              className="px-3 py-1 text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
                            >
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
          )}
        </div>
      </main>
    </div>
  )
}
