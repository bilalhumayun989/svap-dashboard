'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import type { UserProfile } from '@/lib/types'

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      fetchUsers()
    })
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, phone, city, avatar_url, created_at')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Get product counts
    const { data: productCounts } = await supabase
      .from('products')
      .select('owner_id')

    const countMap: Record<string, number> = {}
    for (const p of (productCounts ?? [])) {
      countMap[p.owner_id] = (countMap[p.owner_id] ?? 0) + 1
    }

    setUsers(data.map((u) => ({ ...u, product_count: countMap[u.id] ?? 0 })) as UserProfile[])
    setLoading(false)
  }

  const filtered = users.filter((u) =>
    search === '' ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-black text-zinc-100 mb-1">Users</h1>
        <p className="text-zinc-500 text-sm mb-6">{users.length} registered users</p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, name or email…"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 w-72 mb-6"
        />

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-zinc-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-6 py-3">User</th>
                    <th className="text-left px-6 py-3">Email</th>
                    <th className="text-left px-6 py-3">Phone</th>
                    <th className="text-left px-6 py-3">City</th>
                    <th className="text-left px-6 py-3">Products</th>
                    <th className="text-left px-6 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs">
                              {user.username?.[0]?.toUpperCase() ?? '?'}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">@{user.username}</p>
                            <p className="text-xs text-zinc-400">{user.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-zinc-400">{user.email ?? '—'}</td>
                      <td className="px-6 py-3 text-zinc-400">{user.phone ?? '—'}</td>
                      <td className="px-6 py-3 text-zinc-400">{user.city ?? '—'}</td>
                      <td className="px-6 py-3 text-zinc-300">{user.product_count}</td>
                      <td className="px-6 py-3 text-zinc-500 text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
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
