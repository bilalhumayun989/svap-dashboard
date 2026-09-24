'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { UserProfile } from '@/lib/types'
import { Search, Users, Mail, Phone, MapPin, Package, Calendar } from 'lucide-react'

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      fetchUsers()
    })
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, phone, city, avatar_url, created_at')
      .order('created_at', { ascending: false })

    if (!data) {
      setLoading(false)
      return
    }

    // Get product counts
    const { data: productCounts } = await supabase
      .from('products')
      .select('owner_id')

    const countMap: Record<string, number> = {}
    for (const p of productCounts ?? []) {
      if (p.owner_id) {
        countMap[p.owner_id] = (countMap[p.owner_id] ?? 0) + 1
      }
    }

    setUsers(data.map((u) => ({ ...u, product_count: countMap[u.id] ?? 0 })) as UserProfile[])
    setLoading(false)
  }

  const filtered = users.filter(
    (u) =>
      search === '' ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">Users</h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              {users.length} registered platform users
            </p>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="relative max-w-md mb-6">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, name or email…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80 transition-colors"
          />
        </div>

        {/* Content Container */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-zinc-500 text-sm">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-zinc-600 mb-1" />
              <span>No users found</span>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider border-b border-zinc-800/80 bg-zinc-900/40">
                      <th className="px-6 py-3.5">User</th>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Phone</th>
                      <th className="px-6 py-3.5">City</th>
                      <th className="px-6 py-3.5">Products</th>
                      <th className="px-6 py-3.5">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filtered.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                className="w-9 h-9 rounded-full object-cover border border-zinc-800 shrink-0"
                                alt=""
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs shrink-0">
                                {user.username?.[0]?.toUpperCase() ?? '?'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-100 truncate">@{user.username}</p>
                              <p className="text-xs text-zinc-400 truncate">{user.full_name || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-300 font-mono text-xs">{user.email ?? '—'}</td>
                        <td className="px-6 py-4 text-zinc-400">{user.phone ?? '—'}</td>
                        <td className="px-6 py-4 text-zinc-400">{user.city ?? '—'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-900 border border-zinc-800 text-orange-400">
                            <Package className="w-3 h-3 text-orange-400/80" />
                            {user.product_count ?? 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs">
                          {new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
                {filtered.map((user) => (
                  <div key={user.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-800/60">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          className="w-11 h-11 rounded-full object-cover border border-zinc-800 shrink-0"
                          alt=""
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm shrink-0">
                          {user.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-zinc-100 text-sm truncate">@{user.username}</h3>
                        <p className="text-xs text-zinc-400 truncate">{user.full_name || 'N/A'}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
                        <Package className="w-3 h-3" />
                        {user.product_count ?? 0}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="font-mono text-[11px] truncate">{user.email ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{user.phone ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{user.city ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500 pt-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}