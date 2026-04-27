/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import PostComposer from '@/components/feed/PostComposer'
import TrendingTopics from '@/components/widgets/TrendingTopics'
import WhoToFollow from '@/components/widgets/WhoToFollow'
import FeedScroller from '@/components/social/FeedScroller'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import StoriesRail from '@/components/social/StoriesRail'
import type { PostData } from '@/components/social/PostCard'
import { enrichPostsWithSocialDetails } from '@/lib/social-feed'
import { getFeedStoryGroups } from '@/lib/social-stories'

export default async function FeedPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

  const t = await getTranslations('feed')

  const p = payload as any

  const followsResult = await p.find({
    collection: 'follows',
    where: {
      and: [{ follower: { equals: user.id } }, { status: { equals: 'accepted' } }],
    },
    overrideAccess: true,
    depth: 0,
    limit: 2000,
  })

  const followingIds: Array<string | number> = followsResult.docs.map((follow: any) => {
    const value = follow.following
    return typeof value === 'object' && value !== null ? value.id : value
  })

  // Include own posts in the feed
  const feedAuthorIds = [user.id, ...followingIds]

  let initialDocs: PostData[] = []
  let initialTotalPages = 0
  const userReactions: Record<string, NonNullable<PostData['currentUserReaction']> | null> = {}

  {
    const postsResult = await p.find({
      collection: 'posts',
      where: {
        and: [{ author: { in: feedAuthorIds } }, { isArchived: { equals: false } }],
      },
      sort: '-createdAt',
      depth: 1,
      page: 1,
      limit: 10,
      overrideAccess: false,
      user,
    })

    initialDocs = await enrichPostsWithSocialDetails(p, user, postsResult.docs as PostData[])
    initialTotalPages = postsResult.totalPages

    if (initialDocs.length > 0) {
      for (const post of initialDocs) {
        userReactions[String(post.id)] = post.currentUserReaction ?? null
      }
    }
  }

  const storyGroups = await getFeedStoryGroups(payload, user.id)

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: true,
  })) as User & { username?: string | null; avatar?: { filename?: string | null } | null }

  const avatarUrl = fullUser.avatar?.filename
    ? `/api/media/file/${fullUser.avatar.filename}`
    : null

  const rightPanel = (
    <>
      <TrendingTopics />
      <WhoToFollow currentUserId={user.id} followingIds={followingIds} />
    </>
  )

  return (
    <AppShell
      username={fullUser.username ?? user.email}
      avatarUrl={avatarUrl}
      rightPanel={rightPanel}
    >
      <SocialRealtimeBridge />

      <PostComposer avatarUrl={avatarUrl} username={fullUser.username ?? user.email} />

      {storyGroups.length > 0 && (
        <StoriesRail groups={storyGroups} title={t('stories')} />
      )}

      <FeedScroller
        feedUrl="/api/social/feed"
        initialDocs={initialDocs}
        initialTotalPages={initialTotalPages}
        initialPage={1}
        currentUserId={Number(user.id)}
        initialUserReactions={userReactions}
      />

      {initialDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <p className="text-neutral-600 text-base mb-4">{t('emptyDescription')}</p>
          <Link
            href="/explore"
            className="inline-block px-6 py-2.5 bg-primary text-neutral rounded-full font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {t('explore')}
          </Link>
        </div>
      )}
    </AppShell>
  )
}
