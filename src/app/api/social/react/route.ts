// NOTE: 'reactions' collection slug is not yet in Payload-generated types.
// Remove the `as any` casts after running `pnpm generate:types`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'
import { enrichPostsWithSocialDetails } from '@/lib/social-feed'

type ReactionType = 'like' | 'dislike' | 'emoji'
type TargetType = 'post' | 'reel' | 'comment'

interface ReactBody {
  targetType: TargetType
  targetId: string
  type: ReactionType
  emoji?: string
}

/**
 * POST /api/social/react
 * Body: { targetType: 'post'|'reel'|'comment', targetId: string, type: 'like'|'dislike'|'emoji', emoji? }
 *
 * Toggle / switch reaction:
 *  - No existing reaction → create it   → { action: 'added',   type }
 *  - Same type exists     → remove it   → { action: 'removed', type }
 *  - Different type       → switch type → { action: 'changed', type }
 */
export async function POST(request: Request) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }
  const authenticatedUser = user

  let body: Partial<ReactBody>
  try {
    body = (await request.json()) as Partial<ReactBody>
  } catch {
    return NextResponse.json({ message: 'Body invalido.' }, { status: 400 })
  }

  const { targetType, targetId, type } = body
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : ''

  if (!targetType || !targetId || !type) {
    return NextResponse.json(
      { message: 'Campos obrigatorios: targetType, targetId, type.' },
      { status: 400 },
    )
  }

  const validTargetTypes: TargetType[] = ['post', 'reel', 'comment']
  const validTypes: ReactionType[] = ['like', 'dislike', 'emoji']

  if (!validTargetTypes.includes(targetType) || !validTypes.includes(type)) {
    return NextResponse.json(
      { message: 'Valores invalidos para targetType ou type.' },
      { status: 400 },
    )
  }

  const standardEmojis = ['❤️', '😂', '😮', '😢', '🔥']

  if (type === 'emoji' && !standardEmojis.includes(emoji)) {
    return NextResponse.json({ message: 'Emoji invalido.' }, { status: 400 })
  }

  const targetIdValue = String(targetId)
  const reactionKey = `${user.id}:${targetType}:${targetIdValue}`
  const p = payload as any

  async function getPostReactionDetails() {
    if (targetType !== 'post') return null
    const [details] = await enrichPostsWithSocialDetails(
      p,
      { id: authenticatedUser.id as string | number },
      [{ id: targetIdValue }],
    )
    return details
  }

  // Find existing reaction by the unique key
  const existing = await p.find({
    collection: 'reactions',
    where: { reactionKey: { equals: reactionKey } },
    overrideAccess: false,
    user,
    depth: 0,
    limit: 1,
  })

  // Toggle off: same reaction type already exists
  if (existing.docs.length > 0) {
    const reaction = existing.docs[0]

    if (reaction.type === type && (type !== 'emoji' || reaction.emoji === emoji)) {
      await p.delete({
        collection: 'reactions',
        id: reaction.id,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ action: 'removed', type, details: await getPostReactionDetails() })
    }

    // Switch type: like → dislike or vice-versa
    await p.update({
      collection: 'reactions',
      id: reaction.id,
      data: { type, emoji: type === 'emoji' ? emoji : null },
      overrideAccess: false,
      user,
    })
    return NextResponse.json({ action: 'changed', type, details: await getPostReactionDetails() })
  }

  // No existing reaction — create it
  await p.create({
    collection: 'reactions',
    data: {
      user: user.id,
      type,
      emoji: type === 'emoji' ? emoji : null,
      targetType,
      targetId: targetIdValue,
    },
    overrideAccess: false,
    user,
  })

  return NextResponse.json({ action: 'added', type, details: await getPostReactionDetails() })
}
