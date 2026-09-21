'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/',         label: 'Dashboard',  icon: '⊞' },
  { href: '/orders',   label: 'Orders',     icon: '📦' },
  { href: '/users',    label: 'Users',      icon: '👤' },
  { href: '/products', label: 'Products',   icon: '🏷️' },
  { href: '/support',  label: 'Support',    icon: '💬' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-5 py-6 border-b border-zinc-800">
        <p className="text-orange-400 font-black text-xl tracking-tight">SVAP Admin</p>
        <p className="text-zinc-500 text-xs mt-0.5">Management Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-5">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}
