/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import ReelPlayer, { type ReelData } from '@/components/social/ReelPlayer'
import ReelsNavigator from '@/components/reels/ReelsNavigator'
import { enrichReelsWithComments } from '@/lib/social-reels'

interface ReelsPageProps {
  searchParams: Promise<{ username?: string }>
}

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const { username } = await searchParams
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const t = await getTranslations('reels')
  const p = payload as any

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

  let authorId: string | number | null = null
  if (username) {
    const authorResult = await p.find({
      collection: 'users',
      where: { username: { equals: username } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    authorId = authorResult.docs[0]?.id ?? null
  }

  const reelsResult = await p.find({
    collection: 'reels',
    where: authorId ? { author: { equals: authorId } } : undefined,
    sort: '-createdAt',
    depth: 1,
    limit: 20,
    overrideAccess: user ? false : true,
    ...(user ? { user } : {}),
  })
  const reels = await enrichReelsWithComments(
    p,
    user,
    reelsResult.docs as ReelData[],
  )

  const reactionMap: Record<string, 'like' | 'dislike'> = {}
  if (user && reels.length > 0) {
    const reelIds = reels.map((reel: any) => String(reel.id))
    const reactionsResult = await p.find({
      collection: 'reactions',
      where: {
        and: [
          { user: { equals: user.id } },
          { targetType: { equals: 'reel' } },
          { targetId: { in: reelIds } },
        ],
      },
      depth: 0,
      limit: reelIds.length,
      overrideAccess: true,
    })
    for (const reaction of reactionsResult.docs) {
      reactionMap[String(reaction.targetId)] = reaction.type as 'like' | 'dislike'
    }
  }

  return (
    <AppShell username={fullUser?.username ?? user?.email} avatarUrl={avatarUrl}>
      <SocialRealtimeBridge />

      {user && (
        <div className="mb-4 flex justify-end">
          <Link
            href="/reels/new"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-neutral hover:opacity-90"
          >
            + Novo reel
          </Link>
        </div>
      )}

      {reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center">
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-neutral-500 text-base">{t('empty')}</p>
          {user && (
            <Link
              href="/reels/new"
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-neutral hover:opacity-90"
            >
              Publicar primeiro reel
            </Link>
          )}
        </div>
      ) : (
        <ReelsNavigator
          reels={reels}
          currentUserId={user ? Number(user.id) : null}
          reactionMap={reactionMap}
          prevLabel={t('navigatePrev')}
          nextLabel={t('navigateNext')}
        />
      )}
    </AppShell>
  )
}
