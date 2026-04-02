import type { Payload } from 'payload'

import type { Message, User } from '@/payload-types'

export const CHAT_MESSAGES_PAGE_SIZE = 40

export type ConversationMessagesPage = {
  docs: Message[]
  hasNextPage: boolean
  hasPrevPage: boolean
  page: number
  totalDocs: number
  totalPages: number
}

function sanitizePage(page: number) {
  if (!Number.isFinite(page) || page < 1) return 1

  return Math.floor(page)
}

export async function getConversationMessagesPage({
  conversationId,
  page,
  payload,
  user,
}: {
  conversationId: string | number
  page: number
  payload: Payload
  user: User
}): Promise<ConversationMessagesPage> {
  const safePage = sanitizePage(page)

  const conversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
    depth: 0,
    overrideAccess: false,
    user,
  })

  if (!conversation) {
    throw new Error('Conversa nao encontrada.')
  }

  const result = await payload.find({
    collection: 'messages',
    where: {
      conversation: {
        equals: conversationId,
      },
    },
    sort: '-createdAt',
    depth: 1,
    limit: CHAT_MESSAGES_PAGE_SIZE,
    overrideAccess: false,
    page: safePage,
    user,
  })

  return {
    docs: [...(result.docs as Message[])].reverse(),
    hasNextPage: Boolean(result.hasNextPage),
    hasPrevPage: Boolean(result.hasPrevPage),
    page: result.page || safePage,
    totalDocs: result.totalDocs || 0,
    totalPages: result.totalPages || 1,
  }
}
