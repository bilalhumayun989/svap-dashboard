export type OrderStatus = 'payment_verification' | 'product_verification' | 'item_verification' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  swap_request_id: string
  from_user_id: string
  to_user_id: string
  delivery_name: string
  delivery_phone: string
  delivery_address: string
  delivery_city: string
  transaction_ref: string | null
  shipping_cost: number
  discount: number
  premium_amount: number
  total: number
  status: OrderStatus
  delivery_type: 'courier' | 'self' | null
  tracking_number: string | null
  courier_shipment_id: string | null
  admin_notes: string | null
  created_at: string
  // joined
  from_profile?: { username: string; full_name: string; email: string }
  to_profile?: { username: string; full_name: string }
  swap_request?: {
    offered_product?: { title: string; image_urls: string[] }
    requested_product?: { title: string; image_urls: string[] }
  }
}

// ─── Swap-grouped types (used by /swaps pages) ────────────────────────────────

export interface SwapPartyProfile {
  id: string
  username: string
  full_name: string
  email?: string | null
  phone?: string | null
}

export interface SwapProduct {
  id: string
  title: string
  image_urls: string[]
}

/** One party's order inside a SwapRow — null means they haven't checked out */
export interface SwapPartyOrder {
  id: string
  from_user_id: string
  to_user_id: string
  status: OrderStatus
  delivery_type: 'courier' | 'self' | null
  tracking_number: string | null
  transaction_ref: string | null
  shipping_cost: number
  premium_amount: number
  discount: number
  total: number
  delivery_name: string
  delivery_phone: string
  delivery_address: string
  delivery_city: string
  admin_notes: string | null
  created_at: string
}

/** One row in the swap list — one swap_request with up to two orders */
export interface SwapRow {
  /** swap_request.id */
  swapId: string
  swapStatus: string
  createdAt: string
  premiumAmount: number

  /** swap_requests.from_user_id — the sender (Party 1) */
  sender: SwapPartyProfile
  /** swap_requests.to_user_id — the receiver (Party 2) */
  receiver: SwapPartyProfile

  offeredProduct: SwapProduct | null   // null = cash-only offer
  requestedProduct: SwapProduct | null

  /** Order whose from_user_id === swap_requests.from_user_id */
  party1Order: SwapPartyOrder | null
  /** Order whose from_user_id === swap_requests.to_user_id */
  party2Order: SwapPartyOrder | null
}

export interface UserProfile {
  id: string
  username: string
  full_name: string
  email: string
  phone: string | null
  city: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  product_count?: number
}

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  message: string
  status: 'open' | 'replied' | 'closed'
  admin_reply: string | null
  created_at: string
  replied_at: string | null
  closed_at: string | null
  resolution_note: string | null
  profile?: { username: string; full_name: string; email: string }
}

export interface Product {
  id: string
  title: string
  description?: string | null
  condition: string
  image_urls: string[]
  status: string
  created_at: string
  owner_id: string
  owner?: { username: string; full_name: string } | { username: string; full_name: string }[]
}
