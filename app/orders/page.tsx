import { redirect } from 'next/navigation'

// Flat orders list is replaced by swap-grouped view at /swaps.
// This redirect keeps any bookmarks or old links working.
export default function OrdersPage() {
  redirect('/swaps')
}
