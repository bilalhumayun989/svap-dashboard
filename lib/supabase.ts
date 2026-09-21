import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client using @supabase/ssr — automatically syncs session to cookies
// so Server Components can read it via createServerClient.
// Use this everywhere in 'use client' components instead of the plain createClient.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Server-only admin client — bypasses RLS via service_role key.
// NEVER import this in 'use client' components; only use in Server
// Components, Route Handlers, or Server Actions.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (no NEXT_PUBLIC_ prefix).'
    )
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
