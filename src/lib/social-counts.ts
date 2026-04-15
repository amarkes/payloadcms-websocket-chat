// NOTE: collection slugs for social collections (posts, reels, comments) are not yet in
// the Payload-generated CollectionSlug union. Cast to `any` is intentional here and should
// be removed after running `pnpm generate:types` with the database connected.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BasePayload, PayloadRequest } from 'payload'

type SocialCollection = 'posts' | 'reels' | 'comments' | 'users'

/**
 * Increments or decrements a numeric counter field on a collection document.
 * Uses find-then-update (not atomic), adequate for Phase 1.
 */
export async function adjustCount(
  payload: BasePayload,
  collection: SocialCollection,
  id: string | number,
  field: string,
  delta: 1 | -1,
  req?: PayloadRequest,
): Promise<void> {
  try {
    if (id === null || id === undefined || id === '') {
      return
    }

    const p = payload as any
    const doc = await p.findByID({
      collection,
      id,
      overrideAccess: true,
      depth: 0,
      ...(req ? { req } : {}),
    })
    const current = doc?.[field]
    const next = Math.max(0, (typeof current === 'number' ? current : 0) + delta)
    await p.update({
      collection,
      id,
      data: { [field]: next },
      overrideAccess: true,
      depth: 0,
      ...(req ? { req } : {}),
    })
  } catch {
    // Best-effort — never throw from a counter update
  }
}

/**
 * Updates followersCount / followingCount on both users involved in a follow.
 */
export async function adjustFollowCounts(
  payload: BasePayload,
  followerId: string | number,
  followingId: string | number,
  delta: 1 | -1,
  req?: PayloadRequest,
): Promise<void> {
  await Promise.all([
    adjustCount(payload, 'users', followerId, 'followingCount', delta, req),
    adjustCount(payload, 'users', followingId, 'followersCount', delta, req),
  ])
}
