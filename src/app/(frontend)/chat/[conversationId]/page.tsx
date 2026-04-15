import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'
import config from '@/payload.config'
import type { User, Media } from '@/payload-types'
import { getConversationMessagesPage } from '@/lib/chat-messages'
import ChatInterface from './ChatInterface'

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { conversationId } = await params

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

  // Fetch conversation and verify user is a participant
  const conversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
    depth: 2,
    overrideAccess: false,
    user,
  })

  if (!conversation) notFound()

  const participants = conversation.participants as User[]
  const isParticipant = participants.some((p) => String(p.id) === String(user.id))

  if (!isParticipant) notFound()

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: false,
    user,
  })) as User & {
    enableMessageObfuscation?: boolean | null
  }

  const otherUser = participants.find((p) => String(p.id) !== String(user.id))!

  const messagesPage = await getConversationMessagesPage({
    conversationId,
    page: 1,
    payload,
    user,
  })

  const otherUserForClient = {
    id: String(otherUser.id),
    name: otherUser.name,
    email: otherUser.email,
    avatar:
      otherUser.avatar && typeof otherUser.avatar === 'object'
        ? { filename: (otherUser.avatar as Media).filename || '' }
        : null,
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      currentUserId={String(user.id)}
      enableMessageObfuscation={Boolean(fullUser.enableMessageObfuscation)}
      initialMessages={messagesPage.docs as never}
      initialMessagesPage={messagesPage.page}
      initialMessagesTotalDocs={messagesPage.totalDocs}
      initialMessagesTotalPages={messagesPage.totalPages}
      otherUser={otherUserForClient}
    />
  )
}
