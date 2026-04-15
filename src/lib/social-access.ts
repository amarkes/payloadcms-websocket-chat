/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BasePayload, Where } from 'payload'

export async function getAcceptedFollowingIds(
  payload: BasePayload,
  userId: string | number,
): Promise<Array<string | number>> {
  const result = await (payload as any).find({
    collection: 'follows',
    where: {
      and: [{ follower: { equals: userId } }, { status: { equals: 'accepted' } }],
    },
    overrideAccess: true,
    depth: 0,
    limit: 2000,
  })

  return result.docs
    .map((follow: { following?: unknown }) => {
      const value = follow.following
      if (typeof value === 'object' && value !== null && 'id' in value) {
        return (value as { id: string | number }).id
      }
      return value
    })
    .filter((entry: unknown): entry is string | number => typeof entry === 'string' || typeof entry === 'number')
}

export function buildVisibilityWhere({
  archivedField,
  followingIds,
  userId,
}: {
  archivedField?: string
  followingIds: Array<string | number>
  userId: string | number
}): Where {
  const conditions: Where[] = [
    {
      or: [
        { visibility: { equals: 'public' } } as Where,
        {
          and: [
            { visibility: { equals: 'followers' } } as Where,
            { author: { in: [userId, ...followingIds] } } as Where,
          ],
        } as Where,
        {
          and: [
            { visibility: { equals: 'private' } } as Where,
            { author: { equals: userId } } as Where,
          ],
        } as Where,
      ],
    } as Where,
  ]

  if (archivedField) {
    conditions.unshift({ [archivedField]: { equals: false } } as Where)
  }

  return { and: conditions } as Where
}

export async function canAccessUserSocialContent({
  currentUserId,
  ownerId,
  ownerIsPrivate,
  payload,
}: {
  currentUserId?: string | number | null
  ownerId: string | number
  ownerIsPrivate?: boolean | null
  payload: BasePayload
}): Promise<boolean> {
  if (!ownerIsPrivate) return true
  if (!currentUserId) return false
  if (String(currentUserId) === String(ownerId)) return true

  const follows = await (payload as any).find({
    collection: 'follows',
    where: {
      and: [
        { follower: { equals: currentUserId } },
        { following: { equals: ownerId } },
        { status: { equals: 'accepted' } },
      ],
    },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  })

  return follows.docs.length > 0
}
