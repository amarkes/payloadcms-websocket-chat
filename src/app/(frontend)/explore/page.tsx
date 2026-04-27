/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import Image from 'next/image'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import type { User, Media } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import FeedScroller from '@/components/social/FeedScroller'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import TrendingTopics from '@/components/widgets/TrendingTopics'
import type { PostData } from '@/components/social/PostCard'

interface ExplorePageProps {
  searchParams: Promise<{ tag?: string }>
}

const CATEGORIES = [
  { label: 'Música', slug: 'music', stat: '4.2k', statKey: 'activeVibes' as const, color: 'from-amber-600 to-orange-500', emoji: '🎵' },
  { label: 'Arte', slug: 'art', stat: '2.6k', statKey: 'dailyCreators' as const, color: 'from-purple-600 to-pink-500', emoji: '🎨' },
  { label: 'Tech', slug: 'tech', stat: '1.5k', statKey: 'newInnovations' as const, color: 'from-cyan-600 to-blue-500', emoji: '💻' },
  { label: 'Design', slug: 'design', stat: '3.1k', statKey: 'activeVibes' as const, color: 'from-teal-600 to-green-500', emoji: '✏️' },
]

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const { tag } = await searchParams
  const normalizedTag = tag?.trim().toLowerCase() || ''

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const t = await getTranslations('explore')

  const fullUser = user
    ? ((await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
        overrideAccess: true,
      })) as User & { username?: string | null; avatar?: { filename?: string | null } | null })
    : null

  const avatarUrl = fullUser?.avatar?.filename
    ? `/api/media/file/${fullUser.avatar.filename}`
    : null

  const p = payload as any

  const postsResult = await p.find({
    collection: 'posts',
    where: {
      and: [
        { visibility: { equals: 'public' } },
        { isArchived: { equals: false } },
        ...(user ? [{ author: { not_equals: user.id } }] : []),
        ...(normalizedTag ? [{ 'tags.tag': { equals: normalizedTag } }] : []),
      ],
    },
    sort: '-createdAt',
    depth: 1,
    page: 1,
    limit: 12,
    overrideAccess: true,
  })

  const rightPanel = <TrendingTopics />

  return (
    <AppShell
      username={fullUser?.username ?? user?.email}
      avatarUrl={avatarUrl}
      rightPanel={rightPanel}
    >
      <SocialRealtimeBridge />

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-neutral-900 mb-1"
          style={{ fontFamily: 'var(--font-headline)' }}
        >
          {t('title')}
        </h1>
        <p className="text-sm text-neutral-500">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <form action="/explore" method="get" className="flex gap-2 mb-6">
        <input
          type="text"
          name="tag"
          defaultValue={normalizedTag}
          placeholder={t('searchPlaceholder')}
          className="flex-1 h-11 rounded-xl border border-neutral-300/20 bg-neutral-200 text-neutral-800 placeholder-neutral-500 px-4 text-sm outline-none focus:border-primary/40 transition-colors"
        />
        <button
          type="submit"
          className="px-5 h-11 rounded-xl bg-primary text-neutral font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          {t('search')}
        </button>
      </form>

      {/* Trending Categories */}
      {!normalizedTag && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-700">{t('trendingCategories')}</h2>
            <button className="text-xs text-primary hover:underline">{t('viewAll')}</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/explore?tag=${cat.slug}`}
                className="group relative overflow-hidden rounded-2xl aspect-video flex flex-col justify-end p-3 border border-neutral-300/20 hover:border-primary/30 transition-colors"
              >
                <div className={`absolute inset-0 bg-linear-to-br ${cat.color} opacity-70`} />
                <div className="absolute inset-0 bg-neutral-900/40" />
                <div className="relative z-10">
                  <div className="text-lg mb-0.5">{cat.emoji}</div>
                  <p className="text-sm font-bold text-white leading-tight">{cat.label}</p>
                  <p className="text-[10px] text-white/70 mt-0.5">
                    {cat.stat} {t(cat.statKey)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* For You / Results */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          {normalizedTag ? (
            <>
              <span className="text-sm text-neutral-500">{t('resultsFor')}</span>
              <span className="text-sm font-semibold text-primary">#{normalizedTag}</span>
            </>
          ) : (
            <h2 className="text-sm font-semibold text-neutral-700">
              <span className="mr-1.5">✦</span>
              {t('forYou')}
            </h2>
          )}
        </div>

        <FeedScroller
          feedUrl={`/api/social/feed/explore${normalizedTag ? `?tag=${encodeURIComponent(normalizedTag)}` : ''}`}
          initialDocs={postsResult.docs as PostData[]}
          initialTotalPages={postsResult.totalPages as number}
          initialPage={1}
          currentUserId={user ? Number(user.id) : null}
        />
      </section>
    </AppShell>
  )
}
