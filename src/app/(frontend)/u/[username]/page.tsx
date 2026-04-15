/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers as getHeaders } from 'next/headers.js'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Media } from '@/payload-types'
import FollowButton from '@/components/social/FollowButton'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import StoriesRail from '@/components/social/StoriesRail'
import type { PostData } from '@/components/social/PostCard'
import { getActiveStoriesForAuthorIds } from '@/lib/social-stories'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params
  return { title: `@${username}` }
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user: currentUser } = await payload.auth({ headers })
  const p = payload as any

  const result = await p.find({
    collection: 'users',
    where: { username: { equals: username } },
    overrideAccess: true,
    depth: 1,
    limit: 1,
  })

  const profileUser = result.docs[0]
  if (!profileUser) notFound()

  const isOwnProfile = currentUser && String(currentUser.id) === String(profileUser.id)

  type FollowState = 'following' | 'pending' | 'not_following'
  let followState: FollowState | null = null

  if (currentUser && !isOwnProfile) {
    const followResult = await p.find({
      collection: 'follows',
      where: {
        and: [
          { follower: { equals: currentUser.id } },
          { following: { equals: profileUser.id } },
        ],
      },
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })

    if (followResult.docs.length > 0) {
      const status = followResult.docs[0].status
      followState = status === 'accepted' ? 'following' : 'pending'
    } else {
      followState = 'not_following'
    }
  }

  const isPrivateAndNotFollowing =
    profileUser.isPrivate && followState !== 'following' && !isOwnProfile

  let posts: PostData[] = []
  let reels: any[] = []
  let storyGroups = [] as Awaited<ReturnType<typeof getActiveStoriesForAuthorIds>>
  let totalPosts = 0

  if (!isPrivateAndNotFollowing) {
    const postsResult = await p.find({
      collection: 'posts',
      where: {
        and: [
          { author: { equals: profileUser.id } },
          { isArchived: { equals: false } },
        ],
      },
      sort: '-createdAt',
      depth: 1,
      page: 1,
      limit: 12,
      overrideAccess: currentUser ? false : true,
      ...(currentUser ? { user: currentUser } : {}),
    })

    const reelsResult = await p.find({
      collection: 'reels',
      where: {
        author: {
          equals: profileUser.id,
        },
      },
      sort: '-createdAt',
      depth: 1,
      limit: 6,
      overrideAccess: currentUser ? false : true,
      ...(currentUser ? { user: currentUser } : {}),
    })

    posts = postsResult.docs as PostData[]
    reels = reelsResult.docs
    totalPosts = postsResult.totalDocs
    storyGroups = await getActiveStoriesForAuthorIds({
      authorIds: [profileUser.id],
      payload,
      viewerId: currentUser?.id ?? null,
    })
  }

  const avatarUrl =
    profileUser.avatar && typeof profileUser.avatar === 'object'
      ? `/api/media/file/${(profileUser.avatar as Media).filename}`
      : null

  const displayName = profileUser.name || profileUser.email
  const followers = profileUser.followersCount ?? 0
  const following = profileUser.followingCount ?? 0
  const postsCount = profileUser.postsCount ?? totalPosts

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
          height: 56,
          gap: 12,
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
        <Link href="/reels" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>
          Reels
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          {isOwnProfile && (
            <Link
              href="/settings/profile"
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid #334155',
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: 13,
              }}
            >
              Editar perfil
            </Link>
          )}
          {currentUser && !isOwnProfile && followState !== null && (
            <FollowButton targetUserId={Number(profileUser.id)} initialState={followState} />
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 48px' }}>
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginBottom: 32,
            alignItems: 'flex-start',
          }}
        >
          {avatarUrl ? (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                border: '3px solid #1f2a3a',
              }}
            >
              <Image src={avatarUrl} alt={displayName} fill sizes="96px" style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 36,
                flexShrink: 0,
                border: '3px solid #1f2a3a',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{displayName}</div>
            <div style={{ color: '#64748b', fontSize: 14, marginBottom: 10 }}>@{profileUser.username}</div>

            {profileUser.bio && (
              <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px' }}>
                {profileUser.bio}
              </p>
            )}

            {profileUser.website && (
              <a
                href={
                  profileUser.website.startsWith('http')
                    ? profileUser.website
                    : `https://${profileUser.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'none' }}
              >
                🔗 {profileUser.website}
              </a>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 32,
            marginBottom: 24,
            padding: '16px 20px',
            background: '#0f1724',
            borderRadius: 16,
            border: '1px solid #1f2a3a',
          }}
        >
          {[
            { label: 'Posts', value: postsCount },
            { label: 'Reels', value: reels.length },
            { label: 'Seguidores', value: followers },
            { label: 'Seguindo', value: following },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
            </div>
          ))}
        </div>

        {isPrivateAndNotFollowing ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15 }}>Este perfil e privado.</p>
            {currentUser && <p style={{ fontSize: 13, marginTop: 6 }}>Siga este usuario para ver o conteúdo.</p>}
          </div>
        ) : (
          <>
            <StoriesRail groups={storyGroups} title="Stories ativas" />

            <section style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Reels</h2>
                <Link
                  href={`/reels?username=${encodeURIComponent(profileUser.username)}`}
                  style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }}
                >
                  Ver todos
                </Link>
              </div>

              {reels.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    background: 'rgba(15, 23, 36, 0.88)',
                    color: '#64748b',
                    border: '1px solid #1f2a3a',
                  }}
                >
                  Nenhum reel publicado ainda.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {reels.map((reel) => (
                    <Link
                      key={reel.id}
                      href={`/reels?username=${encodeURIComponent(profileUser.username)}`}
                      style={{
                        display: 'block',
                        aspectRatio: '9 / 16',
                        borderRadius: 18,
                        overflow: 'hidden',
                        position: 'relative',
                        textDecoration: 'none',
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {reel.thumbnail?.filename ? (
                        <Image
                          src={`/api/media/file/${reel.thumbnail.filename}`}
                          alt={reel.caption || 'Reel'}
                          fill
                          sizes="33vw"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1d4ed8, #22d3ee)' }} />
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.78))',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: 12,
                        }}
                      >
                        <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.4 }}>
                          {reel.caption || 'Assistir reel'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 700 }}>Posts</h2>

              {posts.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    background: 'rgba(15, 23, 36, 0.88)',
                    color: '#64748b',
                    border: '1px solid #1f2a3a',
                  }}
                >
                  Nenhum post ainda.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                  }}
                >
                  {posts.map((post) => {
                    const firstMedia = post.media?.[0]?.file?.filename

                    return (
                      <Link
                        key={post.id}
                        href="/feed"
                        style={{
                          display: 'block',
                          aspectRatio: '1 / 1',
                          background: '#121826',
                          overflow: 'hidden',
                          position: 'relative',
                          textDecoration: 'none',
                          borderRadius: 18,
                        }}
                      >
                        {firstMedia ? (
                          <Image
                            src={`/api/media/file/${firstMedia}`}
                            alt={post.caption || 'Post'}
                            fill
                            sizes="33vw"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 10,
                              color: '#94a3b8',
                              fontSize: 11,
                              lineHeight: 1.4,
                              overflow: 'hidden',
                              textAlign: 'center',
                            }}
                          >
                            {post.caption?.slice(0, 60) || 'Sem mídia'}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
