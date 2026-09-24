'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Tag, 
  MessageSquare, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/support', label: 'Support', icon: MessageSquare },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  // Route change hone par mobile sidebar auto-close ho jaye
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <>
      {/* ---------------- MOBILE HEADER BAR ---------------- */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black border-b border-zinc-800/80 px-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2">
          <p className="text-orange-400 font-black text-lg tracking-tight">SVAP Admin</p>
          <span className="text-zinc-600 text-xs">|</span>
          <p className="text-zinc-400 text-xs font-medium">Management Panel</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Navigation"
          className="p-2 text-zinc-300 hover:text-orange-400 hover:bg-zinc-900 rounded-lg transition-colors border border-zinc-800"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ---------------- MOBILE OVERLAY BACKDROP ---------------- */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* ---------------- MAIN SIDEBAR ---------------- */}
      {/* Note: Desktop par sticky top-0 h-screen rakha hai taake Signout hamesha bottom me fixed rahe */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-64 bg-black border-r border-zinc-800/80 flex flex-col transition-transform duration-300 ease-in-out
          md:translate-x-0 md:sticky md:top-0 md:h-screen md:shrink-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header - Non-scrolling */}
        <div className="px-5 py-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div>
            <p className="text-orange-400 font-black text-xl tracking-tight">SVAP Admin</p>
            <p className="text-zinc-500 text-xs mt-0.5 font-medium">Management Panel</p>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links - Scrollable only if items overflow */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sign Out Button - Permanently Pinned at Bottom */}
        <div className="p-3 border-t border-zinc-900 shrink-0 mt-auto">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}