/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BasePayload, PayloadRequest } from 'payload'

export type ReactionTargetType = 'post' | 'reel' | 'comment'
export type CommentTargetType = 'post' | 'reel'

export const reactionTargetCollectionMap: Record<ReactionTargetType, 'posts' | 'reels' | 'comments'> = {
  post: 'posts',
  reel: 'reels',
  comment: 'comments',
}

export const commentTargetCollectionMap: Record<CommentTargetType, 'posts' | 'reels'> = {
  post: 'posts',
  reel: 'reels',
}

export async function getReactionCountsForTarget(
  payload: BasePayload,
  targetType: ReactionTargetType,
  targetId: string | number,
  req?: PayloadRequest,
) {
  const collection = reactionTargetCollectionMap[targetType]
  const doc = await (payload as any).findByID({
    collection,
    id: targetId,
    depth: 0,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  return {
    likesCount: Number(doc?.likesCount ?? 0),
    dislikesCount: Number(doc?.dislikesCount ?? 0),
  }
}
