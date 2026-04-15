/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import config from '@/payload.config'
import FeedScroller from '@/components/social/FeedScroller'
import type { PostData } from '@/components/social/PostCard'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'

interface ExplorePageProps {
  searchParams: Promise<{ tag?: string }>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const { tag } = await searchParams
  const normalizedTag = tag?.trim().toLowerCase() || ''

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  const p = payload as any

  const postsResult = await p.find({
    collection: 'posts',
    where: {
      and: [
        { visibility: { equals: 'public' } },
        { isArchived: { equals: false } },
        ...(normalizedTag ? [{ 'tags.tag': { equals: normalizedTag } }] : []),
      ],
    },
    sort: '-createdAt',
    depth: 1,
    page: 1,
    limit: 10,
    overrideAccess: true,
  })

  const featuredReels = await p.find({
    collection: 'reels',
    where: {
      visibility: {
        equals: 'public',
      },
    },
    sort: '-likesCount',
    depth: 1,
    limit: 4,
    overrideAccess: true,
  })

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
        <Link href="/explore" style={{ color: '#0070f3', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Explorar
        </Link>
        <Link href="/reels" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Reels
        </Link>
        {user && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
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
          </div>
        )}
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px 48px' }}>
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0, 1fr)',
          }}
        >
          <section
            style={{
              padding: 24,
              borderRadius: 24,
              border: '1px solid rgba(148, 163, 184, 0.14)',
              background: 'rgba(7, 11, 19, 0.9)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Explorar</h1>
                <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }}>
                  Descubra posts públicos e pesquise por hashtag.
                </p>
              </div>
              <Link href="/reels" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 14 }}>
                Ver reels
              </Link>
            </div>

            <form action="/explore" method="get" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input
                type="text"
                name="tag"
                defaultValue={normalizedTag}
                placeholder="Buscar hashtag, ex: design"
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  border: '1px solid #243041',
                  background: '#0f1724',
                  color: '#f8fafc',
                  padding: '0 14px',
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                style={{
                  minWidth: 120,
                  borderRadius: 14,
                  border: 'none',
                  background: '#1d4ed8',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Buscar
              </button>
            </form>

            {normalizedTag && (
              <div style={{ marginBottom: 18, color: '#cbd5e1', fontSize: 13 }}>
                Resultados para <strong>#{normalizedTag}</strong>
              </div>
            )}

            <FeedScroller
              feedUrl={`/api/social/feed/explore${normalizedTag ? `?tag=${encodeURIComponent(normalizedTag)}` : ''}`}
              initialDocs={postsResult.docs as PostData[]}
              initialTotalPages={postsResult.totalPages as number}
              initialPage={1}
              currentUserId={user ? Number(user.id) : null}
            />
          </section>

          {featuredReels.docs.length > 0 && (
            <section
              style={{
                padding: 20,
                borderRadius: 24,
                border: '1px solid rgba(148, 163, 184, 0.14)',
                background: 'rgba(7, 11, 19, 0.9)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Reels em alta</h2>
                <Link href="/reels" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }}>
                  Abrir página
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {featuredReels.docs.map((reel: any) => (
                  <Link
                    key={reel.id}
                    href={`/reels${reel.author?.username ? `?username=${reel.author.username}` : ''}`}
                    style={{
                      position: 'relative',
                      minHeight: 220,
                      borderRadius: 20,
                      overflow: 'hidden',
                      textDecoration: 'none',
                      background: '#0f172a',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {reel.thumbnail?.filename ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/file/${reel.thumbnail.filename}`}
                        alt={reel.caption || 'Reel'}
                        style={{ width: '100%', height: 220, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: 220, background: 'linear-gradient(135deg, #1d4ed8, #22d3ee)' }} />
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.74))',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
                          @{reel.author?.username || reel.author?.email}
                        </div>
                        <div style={{ fontWeight: 700, lineHeight: 1.4 }}>
                          {reel.caption || 'Assistir reel'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
