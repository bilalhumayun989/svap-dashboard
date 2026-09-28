'use client'

import { useState, useTransition } from 'react'
import type { SupportTicket } from '@/lib/types'
import { MessageSquare, X, CheckCircle2, RotateCcw } from 'lucide-react'

const statusColors: Record<string, string> = {
  open:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  replied: 'bg-green-500/15 text-green-400 border-green-500/30',
  closed:  'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

interface Props {
  tickets: SupportTicket[]
  activeTab: 'open' | 'closed'
  onSendReply: (ticketId: string, reply: string) => Promise<void>
  onCloseTicket: (ticketId: string, resolutionNote: string) => Promise<void>
  onReopenTicket: (ticketId: string) => Promise<void>
}

export default function SupportClient({
  tickets, activeTab, onSendReply, onCloseTicket, onReopenTicket,
}: Props) {
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [isPending, startTransition] = useTransition()

  function openModal(t: SupportTicket) {
    setSelected(t)
    setReply(t.admin_reply ?? '')
    setResolutionNote(t.resolution_note ?? '')
  }

  function closeModal() {
    setSelected(null)
    setReply('')
    setResolutionNote('')
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      closeModal()
    })
  }

  if (tickets.length === 0) {
    return (
      <div className="text-zinc-500 text-center py-24 text-sm">
        {activeTab === 'closed' ? 'No closed tickets.' : 'No open tickets. All good! 🎉'}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {tickets.map(t => {
          const profile = Array.isArray(t.profile) ? t.profile[0] : t.profile
          return (
            <div
              key={t.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-zinc-100 truncate">{t.subject}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColors[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm line-clamp-2">{t.message}</p>
                  <p className="text-zinc-600 text-xs mt-2">
                    @{profile?.username ?? '—'} · {new Date(t.created_at).toLocaleDateString()}
                    {t.closed_at && (
                      <span className="ml-2 text-zinc-700">
                        · Closed {new Date(t.closed_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                  {t.admin_reply && (
                    <p className="text-zinc-500 text-xs mt-1.5 truncate">
                      <span className="text-zinc-600">Admin:</span> {t.admin_reply}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {t.status !== 'closed' && (
                    <button
                      onClick={() => run(() => onCloseTicket(t.id, ''))}
                      disabled={isPending}
                      title="Close ticket"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {t.status === 'closed' && (
                    <button
                      onClick={() => run(() => onReopenTicket(t.id))}
                      disabled={isPending}
                      title="Reopen ticket"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openModal(t)}
                    className="text-orange-400 text-sm font-semibold hover:text-orange-300 transition-colors"
                  >
                    {t.status === 'open' ? 'Reply' : 'View'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-zinc-100">{selected.subject}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColors[selected.status]}`}>
                  {selected.status}
                </span>
              </div>
              <button onClick={closeModal} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info + message */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">
                From{' '}
                <span className="text-zinc-300 font-medium">
                  @{(Array.isArray(selected.profile) ? selected.profile[0] : selected.profile)?.username ?? '—'}
                </span>
                {' · '}{new Date(selected.created_at).toLocaleString()}
              </p>
              <div className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {selected.message}
              </div>
            </div>

            {/* Previous reply (if any) */}
            {selected.admin_reply && selected.status !== 'open' && (
              <div>
                <p className="text-xs text-zinc-500 mb-1.5 uppercase tracking-wider font-semibold">Previous Reply</p>
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 text-xs text-zinc-400 whitespace-pre-wrap">
                  {selected.admin_reply}
                </div>
              </div>
            )}

            {/* Reply textarea — disabled on closed */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider mb-1.5 block font-semibold">
                {selected.status === 'closed' ? 'Reply (ticket is closed)' : 'Your Reply'}
              </label>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                disabled={selected.status === 'closed'}
                rows={4}
                placeholder={selected.status === 'closed' ? 'Reopen ticket to reply.' : 'Type your reply…'}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {/* Resolution note — shown on open/replied and closed */}
            {selected.status !== 'replied' ? (
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wider mb-1.5 block font-semibold">
                  Resolution Note <span className="text-zinc-600 normal-case">(optional, internal)</span>
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  disabled={selected.status === 'closed'}
                  rows={2}
                  placeholder="Internal note about how this was resolved…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            ) : null}

            {/* Action buttons */}
            {selected.status !== 'closed' ? (
              <div className="flex gap-3">
                <button
                  onClick={() => run(() => onSendReply(selected.id, reply))}
                  disabled={isPending || !reply.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 text-sm font-semibold hover:bg-green-500/25 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  {isPending ? 'Saving…' : 'Send Reply'}
                </button>
                <button
                  onClick={() => run(() => onCloseTicket(selected.id, resolutionNote))}
                  disabled={isPending}
                  className="py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Close Ticket
                </button>
              </div>
            ) : (
              <button
                onClick={() => run(() => onReopenTicket(selected.id))}
                disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isPending ? 'Reopening…' : 'Reopen Ticket'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
