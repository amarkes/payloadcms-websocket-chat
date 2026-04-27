/* eslint-disable @typescript-eslint/no-explicit-any */

type PayloadLike = {
  find: (args: any) => Promise<{ docs: any[] }>
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

export async function enrichReelsWithComments<T extends { id: string | number }>(
  payload: PayloadLike,
  user: unknown,
  reels: T[],
): Promise<T[]> {
  if (reels.length === 0) return reels

  const reelIds = reels.map((reel) => String(reel.id))
  const commentsResult = await payload.find({
    collection: 'comments',
    where: {
      and: [
        { targetType: { equals: 'reel' } },
        { targetId: { in: reelIds } },
        { parent: { exists: false } },
        { isDeleted: { not_equals: true } },
      ],
    },
    depth: 2,
    limit: 500,
    sort: 'createdAt',
    overrideAccess: user ? false : true,
    ...(user ? { user } : {}),
  })

  const commentsByReel = new Map<string, any[]>()

  for (const comment of commentsResult.docs) {
    const author = normalizeUser(comment.author)
    if (!author) continue

    const targetId = String(comment.targetId)
    const comments = commentsByReel.get(targetId) ?? []
    comments.push({
      id: Number(comment.id),
      content: comment.content,
      createdAt: comment.createdAt,
      author,
    })
    commentsByReel.set(targetId, comments)
  }

  return reels.map((reel) => ({
    ...reel,
    comments: commentsByReel.get(String(reel.id)) ?? [],
  }))
}

