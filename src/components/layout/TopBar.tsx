'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import SocialNotificationsBell from '@/components/social/SocialNotificationsBell'

interface TopBarProps {
  avatarUrl?: string | null
  username?: string | null
  unreadNotifications?: number
}

export default function TopBar({ avatarUrl, username, unreadNotifications = 0 }: TopBarProps) {
  const t = useTranslations('topbar')

  const profileHref = username ? `/u/${username}` : '/settings/profile'
  const initial = username?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-end gap-3 px-6 py-3 border-b border-neutral-300/20 bg-neutral-100/80 backdrop-blur-md">
      {/* New Post */}
      <Link
        href="/feed/new"
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-neutral font-semibold text-sm transition-opacity hover:opacity-90"
      >
        <Plus size={16} />
        {t('newPost')}
      </Link>

      <SocialNotificationsBell />

      {/* Avatar */}
      <Link href={profileHref} aria-label={t('newPost')}>
        {avatarUrl ? (
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/40 hover:border-primary transition-colors">
            <Image
              src={avatarUrl}
              alt={username ?? 'Perfil'}
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full border-2 border-primary/40 hover:border-primary transition-colors bg-tertiary flex items-center justify-center text-neutral-900 font-bold text-sm">
            {initial}
          </div>
        )}
      </Link>
    </header>
  )
}
