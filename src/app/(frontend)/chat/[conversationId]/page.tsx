import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'
import config from '@/payload.config'
import type { User, Media } from '@/payload-types'
import { getConversationMessagesPage } from '@/lib/chat-messages'
import { getUnreadCountsByConversation } from '@/lib/chat-notifications'
import AppShell from '@/components/layout/AppShell'
import ConversationsList from '../ConversationsList'
import ChatInterface from './ChatInterface'
import { PenSquare } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const { conversationId } = await params

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect('/')

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

  const [fullUser, messagesPage, conversationsResult] = await Promise.all([
    payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 1,
      overrideAccess: false,
      user,
    }) as Promise<User & { username?: string | null; avatar?: { filename?: string | null } | null; enableMessageObfuscation?: boolean | null }>,
    getConversationMessagesPage({ conversationId, page: 1, payload, user }),
    payload.find({
      collection: 'conversations',
      sort: '-lastMessageAt',
      depth: 2,
      limit: 50,
      overrideAccess: false,
      user,
    }),
  ])

  const currentUserAvatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  const conversationIds = conversationsResult.docs
    .map((c) => Number(c.id))
    .filter(Number.isFinite)

  const unreadCountsByConversation = await getUnreadCountsByConversation({
    conversationIds,
    payload,
    user,
  })

  const conversationItems = conversationsResult.docs.flatMap((conv) => {
    const parts = (conv.participants as User[]).filter(Boolean)
    const isParticipant = parts.some((p) => String(p.id) === String(user.id))
    if (!isParticipant) return []
    const other = parts.find((p) => String(p.id) !== String(user.id))
    if (!other) return []
    const avatarUrl =
      other.avatar && typeof other.avatar === 'object'
        ? `/api/media/file/${(other.avatar as Media).filename}`
        : null
    return [{
      avatarUrl,
      conversationId: String(conv.id),
      href: `/chat/${conv.id}`,
      lastMessageAt: conv.lastMessageAt || null,
      name: other.name || other.email,
      unreadCount: unreadCountsByConversation[String(conv.id)] ?? 0,
    }]
  })

  const otherUser = participants.find((p) => String(p.id) !== String(user.id))!
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
    <AppShell username={fullUser.username ?? user.email} avatarUrl={currentUserAvatarUrl}>
      <div className="flex gap-4 h-[calc(100vh-5rem)]">
        {/* Conversations panel */}
        <div className="w-80 shrink-0 flex flex-col rounded-2xl border border-neutral-300/20 bg-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-300/20">
            <h2 className="font-semibold text-neutral-800 text-sm">Chats</h2>
            <Link
              href="/chat/new"
              className="w-8 h-8 rounded-lg border border-neutral-300/20 bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <PenSquare size={14} />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ConversationsList initialItems={conversationItems} activeConversationId={conversationId} />
          </div>
        </div>

        {/* Chat interface */}
        <div className="flex-1 rounded-2xl border border-neutral-300/20 bg-neutral-200 overflow-hidden">
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
        </div>
      </div>
    </AppShell>
  )
}
