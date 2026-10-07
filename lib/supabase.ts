import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Supabase is used for admin sign-in/session only. SVAP data is served by the PostgreSQL API.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)