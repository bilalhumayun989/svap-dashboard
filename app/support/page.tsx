'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

interface Ticket {
  id: string
  user_id: string
  subject: string
  message: string
  status: 'open' | 'replied' | 'closed'
  admin_reply: string | null
  created_at: string
  profile?: { username: string; full_name: string; email: string }
}

const statusColors: Record<string, string> = {
  open:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  replied: 'bg-green-500/15 text-green-400 border-green-500/30',
  closed:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'replied' | 'closed'>('open')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchTickets() {
    setLoading(true)
    const q = supabase
      .from('support_tickets')
      .select('*, profile:profiles!user_id(username, full_name, email)')
      .order('created_at', { ascending: false })

    const { data } = filter === 'all' ? await q : await q.eq('status', filter)
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
      else fetchTickets()
    })
  }, [filter])

  async function submitReply(status: 'replied' | 'closed') {
    if (!selected) return
    setSaving(true)
    await supabase
      .from('support_tickets')
      .update({ admin_reply: reply || null, status })
      .eq('id', selected.id)
    setSaving(false)
    setSelected(null)
    setReply('')
    fetchTickets()
  }

  const openCount = tickets.filter(t => t.status === 'open').length

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-zinc-100">Help & Support</h1>
            <p className="text-zinc-500 text-sm mt-1">{openCount} open ticket{openCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            {(['all', 'open', 'replied', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                  filter === f
                    ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                    : 'text-zinc-400 border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-center py-20">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="text-zinc-500 text-center py-20">No tickets found.</div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t); setReply(t.admin_reply ?? '') }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 cursor-pointer hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-zinc-100 truncate">{t.subject}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColors[t.status]}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-2">{t.message}</p>
                    <p className="text-zinc-600 text-xs mt-2">
                      @{(t.profile as { username?: string })?.username ?? '—'} · {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button className="text-orange-400 text-sm font-semibold flex-shrink-0 hover:text-orange-300">
                    {t.status === 'open' ? 'Reply' : 'View'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-zinc-100 text-lg">{selected.subject}</h2>
                <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
              </div>

              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-1">
                  From <span className="text-zinc-300">@{(selected.profile as { username?: string })?.username}</span> · {new Date(selected.created_at).toLocaleString()}
                </p>
                <div className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-300 whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-zinc-400 uppercase tracking-wider mb-2 block">Your Reply</label>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={5}
                  placeholder="Type your reply..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => submitReply('replied')}
                  disabled={saving || !reply.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : '✓ Send Reply'}
                </button>
                <button
                  onClick={() => submitReply('closed')}
                  disabled={saving}
                  className="py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-sm font-semibold hover:text-zinc-200 disabled:opacity-40 transition-colors"
                >
                  Close Ticket
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
