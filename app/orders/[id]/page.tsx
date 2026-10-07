// Old per-order detail route. Looks up the svap_request_id for this order
// and redirects to /svaps/[svapId] so old links keep working.

import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { adminApi } from '@/lib/backend'

async function getSessionUser() {
  const cookieStore = await cookies()
  const serverClient = createServerClient(
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
  const { data: { user } } = await serverClient.auth.getUser()
  return user
}

export default async function OrderDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params
  let order: {swap_request_id:string}|null=null
  try { order=(await adminApi('/admin/orders/'+encodeURIComponent(id))).data } catch { notFound() }

  if (!order?.swap_request_id) notFound()

  redirect(`/swaps/${order.swap_request_id}`)
}
