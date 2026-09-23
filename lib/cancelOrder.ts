import { createAdminClient } from '@/lib/supabase'

interface RelatedOrder {
  id: string
  from_user_id: string
  transaction_ref: string | null
}

export async function cancelOrderAndRestoreItems(orderId: string) {
  const db = createAdminClient()

  const { data: sourceOrder, error: sourceOrderError } = await db
    .from('orders')
    .select('id, swap_request_id, from_user_id, transaction_ref, status')
    .eq('id', orderId)
    .single()

  if (sourceOrderError || !sourceOrder) {
    throw new Error(sourceOrderError?.message ?? 'Order not found')
  }

  if (!['pending_verification', 'confirmed', 'shipped'].includes(sourceOrder.status ?? '')) {
    throw new Error('This order can no longer be cancelled')
  }

  const { data: relatedOrders, error: relatedOrdersError } = await db
    .from('orders')
    .select('id, from_user_id, transaction_ref')
    .eq('swap_request_id', sourceOrder.swap_request_id)

  if (relatedOrdersError) throw new Error(relatedOrdersError.message)

  const orders = (relatedOrders ?? []) as RelatedOrder[]
  if (!orders.some((order) => order.id === orderId)) {
    orders.push({
      id: sourceOrder.id,
      from_user_id: sourceOrder.from_user_id,
      transaction_ref: sourceOrder.transaction_ref,
    })
  }

  const { data: swapRequest, error: swapRequestError } = await db
    .from('swap_requests')
    .select('offered_product_id, requested_product_id')
    .eq('id', sourceOrder.swap_request_id)
    .single()

  if (swapRequestError || !swapRequest) {
    throw new Error(swapRequestError?.message ?? 'Swap request not found')
  }

  const productIds = [swapRequest.offered_product_id, swapRequest.requested_product_id]
    .filter((productId): productId is string => Boolean(productId))
  const userIds = [...new Set(orders.map((order) => order.from_user_id).filter(Boolean))]
  const payerIds = new Set(
    orders
      .filter((order) => Boolean(order.transaction_ref?.trim()))
      .map((order) => order.from_user_id),
  )

  const { error: ordersUpdateError } = await db
    .from('orders')
    .update({ status: 'cancelled' })
    .in('id', orders.map((order) => order.id))

  if (ordersUpdateError) throw new Error(ordersUpdateError.message)

  const { error: swapUpdateError } = await db
    .from('swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', sourceOrder.swap_request_id)

  if (swapUpdateError) throw new Error(swapUpdateError.message)

  if (productIds.length > 0) {
    const { error: productsUpdateError } = await db
      .from('products')
      .update({ status: 'active' })
      .in('id', productIds)

    if (productsUpdateError) throw new Error(productsUpdateError.message)
  }

  if (userIds.length > 0) {
    const notificationRows = userIds.map((userId) => ({
      user_id: userId,
      type: 'order_cancelled',
      title: 'Order cancelled',
      body: payerIds.has(userId)
        ? 'Your order has been cancelled. Your payment will be refunded.'
        : 'Your swap order has been cancelled because the other order was cancelled.',
    }))

    const { error: notificationsError } = await db.from('notifications').insert(
      notificationRows,
    )

    if (notificationsError) {
      console.error('[cancelOrder] notification insert failed after cancellation:', notificationsError)
    }
  }
}
