/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'
import { canAccessUserSocialContent } from '@/lib/social-access'
import { normalizeRelationshipIds } from '@/lib/social-utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const { id } = await params
  const storyId = Number(id)

  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ message: 'ID de story invalido.' }, { status: 400 })
  }

  const p = payload as any
  const story = await p.findByID({
    collection: 'stories',
    id: storyId,
    depth: 1,
    overrideAccess: true,
  })

  if (!story) {
    return NextResponse.json({ message: 'Story nao encontrada.' }, { status: 404 })
  }

  if (new Date(story.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ message: 'Story expirada.' }, { status: 410 })
  }

  const author =
    typeof story.author === 'object' && story.author !== null ? story.author : { id: story.author }

  const canAccess = await canAccessUserSocialContent({
    currentUserId: user.id,
    ownerId: author.id,
    ownerIsPrivate: author.isPrivate,
    payload,
  })

  if (!canAccess) {
    return NextResponse.json({ message: 'Sem permissao para visualizar esta story.' }, { status: 403 })
  }

  const viewedBy = normalizeRelationshipIds(story.viewedBy)
  const alreadyViewed = viewedBy.some((entry) => String(entry) === String(user.id))

  if (alreadyViewed) {
    return NextResponse.json({
      viewed: true,
      viewsCount: Number(story.viewsCount ?? viewedBy.length),
    })
  }

  const nextViewedBy = [...viewedBy, user.id]
  const updated = await p.update({
    collection: 'stories',
    id: storyId,
    data: {
      viewedBy: nextViewedBy,
      viewsCount: Math.max(Number(story.viewsCount ?? viewedBy.length), viewedBy.length) + 1,
    },
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({
    viewed: true,
    viewsCount: Number(updated.viewsCount ?? nextViewedBy.length),
  })
}
