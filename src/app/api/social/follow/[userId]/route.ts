// NOTE: 'follows' collection slug is not yet in Payload-generated types.
// Remove the `as any` casts after running `pnpm generate:types`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

/**
 * POST /api/social/follow/[userId]
 *
 * Toggle follow on a user:
 *  - Not following → follow  (status = pending if private profile, accepted otherwise)
 *  - Pending request → cancel request
 *  - Following → unfollow
 *
 * Response: { action: 'followed' | 'request_sent' | 'unfollowed' | 'request_cancelled' }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const { userId } = await params

  if (String(user.id) === userId) {
    return NextResponse.json({ message: 'Voce nao pode seguir a si mesmo.' }, { status: 400 })
  }

  // Verify target user exists
  let targetUser: { isPrivate?: boolean }
  try {
    targetUser = (await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
      depth: 0,
    })) as any
  } catch {
    return NextResponse.json({ message: 'Usuario nao encontrado.' }, { status: 404 })
  }

  const p = payload as any

  // Check if a follow relationship already exists
  const existing = await p.find({
    collection: 'follows',
    where: {
      and: [
        { follower: { equals: user.id } },
        { following: { equals: userId } },
      ],
    },
    overrideAccess: false,
    user,
    depth: 0,
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const follow = existing.docs[0]
    await p.delete({
      collection: 'follows',
      id: follow.id,
      overrideAccess: false,
      user,
    })

    const action = follow.status === 'accepted' ? 'unfollowed' : 'request_cancelled'
    return NextResponse.json({ action })
  }

  // Create new follow
  const status = targetUser.isPrivate ? 'pending' : 'accepted'
  const newFollow = await p.create({
    collection: 'follows',
    data: {
      follower: user.id,
      following: Number(userId),
      status,
    },
    overrideAccess: false,
    user,
  })

  const action = status === 'pending' ? 'request_sent' : 'followed'
  return NextResponse.json({ action, followId: newFollow.id })
}
