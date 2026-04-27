'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Home,
  Compass,
  Film,
  MessageCircle,
  User,
  Settings,
  Zap,
} from 'lucide-react'

const navItems = [
  { key: 'feed' as const, href: '/feed', icon: Home },
  { key: 'explore' as const, href: '/explore', icon: Compass },
  { key: 'reels' as const, href: '/reels', icon: Film },
  { key: 'messages' as const, href: '/', icon: MessageCircle },
  { key: 'profile' as const, href: '/u/me', icon: User },
  { key: 'settings' as const, href: '/settings/profile', icon: Settings },
]

interface SidebarProps {
  username?: string | null
}

export default function Sidebar({ username }: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const profileHref = username ? `/u/${username}` : '/settings/profile'

  const items = navItems.map((item) =>
    item.key === 'profile' ? { ...item, href: profileHref } : item,
  )

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 flex flex-col z-30 border-r border-neutral-300/20 bg-neutral-100">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-neutral-300/20">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Zap size={18} className="text-primary" />
        </div>
        <span
          className="text-lg font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: 'var(--font-headline)' }}
        >
          VibeStream
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {items.map(({ key, href, icon: Icon }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : href === '/feed'
                ? pathname === '/feed' || pathname.startsWith('/feed/')
                : pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={key}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-neutral-600 hover:bg-neutral-300/10 hover:text-neutral-800',
              ].join(' ')}
            >
              <Icon
                size={18}
                className={isActive ? 'text-primary' : 'text-neutral-600'}
              />
              {t(key)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
