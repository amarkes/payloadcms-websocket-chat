import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import Image from 'next/image'
import Link from 'next/link'
import config from '@/payload.config'
import type { User, Media } from '@/payload-types'
import {
  getUnreadCountsByConversation,
  getUnreadNotificationsSummary,
} from '@/lib/chat-notifications'
import ChatAuthScreen from './chat/ChatAuthScreen'
import ConversationsList from './chat/ConversationsList'
import NotificationsBell from './chat/NotificationsBell'

export default async function HomePage() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    return <ChatAuthScreen />
  }

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
  })) as User

  const currentUserAvatarUrl =
    fullUser.avatar && typeof fullUser.avatar === 'object'
      ? `/api/media/file/${(fullUser.avatar as Media).filename}`
      : null

  const notificationsSummary = await getUnreadNotificationsSummary({
    payload,
    user,
  })

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
    const isParticipant = participants.some(
      (participant) => String(participant.id) === String(user.id),
    )

    if (!isParticipant) return []

    const other = participants.find((participant) => String(participant.id) !== String(user.id))

    if (!other) return []

    const avatarUrl =
      other.avatar && typeof other.avatar === 'object'
        ? `/api/media/file/${(other.avatar as Media).filename}`
        : null

    return [
      {
        avatarUrl,
        conversationId: String(conv.id),
        href: `/chat/${conv.id}`,
        lastMessageAt: conv.lastMessageAt || null,
        name: other.name || other.email,
        unreadCount: unreadCountsByConversation[String(conv.id)] ?? 0,
      },
    ]
  })

  return (
    <div
      style={{
        minHeight: '100dvh',
        padding: '32px 16px 48px',
        background:
          'radial-gradient(circle at top, rgba(31, 122, 236, 0.14), transparent 30%), #05070d',
        color: '#f5f7fb',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Nav bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            padding: '0 4px',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/feed"
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid #1f2a3a',
              background: '#0f1724',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Feed
          </Link>
          <Link
            href="/explore"
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid #1f2a3a',
              background: '#0f1724',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Explorar
          </Link>
          <Link
            href="/reels"
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid #1f2a3a',
              background: '#0f1724',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Reels
          </Link>
          <Link
            href={`/u/${fullUser.username || user.email}`}
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid #1f2a3a',
              background: '#0f1724',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Meu perfil
          </Link>
          <Link
            href="/settings/profile"
            style={{
              padding: '7px 14px',
              borderRadius: 10,
              border: '1px solid #1f2a3a',
              background: '#0f1724',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Configuracoes
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'start',
            gap: 14,
            marginBottom: 18,
            padding: '18px 16px',
            borderRadius: 20,
            border: '1px solid #1f2a3a',
            background: 'rgba(10, 18, 34, 0.9)',
            boxShadow: '0 18px 50px rgba(0, 0, 0, 0.22)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(2.1rem, 7vw, 3.2rem)', lineHeight: 0.95 }}>
              Conversas
            </h1>
            <p style={{ margin: '10px 0 0', color: '#94a3b8', lineHeight: 1.45 }}>
              Abra uma conversa existente ou comece uma nova.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                padding: '8px 12px',
                borderRadius: 999,
                background: '#0f1724',
                border: '1px solid #243041',
                color: '#cbd5e1',
                fontSize: 13,
                maxWidth: '100%',
              }}
            >
              <span style={{ color: '#7dd3fc', flexShrink: 0 }}>Perfil</span>
              <strong
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name || user.email}
              </strong>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Link
              href="/chat/new"
              style={{
                minHeight: 44,
                padding: '0 14px',
                background: '#0070f3',
                color: '#fff',
                borderRadius: 12,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Nova conversa
            </Link>
            <NotificationsBell initialSummary={notificationsSummary} />
            <Link
              href="/chat/account"
              aria-label="Abrir perfil"
              title="Editar conta"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#111827',
                border: '1px solid #243041',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f5f7fb',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 18,
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {currentUserAvatarUrl ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <Image
                    src={currentUserAvatarUrl}
                    alt={fullUser.name || fullUser.email}
                    fill
                    sizes="44px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              ) : (
                (fullUser.name || fullUser.email).charAt(0).toUpperCase()
              )}
            </Link>
          </div>
        </div>

        <ConversationsList initialItems={conversationItems} />
      </div>
    </div>
  )
}
