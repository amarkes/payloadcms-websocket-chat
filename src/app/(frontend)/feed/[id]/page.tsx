/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { headers as getHeaders } from 'next/headers.js'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import AppShell from '@/components/layout/AppShell'
import SocialRealtimeBridge from '@/components/social/SocialRealtimeBridge'
import PostCard, { type PostData } from '@/components/social/PostCard'
import { enrichPostsWithSocialDetails } from '@/lib/social-feed'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return { title: `Post ${id} - VibeStream` }
}

function formatDate(iso?: string | null) {
  if (!iso) return 'Sem data'

  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAuthor(post: PostData) {
  return post.author.name || post.author.username || post.author.email
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params
  const postId = Number(id)

  if (!Number.isFinite(postId)) notFound()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

  const p = payload as any

  let post: PostData | null = null

  try {
    const found = await p.findByID({
      collection: 'posts',
      id: postId,
      depth: 1,
      overrideAccess: false,
      user,
    })

    if (!found || found.isArchived) notFound()

    const [enrichedPost] = await enrichPostsWithSocialDetails(p, user, [found as PostData])
    post = enrichedPost
  } catch {
    notFound()
  }

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: true,
  })) as User & { username?: string | null; avatar?: { filename?: string | null } | null }

  const avatarUrl = fullUser.avatar?.filename ? `/api/media/file/${fullUser.avatar.filename}` : null

  const mediaCount = post.media?.filter((item) => item.file?.filename).length ?? 0
  const totalReactions = post.reactionSummaries?.reduce((total, item) => total + item.count, 0) ?? 0
  const replyCount =
    post.comments?.reduce((total, comment) => total + (comment.replies?.length ?? 0), 0) ?? 0

  return (
    <AppShell username={fullUser.username ?? user.email} avatarUrl={avatarUrl}>
      <SocialRealtimeBridge />

      <div className="mb-4">
        <Link
          href="/feed"
          className="text-sm font-semibold text-neutral-500 hover:text-primary transition-colors"
        >
          Voltar para o feed
        </Link>
      </div>

      <section className="rounded-2xl border border-neutral-300/20 bg-neutral-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Detalhe do post</p>
            <h1 className="text-lg font-bold text-neutral-900">Post de {getAuthor(post)}</h1>
          </div>
          <Link
            href={`/u/${post.author.username || post.author.email}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            @{post.author.username || post.author.email}
          </Link>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div>
            <dt className="text-xs text-neutral-500">Criado em</dt>
            <dd className="text-sm font-semibold text-neutral-800">{formatDate(post.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Visibilidade</dt>
            <dd className="text-sm font-semibold text-neutral-800">
              {post.visibility === 'public'
                ? 'Publico'
                : post.visibility === 'followers'
                  ? 'Seguidores'
                  : 'Privado'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Midias</dt>
            <dd className="text-sm font-semibold text-neutral-800">{mediaCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Interacoes</dt>
            <dd className="text-sm font-semibold text-neutral-800">
              {totalReactions} reacoes, {post.commentsCount ?? 0} comentarios, {replyCount}{' '}
              respostas
            </dd>
          </div>
        </dl>
      </section>

      <PostCard
        post={post}
        currentUserId={Number(user.id)}
        initialUserReaction={post.currentUserReaction ?? null}
        commentsPreviewLimit={5}
        showDetailLink={false}
      />
    </AppShell>
  )
}
