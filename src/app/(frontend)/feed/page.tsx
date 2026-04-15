/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import FeedScroller from '@/components/social/FeedScroller'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import StoriesRail from '@/components/social/StoriesRail'
import type { PostData } from '@/components/social/PostCard'
import { getFeedStoryGroups } from '@/lib/social-stories'

export default async function FeedPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

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

  let initialDocs: PostData[] = []
  let initialTotalPages = 0
  const userReactions: Record<string, 'like' | 'dislike'> = {}

  if (followingIds.length > 0) {
    const postsResult = await p.find({
      collection: 'posts',
      where: {
        and: [{ author: { in: followingIds } }, { isArchived: { equals: false } }],
      },
      sort: '-createdAt',
      depth: 1,
      page: 1,
      limit: 10,
      overrideAccess: false,
      user,
    })

    initialDocs = postsResult.docs as PostData[]
    initialTotalPages = postsResult.totalPages

    if (initialDocs.length > 0) {
      const postIds = initialDocs.map((doc) => String(doc.id))
      const reactionsResult = await p.find({
        collection: 'reactions',
        where: {
          and: [
            { user: { equals: user.id } },
            { targetType: { equals: 'post' } },
            { targetId: { in: postIds } },
          ],
        },
        overrideAccess: true,
        depth: 0,
        limit: postIds.length,
      })

      for (const reaction of reactionsResult.docs) {
        userReactions[String(reaction.targetId)] = reaction.type as 'like' | 'dislike'
      }
    }
  }

  const storyGroups = await getFeedStoryGroups(payload, user.id)

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })) as User & { username?: string | null }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top, rgba(31, 122, 236, 0.10), transparent 30%), #05070d',
        color: '#f5f7fb',
        fontFamily: 'sans-serif',
      }}
    >
      <SocialRealtimeBridge />

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(5, 7, 13, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1f2a3a',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 56,
        }}
      >
        <Link href="/" style={{ color: '#f5f7fb', textDecoration: 'none', fontWeight: 700, fontSize: 18 }}>
          ◎
        </Link>
        <Link href="/feed" style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Feed
        </Link>
        <Link href="/explore" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Explorar
        </Link>
        <Link href="/reels" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Reels
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/feed/new"
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              background: '#0070f3',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            + Novo post
          </Link>
          <Link
            href={`/u/${fullUser.username || user.email}`}
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}
          >
            Meu perfil
          </Link>
          <Link
            href="/settings/profile"
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}
          >
            Configuracoes
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>
        <StoriesRail groups={storyGroups} title="Stories ativas" />

        {followingIds.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 16 }}>
              Voce ainda nao segue ninguem.
            </p>
            <Link
              href="/explore"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#0070f3',
                color: '#fff',
                borderRadius: 999,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Explorar posts
            </Link>
          </div>
        ) : (
          <FeedScroller
            feedUrl="/api/social/feed"
            initialDocs={initialDocs}
            initialTotalPages={initialTotalPages}
            initialPage={1}
            currentUserId={Number(user.id)}
            initialUserReactions={userReactions}
          />
        )}
      </div>
    </div>
  )
}
