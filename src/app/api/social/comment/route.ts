/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'
import { notifyCommentMentions } from '@/lib/social-notifications'

type TargetType = 'post' | 'reel'

type CommentBody = {
  targetType?: TargetType
  targetId?: string
  content?: string
  parentId?: string | number | null
}

function normalizeUser(value: any) {
  if (!value || typeof value !== 'object') return null

  return {
    id: Number(value.id),
    name: value.name ?? null,
    email: value.email ?? '',
    username: value.username ?? null,
    avatar:
      value.avatar && typeof value.avatar === 'object'
        ? { filename: value.avatar.filename ?? null }
        : null,
  }
}

export async function POST(request: Request) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  let body: CommentBody
  try {
    body = (await request.json()) as CommentBody
  } catch {
    return NextResponse.json({ message: 'Body invalido.' }, { status: 400 })
  }

  const targetType = body.targetType
  const targetId = String(body.targetId ?? '')
  const content = String(body.content ?? '').trim()
  const parentId = body.parentId ? String(body.parentId) : null

  if (!targetType || !['post', 'reel'].includes(targetType) || !targetId || !content) {
    return NextResponse.json({ message: 'Comentario invalido.' }, { status: 400 })
  }

  if (content.length > 500) {
    return NextResponse.json({ message: 'Comentario muito longo.' }, { status: 400 })
  }

  const p = payload as any
  let parent: any = null
  let rootParentId: number | undefined

  if (parentId) {
    const numericParentId = Number(parentId)
    if (!Number.isFinite(numericParentId)) {
      return NextResponse.json({ message: 'Comentario pai invalido.' }, { status: 400 })
    }

    parent = await p.findByID({
      collection: 'comments',
      id: numericParentId,
      overrideAccess: false,
      user,
      depth: 0,
    })

    if (
      !parent ||
      parent.targetType !== targetType ||
      String(parent.targetId) !== targetId ||
      parent.isDeleted
    ) {
      return NextResponse.json({ message: 'Comentario pai invalido.' }, { status: 400 })
    }

    const parentParentId =
      parent.parent && typeof parent.parent === 'object'
        ? Number(parent.parent.id)
        : parent.parent
          ? Number(parent.parent)
          : null
    rootParentId =
      parentParentId !== null && Number.isFinite(parentParentId)
        ? parentParentId
        : Number(parent.id)
  }

  const created = await p.create({
    collection: 'comments',
    data: {
      author: user.id,
      targetType,
      targetId,
      content,
      ...(rootParentId ? { parent: rootParentId } : {}),
    },
    overrideAccess: false,
    user,
    depth: 2,
  })

  await notifyCommentMentions({
    actor: normalizeUser(user) ?? user,
    commentId: created.id,
    content,
    payload: p,
    postId: targetId,
  })

  return NextResponse.json({
    comment: {
      id: Number(created.id),
      content: created.content,
      createdAt: created.createdAt,
      parentId: created.parent
        ? typeof created.parent === 'object'
          ? Number(created.parent.id)
          : Number(created.parent)
        : null,
      author: normalizeUser(created.author) ?? normalizeUser(user),
      replies: [],
    },
  })
}
