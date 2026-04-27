import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import config from '@/payload.config'
import type { User, Media } from '@/payload-types'
import { getUnreadCountsByConversation } from '@/lib/chat-notifications'
import ChatAuthScreen from './chat/ChatAuthScreen'
import ConversationsList from './chat/ConversationsList'
import AppShell from '@/components/layout/AppShell'
import { PenSquare, MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default async function MessagesPage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) return <ChatAuthScreen />

  const t = await getTranslations('messages')

  const result = await payload.find({
    collection: 'conversations',
    sort: '-lastMessageAt',
    depth: 2,
    limit: 50,
    overrideAccess: false,
    user,
  })

  const fullUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: false,
    user,
  })) as User & { username?: string | null; avatar?: { filename?: string | null } | null }

  const currentUserAvatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  const conversationIds = result.docs
    .map((conversation) => Number(conversation.id))
    .filter(Number.isFinite)

  const unreadCountsByConversation = await getUnreadCountsByConversation({
    conversationIds,
    payload,
    user,
  })

  const conversationItems = result.docs.flatMap((conv) => {
    const participants = (conv.participants as User[]).filter(Boolean)
    const isParticipant = participants.some((p) => String(p.id) === String(user.id))
    if (!isParticipant) return []

    const other = participants.find((p) => String(p.id) !== String(user.id))
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

  return (
    <AppShell username={fullUser.username ?? user.email} avatarUrl={currentUserAvatarUrl}>
      <div className="flex gap-4 h-[calc(100vh-5rem)]">
        {/* Conversations panel */}
        <div className="w-80 shrink-0 flex flex-col rounded-2xl border border-neutral-300/20 bg-neutral-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-300/20">
            <h2 className="font-semibold text-neutral-800 text-sm">{t('title')}</h2>
            <Link
              href="/chat/new"
              aria-label={t('newConversation')}
              className="w-8 h-8 rounded-lg border border-neutral-300/20 bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <PenSquare size={14} />
            </Link>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {conversationItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                <MessageCircle size={32} className="text-neutral-400 mb-3" />
                <p className="text-sm text-neutral-500">{t('selectConversationSub')}</p>
              </div>
            ) : (
              <ConversationsList initialItems={conversationItems} />
            )}
          </div>
        </div>

        {/* Empty chat placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-neutral-300/20 bg-neutral-200 text-center px-6">
          <MessageCircle size={40} className="text-neutral-400 mb-3" />
          <h3 className="text-base font-semibold text-neutral-700 mb-1">{t('selectConversation')}</h3>
          <p className="text-sm text-neutral-500 max-w-xs">{t('selectConversationSub')}</p>
        </div>
      </div>
    </AppShell>
  )
}
