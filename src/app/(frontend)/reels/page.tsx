/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import config from '@/payload.config'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import ReelPlayer, { type ReelData } from '@/components/social/ReelPlayer'

interface ReelsPageProps {
  searchParams: Promise<{ username?: string }>
}

export default async function ReelsPage({ searchParams }: ReelsPageProps) {
  const { username } = await searchParams
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const p = payload as any

  let authorId: string | number | null = null

  if (username) {
    const authorResult = await p.find({
      collection: 'users',
      where: {
        username: {
          equals: username,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    authorId = authorResult.docs[0]?.id ?? null
  }

  const reelsResult = await p.find({
    collection: 'reels',
    where: authorId
      ? {
          author: {
            equals: authorId,
          },
        }
      : undefined,
    sort: '-createdAt',
    depth: 1,
    limit: 20,
    overrideAccess: user ? false : true,
    ...(user ? { user } : {}),
  })

  const reactionMap: Record<string, 'like' | 'dislike'> = {}

  if (user && reelsResult.docs.length > 0) {
    const reelIds = reelsResult.docs.map((reel: any) => String(reel.id))
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

  const title = username ? `Reels de @${username}` : 'Reels'

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
        <Link href="/feed" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Feed
        </Link>
        <Link href="/explore" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Explorar
        </Link>
        <Link href="/reels" style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Reels
        </Link>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
            Vídeos curtos com player inline e reações em tempo real.
          </p>
        </div>

        {reelsResult.docs.length === 0 ? (
          <div
            style={{
              padding: 28,
              borderRadius: 24,
              background: 'rgba(7, 11, 19, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.14)',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            Nenhum reel disponível agora.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {reelsResult.docs.map((reel: ReelData) => (
              <ReelPlayer
                key={reel.id}
                reel={reel}
                currentUserId={user ? Number(user.id) : null}
                initialUserReaction={reactionMap[String(reel.id)] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
