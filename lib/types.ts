export type OrderStatus = 'pending_verification' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

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
