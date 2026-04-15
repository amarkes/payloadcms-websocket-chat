// NOTE: 'reactions' collection slug is not yet in Payload-generated types.
// Remove the `as any` casts after running `pnpm generate:types`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

type ReactionType = 'like' | 'dislike'
type TargetType = 'post' | 'reel' | 'comment'

interface ReactBody {
  targetType: TargetType
  targetId: string
  type: ReactionType
}

/**
 * POST /api/social/react
 * Body: { targetType: 'post'|'reel'|'comment', targetId: string, type: 'like'|'dislike' }
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

  let body: Partial<ReactBody>
  try {
    body = (await request.json()) as Partial<ReactBody>
  } catch {
    return NextResponse.json({ message: 'Body invalido.' }, { status: 400 })
  }

  const { targetType, targetId, type } = body

  if (!targetType || !targetId || !type) {
    return NextResponse.json(
      { message: 'Campos obrigatorios: targetType, targetId, type.' },
      { status: 400 },
    )
  }

  const validTargetTypes: TargetType[] = ['post', 'reel', 'comment']
  const validTypes: ReactionType[] = ['like', 'dislike']

  if (!validTargetTypes.includes(targetType) || !validTypes.includes(type)) {
    return NextResponse.json(
      { message: 'Valores invalidos para targetType ou type.' },
      { status: 400 },
    )
  }

  const reactionKey = `${user.id}:${targetType}:${targetId}`
  const p = payload as any

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

    if (reaction.type === type) {
      await p.delete({
        collection: 'reactions',
        id: reaction.id,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ action: 'removed', type })
    }

    // Switch type: like → dislike or vice-versa
    await p.update({
      collection: 'reactions',
      id: reaction.id,
      data: { type },
      overrideAccess: false,
      user,
    })
    return NextResponse.json({ action: 'changed', type })
  }

  // No existing reaction — create it
  await p.create({
    collection: 'reactions',
    data: {
      user: user.id,
      type,
      targetType,
      targetId: String(targetId),
    },
    overrideAccess: false,
    user,
  })

  return NextResponse.json({ action: 'added', type })
}
