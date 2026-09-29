import { createAdminClient } from '@/lib/supabase'

interface OrderRow {
  id: string
  from_user_id: string
  transaction_ref: string | null
  status: string | null
}

export async function cancelOrderAndRestoreItems(orderId: string) {
  const db = createAdminClient()

  // ── 1. Fetch the order being cancelled ──────────────────────────────────────
  const { data: sourceOrder, error: sourceOrderError } = await db
    .from('orders')
    .select('id, swap_request_id, from_user_id, transaction_ref, status')
    .eq('id', orderId)
    .single()

  if (sourceOrderError || !sourceOrder) {
    throw new Error(sourceOrderError?.message ?? 'Order not found')
  }

  // Only cancellable while still in-progress (not already done/cancelled)
  if (!['payment_verification', 'product_verification', 'item_verification', 'shipped'].includes(sourceOrder.status ?? '')) {
    throw new Error('This order can no longer be cancelled')
  }

  // ── 2. Find ALL orders linked to the same swap_request ──────────────────────
  // This includes the partner's order (if they have checked out)
  const { data: allLinkedOrders, error: linkedErr } = await db
    .from('orders')
    .select('id, from_user_id, transaction_ref, status')
    .eq('swap_request_id', sourceOrder.swap_request_id)

  if (linkedErr) throw new Error(linkedErr.message)

  // Make sure source order is in the list (edge case: only 1 order exists yet)
  const orders = (allLinkedOrders ?? []) as OrderRow[]
  if (!orders.some((o) => o.id === orderId)) {
    orders.push({
      id: sourceOrder.id,
      from_user_id: sourceOrder.from_user_id,
      transaction_ref: sourceOrder.transaction_ref,
      status: sourceOrder.status,
    })
  }

  // Separate cancellable orders from already-done ones
  const cancellableOrders = orders.filter(
    (o) => !['cancelled', 'delivered'].includes(o.status ?? ''),
  )
  const cancellableIds = cancellableOrders.map((o) => o.id)

  // ── 3. Cancel ALL cancellable orders in this swap ───────────────────────────
  if (cancellableIds.length > 0) {
    const { error: ordersUpdateError } = await db
      .from('orders')
      .update({ status: 'cancelled' })
      .in('id', cancellableIds)

    if (ordersUpdateError) throw new Error(ordersUpdateError.message)
  }

  // ── 4. Cancel the swap_request itself ───────────────────────────────────────
  const { error: swapUpdateError } = await db
    .from('swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', sourceOrder.swap_request_id)

  if (swapUpdateError) throw new Error(swapUpdateError.message)

  // ── 5. Restore both products back to active ─────────────────────────────────
  const { data: swapRequest, error: swapRequestError } = await db
    .from('swap_requests')
    .select('offered_product_id, requested_product_id')
    .eq('id', sourceOrder.swap_request_id)
    .single()

  if (swapRequestError || !swapRequest) {
    throw new Error(swapRequestError?.message ?? 'Swap request not found')
  }

  const productIds = [swapRequest.offered_product_id, swapRequest.requested_product_id]
    .filter((id): id is string => Boolean(id))

  if (productIds.length > 0) {
    const { error: productsUpdateError } = await db
      .from('products')
      .update({ status: 'active' })
      .in('id', productIds)

    if (productsUpdateError) throw new Error(productsUpdateError.message)
  }

  // ── 6. Send correct, context-aware notifications ─────────────────────────────
  // Users who had actually paid (have a transaction_ref)
  const payerIds = new Set(
    orders
      .filter((o) => Boolean(o.transaction_ref?.trim()))
      .map((o) => o.from_user_id),
  )

  // The user whose order was directly cancelled by admin
  const initiatingUserId = sourceOrder.from_user_id

  // All unique users across all linked orders
  const allUserIds = [...new Set(orders.map((o) => o.from_user_id).filter(Boolean))]

  const notificationRows = allUserIds.map((userId) => {
    const isInitiator = userId === initiatingUserId
    const hasPaid = payerIds.has(userId)

    let title: string
    let body: string

    if (isInitiator) {
      title = 'Order Cancelled ❌'
      body = hasPaid
        ? 'Your order has been cancelled. Your payment will be refunded. Please contact support.'
        : 'Your order has been cancelled. This SVAP will not proceed further.'
    } else {
      title = 'SVAP Cancelled ⚠️'
      body = hasPaid
        ? 'Your SVAP partner\'s order was cancelled, so your order has also been cancelled. Your payment will be refunded. Please contact support.'
        : 'Your SVAP partner\'s order was cancelled, so this SVAP cannot be completed. Your items have been restored to active.'
    }

    return {
      user_id: userId,
      type: 'order_cancelled',
      title,
      body,
      route: '/orders',
    }
  })

  if (notificationRows.length > 0) {
    const { error: notificationsError } = await db
      .from('notifications')
      .insert(notificationRows)

    if (notificationsError) {
      console.error('[cancelOrder] notification insert failed:', notificationsError)
    }
  }
}
