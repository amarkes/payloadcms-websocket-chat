/* eslint-disable @typescript-eslint/no-explicit-any */

type PayloadLike = {
  find: (args: any) => Promise<{ docs: any[] }>
}

type UserLike = {
  id: string | number
}

type ReactionSummary = {
  key: string
  type: 'like' | 'dislike' | 'emoji'
  emoji?: string | null
  count: number
  users: Array<{
    id: number
    name?: string | null
    email: string
    username?: string | null
    avatar?: { filename?: string | null } | null
  }>
}

type CommentSummary = {
  id: number
  targetId: string
  content: string
  createdAt: string
  parentId?: number | null
  author: NonNullable<ReturnType<typeof normalizeUser>>
  replies: CommentSummary[]
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

export async function enrichPostsWithSocialDetails<T extends { id: string | number }>(
  payload: PayloadLike,
  user: UserLike,
  posts: T[],
): Promise<T[]> {
  if (posts.length === 0) return posts

  const postIds = posts.map((post) => String(post.id))

  const [reactionsResult, commentsResult] = await Promise.all([
    payload.find({
      collection: 'reactions',
      where: {
        and: [{ targetType: { equals: 'post' } }, { targetId: { in: postIds } }],
      },
      overrideAccess: false,
      user,
      depth: 2,
      limit: 1000,
      sort: 'createdAt',
    }),
    payload.find({
      collection: 'comments',
      where: {
        and: [
          { targetType: { equals: 'post' } },
          { targetId: { in: postIds } },
          { isDeleted: { not_equals: true } },
        ],
      },
      overrideAccess: false,
      user,
      depth: 2,
      limit: 500,
      sort: 'createdAt',
    }),
  ])

  const reactionsByPost = new Map<string, ReactionSummary[]>()
  const currentReactionByPost = new Map<
    string,
    { type: 'like' | 'dislike' | 'emoji'; emoji?: string | null }
  >()

  for (const reaction of reactionsResult.docs) {
    const targetId = String(reaction.targetId)
    const type = reaction.type as 'like' | 'dislike' | 'emoji'
    const emoji = typeof reaction.emoji === 'string' ? reaction.emoji : null
    const key = type === 'emoji' ? `emoji:${emoji}` : type
    const userSummary = normalizeUser(reaction.user)

    if (String(userSummary?.id) === String(user.id)) {
      currentReactionByPost.set(targetId, { type, emoji })
    }

    if (!userSummary) continue

    const summaries = reactionsByPost.get(targetId) ?? []
    let summary = summaries.find((item) => item.key === key)

    if (!summary) {
      summary = { key, type, emoji, count: 0, users: [] }
      summaries.push(summary)
      reactionsByPost.set(targetId, summaries)
    }

    summary.count += 1
    summary.users.push(userSummary)
  }

  const commentsByPost = new Map<string, CommentSummary[]>()
  const commentsById = new Map<number, CommentSummary>()
  const pendingReplies: CommentSummary[] = []

  for (const comment of commentsResult.docs) {
    const targetId = String(comment.targetId)
    const author = normalizeUser(comment.author)
    if (!author) continue

    const parentId =
      comment.parent && typeof comment.parent === 'object'
        ? Number(comment.parent.id)
        : comment.parent
          ? Number(comment.parent)
          : null
    const summary: CommentSummary = {
      id: Number(comment.id),
      targetId,
      content: comment.content,
      createdAt: comment.createdAt,
      parentId,
      author,
      replies: [],
    }

    commentsById.set(summary.id, summary)

    if (parentId) {
      pendingReplies.push(summary)
      continue
    }

    const comments = commentsByPost.get(targetId) ?? []
    comments.push(summary)
    commentsByPost.set(targetId, comments)
  }

  for (const reply of pendingReplies) {
    const parent = commentsById.get(Number(reply.parentId))
    if (parent) {
      parent.replies.push(reply)
      continue
    }

    const comments = commentsByPost.get(reply.targetId) ?? []
    comments.push(reply)
    commentsByPost.set(reply.targetId, comments)
  }

  return posts.map((post) => {
    const postId = String(post.id)
    return {
      ...post,
      reactionSummaries: reactionsByPost.get(postId) ?? [],
      comments: commentsByPost.get(postId) ?? [],
      currentUserReaction: currentReactionByPost.get(postId) ?? null,
    }
  })
}
