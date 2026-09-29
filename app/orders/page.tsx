import { redirect } from 'next/navigation'

// Flat orders list is replaced by svap-grouped view at /svaps.
// This redirect keeps any bookmarks or old links working.
export default function OrdersPage() {
  redirect('/swaps')
}
