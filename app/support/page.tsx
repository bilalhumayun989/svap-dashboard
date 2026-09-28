// Server Component — all mutations use service_role (RLS bypass).
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import SupportClient from '@/components/SupportClient'
import type { SupportTicket } from '@/lib/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getSessionUser() {
  const cookieStore = await cookies()
  const sc = createServerClient(
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
  const { data: { user } } = await sc.auth.getUser()
  return user
}

// ─── Server Actions ───────────────────────────────────────────────────────────

async function sendReply(ticketId: string, replyText: string) {
  'use server'
  const db = createAdminClient()
  await db
    .from('support_tickets')
    .update({ admin_reply: replyText, status: 'replied', replied_at: new Date().toISOString() })
    .eq('id', ticketId)

  // Notify user
  const { data: ticket } = await db
    .from('support_tickets')
    .select('user_id, subject')
    .eq('id', ticketId)
    .single()

  if (ticket) {
    await db.from('notifications').insert({
      user_id: ticket.user_id,
      type: 'support',
      title: 'Support Reply 💬',
      body: `Admin has replied to your support ticket: "${ticket.subject}"`,
      route: '/support',
    })
  }

  revalidatePath('/support')
}

async function closeTicket(ticketId: string, resolutionNote: string) {
  'use server'
  const db = createAdminClient()
  await db
    .from('support_tickets')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      resolution_note: resolutionNote || null,
    })
    .eq('id', ticketId)

  // Notify user
  const { data: ticket } = await db
    .from('support_tickets')
    .select('user_id, subject')
    .eq('id', ticketId)
    .single()

  if (ticket) {
    await db.from('notifications').insert({
      user_id: ticket.user_id,
      type: 'support',
      title: 'Support Ticket Closed ✅',
      body: `Your support ticket "${ticket.subject}" has been closed. If you need further help, please open a new ticket.`,
      route: '/support',
    })
  }

  revalidatePath('/support')
}

async function reopenTicket(ticketId: string) {
  'use server'
  const db = createAdminClient()
  await db
    .from('support_tickets')
    .update({ status: 'open', closed_at: null, resolution_note: null })
    .eq('id', ticketId)
  revalidatePath('/support')
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { tab } = await searchParams
  const activeTab = tab === 'closed' ? 'closed' : 'open'

  const db = createAdminClient()

  const { data, error } = await db
    .from('support_tickets')
    .select('*, profile:profiles!user_id(username, full_name, email)')
    .order('created_at', { ascending: false })

  const allTickets = (data ?? []) as SupportTicket[]

  const openTickets   = allTickets.filter(t => t.status === 'open' || t.status === 'replied')
  const closedTickets = allTickets.filter(t => t.status === 'closed')
  const displayed     = activeTab === 'closed' ? closedTickets : openTickets

  return (
    <div className="flex min-h-screen bg-black text-zinc-100 font-sans">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-zinc-100">Help &amp; Support</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {openTickets.length} open · {closedTickets.length} closed
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <a
              href="/support"
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === 'open'
                  ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                  : 'text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
            >
              Open
              {openTickets.length > 0 && (
                <span className="ml-1.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {openTickets.length}
                </span>
              )}
            </a>
            <a
              href="/support?tab=closed"
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === 'closed'
                  ? 'bg-zinc-700/50 text-zinc-200 border-zinc-600'
                  : 'text-zinc-400 border-zinc-700 hover:text-zinc-200'
              }`}
            >
              Closed
              {closedTickets.length > 0 && (
                <span className="ml-1.5 bg-zinc-700 text-zinc-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {closedTickets.length}
                </span>
              )}
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-xs">
            Error loading tickets: {error.message}
          </div>
        )}

        <SupportClient
          tickets={displayed}
          activeTab={activeTab}
          onSendReply={sendReply}
          onCloseTicket={closeTicket}
          onReopenTicket={reopenTicket}
        />
      </main>
    </div>
  )
}
