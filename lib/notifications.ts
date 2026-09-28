import type { createAdminClient } from '@/lib/supabase'

/**
 * Fixes notifications after an admin order-status change.
 *
 * The DB trigger `on_order_status_change` fires on ANY status update and
 * sends the SAME notification to BOTH swap partners — wrong when only one
 * order changed. This helper:
 *  1. Deletes trigger-generated notifications for both users (within last 30s).
 *  2. Inserts precise, context-aware notifications for the right users.
 */
export async function fixNotifications(
  db: ReturnType<typeof createAdminClient>,
  orderId: string,              // the order whose status just changed
  ownUserId: string,            // user whose order was actually updated
  partnerUserId: string | null, // swap partner (may not have an order yet)
  ownTitle: string,
  ownBody: string,
  partnerTitle: string | null,  // null = don't notify partner
  partnerBody: string | null,
) {
  const cutoff = new Date(Date.now() - 30_000).toISOString()

  // Delete trigger-generated notifications created in last 30 s
  await db
    .from('notifications')
    .delete()
    .in('user_id', partnerUserId ? [ownUserId, partnerUserId] : [ownUserId])
    .eq('type', 'order_status')
    .gte('created_at', cutoff)

  // Correct notification for the order owner
  await db.from('notifications').insert({
    user_id: ownUserId,
    type: 'order_status',
    title: ownTitle,
    body: ownBody,
    route: '/orders',
  })

  // Separate (different wording) notification for partner — only if relevant
  if (partnerUserId && partnerTitle && partnerBody) {
    await db.from('notifications').insert({
      user_id: partnerUserId,
      type: 'order_status',
      title: partnerTitle,
      body: partnerBody,
      route: '/orders',
    })
  }
}
