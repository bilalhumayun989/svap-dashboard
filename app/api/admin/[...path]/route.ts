import { NextRequest, NextResponse } from 'next/server'
import { adminApi } from '@/lib/backend'

type Context = { params: Promise<{ path: string[] }> }
async function proxy(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params
    const suffix = path.map(encodeURIComponent).join('/') + request.nextUrl.search
    const init: RequestInit = { method: request.method }
    if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text()
    const payload = await adminApi('/admin/' + suffix, init)
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin API request failed'
    const status = /sign in/i.test(message) ? 401 : /admin access/i.test(message) ? 403 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
export const GET = proxy
export const POST = proxy
export const PATCH = proxy