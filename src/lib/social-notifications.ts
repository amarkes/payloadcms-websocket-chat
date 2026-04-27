/* eslint-disable @typescript-eslint/no-explicit-any */

import { broadcastToUserSockets } from '../websocket/social-events'

type PayloadLike = {
  collections?: Record<string, unknown>
  create: (args: any) => Promise<any>
  find: (args: any) => Promise<{ docs: any[] }>
}

type ActorLike = {
  email?: string | null
  id?: string | number
  name?: string | null
  username?: string | null
}

function getActorName(actor: ActorLike) {
  return actor.name || actor.username || actor.email || 'Alguem'
}

export function extractMentionHandles(content: string) {
  const matches = content.matchAll(/(^|\s)@([\w.]+)/g)
  return Array.from(new Set(Array.from(matches, (match) => match[2].toLowerCase())))
}

export async function notifyCommentMentions({
  actor,
  commentId,
  content,
  payload,
  postId,
  req,
}: {
  actor: ActorLike
  commentId: string | number
  content: string
  payload: PayloadLike
  postId: string | number
  req?: unknown
}) {
  const handles = extractMentionHandles(content)
  const numericPostId = Number(postId)
  const numericCommentId = Number(commentId)

  if (
    handles.length === 0 ||
    !actor.id ||
    !Number.isFinite(numericPostId) ||
    !Number.isFinite(numericCommentId) ||
    !payload.collections?.notifications
  ) {
    return
  }

  const usersResult = await payload.find({
    collection: 'users',
    where: { username: { in: handles } },
    depth: 0,
    limit: handles.length,
    overrideAccess: true,
  })

  const actorId = String(actor.id)
  const mentionedUsers = usersResult.docs.filter((user) => String(user.id) !== actorId)

  await Promise.all(
    mentionedUsers.map(async (recipient) => {
      const href = `/feed/${postId}`
      const notificationKey = `${recipient.id}:comment_mention:${commentId}`
      const title = `${getActorName(actor)} mencionou voce`
      const body = content.length > 120 ? `${content.slice(0, 119).trimEnd()}...` : content

      try {
        const notification = await payload.create({
          collection: 'notifications',
          data: {
            recipient: recipient.id,
            actor: actor.id,
            type: 'comment_mention',
            post: numericPostId,
            comment: numericCommentId,
            href,
            title,
            body,
            notificationKey,
          },
          overrideAccess: true,
          ...(req ? { req } : {}),
        })

        broadcastToUserSockets(String(recipient.id), {
          type: 'social:notification:new',
          notification: {
            id: String(notification.id),
            title,
            body,
            href,
            createdAt: notification.createdAt,
            readAt: notification.readAt ?? null,
            actor: {
              id: actor.id,
              name: actor.name ?? null,
              email: actor.email ?? '',
              username: actor.username ?? null,
            },
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.toLowerCase().includes('duplicate')) {
          console.error('Failed to create mention notification', error)
        }
      }
    }),
  )
}
