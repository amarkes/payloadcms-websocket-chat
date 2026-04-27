/* eslint-disable @typescript-eslint/no-explicit-any */

import { headers as getHeaders } from 'next/headers.js'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import type { Media, User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import FollowButton from '@/components/social/FollowButton'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import StoriesRail from '@/components/social/StoriesRail'
import ProfileTabs from '@/components/profile/ProfileTabs'
import type { PostData } from '@/components/social/PostCard'
import { getActiveStoriesForAuthorIds } from '@/lib/social-stories'
import { BadgeCheck, Link2, Calendar, Mail } from 'lucide-react'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params
  return { title: `@${username} — VibeStream` }
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user: currentUser } = await payload.auth({ headers })
  const t = await getTranslations('profile')
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
      followState = followResult.docs[0].status === 'accepted' ? 'following' : 'pending'
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
    const [postsResult, reelsResult] = await Promise.all([
      p.find({
        collection: 'posts',
        where: {
          and: [{ author: { equals: profileUser.id } }, { isArchived: { equals: false } }],
        },
        sort: '-createdAt',
        depth: 1,
        page: 1,
        limit: 12,
        overrideAccess: currentUser ? false : true,
        ...(currentUser ? { user: currentUser } : {}),
      }),
      p.find({
        collection: 'reels',
        where: { author: { equals: profileUser.id } },
        sort: '-createdAt',
        depth: 1,
        limit: 6,
        overrideAccess: currentUser ? false : true,
        ...(currentUser ? { user: currentUser } : {}),
      }),
    ])

    posts = postsResult.docs as PostData[]
    reels = reelsResult.docs
    totalPosts = postsResult.totalDocs
    storyGroups = await getActiveStoriesForAuthorIds({
      authorIds: [profileUser.id],
      payload,
      viewerId: currentUser?.id ?? null,
    })
  }

  // Current viewer info
  const viewerUser = currentUser
    ? ((await payload.findByID({
        collection: 'users',
        id: currentUser.id,
        depth: 1,
        overrideAccess: true,
      })) as User & { username?: string | null; avatar?: { filename?: string | null } | null })
    : null

  const viewerAvatarUrl = viewerUser?.avatar?.filename
    ? `/api/media/file/${viewerUser.avatar.filename}`
    : null

  const avatarUrl =
    profileUser.avatar && typeof profileUser.avatar === 'object'
      ? `/api/media/file/${(profileUser.avatar as Media).filename}`
      : null

  const displayName = profileUser.name || profileUser.email
  const followers = profileUser.followersCount ?? 0
  const following = profileUser.followingCount ?? 0
  const postsCount = profileUser.postsCount ?? totalPosts

  const joinedDate = profileUser.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null

  return (
    <AppShell username={viewerUser?.username ?? currentUser?.email} avatarUrl={viewerAvatarUrl}>
      <SocialRealtimeBridge />

      {/* Cover banner */}
      <div className="relative h-40 rounded-2xl overflow-hidden bg-linear-to-br from-tertiary/60 via-primary/30 to-secondary/40 mb-0 border border-neutral-300/20">
        <div className="absolute inset-0 bg-neutral-900/20" />
      </div>

      {/* Profile header card */}
      <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 px-6 pt-0 pb-5 -mt-6 mb-4">
        <div className="flex items-end justify-between -mt-10 mb-4">
          {/* Avatar */}
          <div className="relative">
            {avatarUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-neutral-200">
                <Image src={avatarUrl} alt={displayName} width={80} height={80} className="object-cover w-full h-full" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-neutral-200 bg-tertiary flex items-center justify-center text-neutral-100 font-bold text-3xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-12">
            {isOwnProfile ? (
              <Link
                href="/settings/profile"
                className="px-4 py-1.5 rounded-lg border border-neutral-300/30 text-sm font-semibold text-neutral-700 hover:bg-neutral-300/20 transition-colors"
              >
                {t('editProfile')}
              </Link>
            ) : (
              <>
                {currentUser && followState !== null && (
                  <FollowButton targetUserId={Number(profileUser.id)} initialState={followState} />
                )}
                <Link
                  href={`/chat/new?userId=${profileUser.id}`}
                  className="w-9 h-9 rounded-lg border border-neutral-300/20 bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <Mail size={16} />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Name & handle */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h1 className="text-lg font-bold text-neutral-900" style={{ fontFamily: 'var(--font-headline)' }}>
              {displayName}
            </h1>
            <BadgeCheck size={16} className="text-primary shrink-0" />
          </div>
          <p className="text-sm text-neutral-500">@{profileUser.username}</p>
        </div>

        {/* Bio */}
        {profileUser.bio && (
          <p className="text-sm text-neutral-700 leading-relaxed mb-3">{profileUser.bio}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-xs text-neutral-500 mb-4">
          {profileUser.website && (
            <a
              href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Link2 size={12} />
              {profileUser.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {joinedDate && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {t('joinedAt')} {joinedDate}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          {[
            { label: t('posts'), value: postsCount },
            { label: t('followers'), value: followers },
            { label: t('following'), value: following },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-base font-bold text-neutral-900">{value.toLocaleString()}</p>
              <p className="text-xs text-neutral-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Private guard */}
      {isPrivateAndNotFollowing ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-neutral-300/20 bg-neutral-200">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-base font-semibold text-neutral-800 mb-1">{t('privateAccount')}</p>
          <p className="text-sm text-neutral-500">{t('privateAccountSub')}</p>
        </div>
      ) : (
        <>
          {storyGroups.length > 0 && (
            <div className="mb-4">
              <StoriesRail groups={storyGroups} title={t('stories')} />
            </div>
          )}

          <ProfileTabs
            posts={posts}
            reels={reels}
            profileUsername={profileUser.username}
            noPostsLabel={t('noPostsYet')}
            noReelsLabel={t('noReelsYet')}
            postsLabel={t('posts')}
            reelsLabel={t('reels')}
            taggedLabel={t('tagged')}
            viewAllLabel={t('viewAll')}
          />
        </>
      )}
    </AppShell>
  )
}
