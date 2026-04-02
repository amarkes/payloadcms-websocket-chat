import type { Payload } from 'payload'

import type { Media, User } from '@/payload-types'

type MessageWithRelations = {
  content?: string | null
  conversation?: unknown
  createdAt: string
  deletedFor?: unknown
  deletedForEveryone?: boolean | null
  id: number | string
  readBy?: unknown
  sender?: unknown
}

export type ChatNotificationItem = {
  conversationId: string
  createdAt: string
  id: string
  senderAvatarUrl: string | null
  senderName: string
  snippet: string
}

export type ChatNotificationsSummary = {
  items: ChatNotificationItem[]
  unreadCount: number
}

export async function getUnreadCountForConversation({
  conversationId,
  payload,
  user,
}: {
  conversationId: number
  payload: Payload
  user: User
}) {
  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [
        {
          conversation: {
            equals: conversationId,
          },
        },
        {
          sender: {
            not_equals: user.id,
          },
        },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: false,
    user,
  })

  return messages.docs.filter((message: MessageWithRelations) =>
    isMessageUnreadForUser(message, Number(user.id)),
  ).length
}

export async function getUnreadCountsByConversation({
  conversationIds,
  payload,
  user,
}: {
  conversationIds: number[]
  payload: Payload
  user: User
}) {
  const entries = await Promise.all(
    conversationIds.map(async (conversationId) => [
      String(conversationId),
      await getUnreadCountForConversation({
        conversationId,
        payload,
        user,
      }),
    ]),
  )

  return Object.fromEntries(entries) as Record<string, number>
}

function getRelationshipId(value: unknown): number | null {
  if (typeof value === 'object' && value && 'id' in value) {
    const id = Number(value.id)
    return Number.isFinite(id) ? id : null
  }

  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function normalizeRelationshipIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => getRelationshipId(entry))
    .filter((entry): entry is number => Number.isFinite(entry))
}

function isMessageDeletedForUser(message: MessageWithRelations, userId: number) {
  if (message.deletedForEveryone) return true

  const deletedFor = normalizeRelationshipIds(message.deletedFor)

  return deletedFor.includes(userId)
}

function isMessageUnreadForUser(message: MessageWithRelations, userId: number) {
  if (isMessageDeletedForUser(message, userId)) return false

  const readBy = normalizeRelationshipIds(message.readBy)

  return !readBy.includes(userId)
}

function truncateSnippet(content: string, maxLength = 72) {
  if (content.length <= maxLength) return content

  return `${content.slice(0, maxLength - 1).trimEnd()}...`
}

function buildUnreadNotificationItems({
  messages,
}: {
  messages: MessageWithRelations[]
}) {
  const latestUnreadByConversation = new Map<string, MessageWithRelations>()

  for (const message of messages) {
    const conversationId = getRelationshipId(message.conversation)

    if (!conversationId) continue

    const key = String(conversationId)

    if (!latestUnreadByConversation.has(key)) {
      latestUnreadByConversation.set(key, message)
    }
  }

  return Array.from(latestUnreadByConversation.values())
}

export async function getUnreadNotificationsSummary({
  limit = 8,
  payload,
  user,
}: {
  limit?: number
  payload: Payload
  user: User
}): Promise<ChatNotificationsSummary> {
  const messages = await payload.find({
    collection: 'messages',
    where: {
      sender: {
        not_equals: user.id,
      },
    },
    sort: '-createdAt',
    depth: 2,
    limit: 1000,
    overrideAccess: false,
    user,
  })

  const unreadMessages = messages.docs.filter((message: MessageWithRelations) =>
    isMessageUnreadForUser(message, Number(user.id)),
  )

  const latestUnreadMessages = buildUnreadNotificationItems({ messages: unreadMessages })

  const items = latestUnreadMessages.slice(0, limit).map((message) => {
    const sender =
      typeof message.sender === 'object' && message.sender
        ? (message.sender as User)
        : null
    const senderAvatarUrl =
      sender?.avatar && typeof sender.avatar === 'object'
        ? `/api/media/file/${(sender.avatar as Media).filename}`
        : null
    const conversationId = getRelationshipId(message.conversation)

    return {
      conversationId: String(conversationId || ''),
      createdAt: message.createdAt,
      id: String(message.id),
      senderAvatarUrl,
      senderName: sender?.name || sender?.email || 'Mensagem nova',
      snippet: truncateSnippet(message.content || 'Nova mensagem'),
    }
  })

  return {
    items,
    unreadCount: latestUnreadMessages.length,
  }
}

export async function getUnreadNotificationsSummaryForUserId({
  limit = 8,
  payload,
  userId,
}: {
  limit?: number
  payload: Payload
  userId: number
}): Promise<ChatNotificationsSummary> {
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })

  if (!user) {
    return {
      items: [],
      unreadCount: 0,
    }
  }

  return getUnreadNotificationsSummary({
    limit,
    payload,
    user,
  })
}

export async function markConversationMessagesAsRead({
  conversationId,
  payload,
  user,
}: {
  conversationId: number
  payload: Payload
  user: User
}) {
  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [
        {
          conversation: {
            equals: conversationId,
          },
        },
        {
          sender: {
            not_equals: user.id,
          },
        },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: false,
    user,
  })

  const unreadMessages = messages.docs.filter((message: MessageWithRelations) =>
    isMessageUnreadForUser(message, Number(user.id)),
  )

  await Promise.all(
    unreadMessages.map(async (message) => {
      const readBy = normalizeRelationshipIds(message.readBy)

      if (readBy.includes(Number(user.id))) return

      await payload.update({
        collection: 'messages',
        id: message.id,
        data: {
          readBy: [...readBy, Number(user.id)],
        },
        depth: 0,
        overrideAccess: true,
      })
    }),
  )
}
