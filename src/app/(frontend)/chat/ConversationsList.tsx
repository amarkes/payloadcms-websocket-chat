'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type ConversationListItem = {
  avatarUrl: string | null
  conversationId: string
  href: string
  isTyping: boolean
  lastMessageAt: string | null
  name: string
  unreadCount: number
}

function formatUnreadLabel(unreadCount: number) {
  return `${unreadCount} mensagem${unreadCount === 1 ? '' : 's'} nao lida${
    unreadCount === 1 ? '' : 's'
  }`
}

function sortItems(items: ConversationListItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0

    return rightTime - leftTime
  })
}

function normalizeItems(items: Array<Omit<ConversationListItem, 'isTyping'> & { isTyping?: boolean }>) {
  return items.map((item) => ({
    ...item,
    isTyping: Boolean(item.isTyping),
  }))
}

export default function ConversationsList({
  initialItems,
}: {
  initialItems: Array<Omit<ConversationListItem, 'isTyping'> & { isTyping?: boolean }>
}) {
  const [items, setItems] = useState<ConversationListItem[]>(sortItems(normalizeItems(initialItems)))
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)

  useEffect(() => {
    setItems(sortItems(normalizeItems(initialItems)))
  }, [initialItems])

  useEffect(() => {
    function subscribeToConversationsList() {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return

      wsRef.current.send(JSON.stringify({ type: 'subscribe_conversations_list' }))
    }

    function connect() {
      const existingSocket = wsRef.current

      if (
        existingSocket?.readyState === WebSocket.OPEN ||
        existingSocket?.readyState === WebSocket.CONNECTING
      ) {
        return existingSocket
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'connected') {
          subscribeToConversationsList()
          return
        }

        if (data.type === 'conversation_unread_snapshot' && Array.isArray(data.items)) {
          const itemsByConversation = new Map<
            string,
            {
              isTyping: boolean
              unreadCount: number
            }
          >(
            data.items.map(
              (item: {
                conversationId: string | number
                isTyping?: boolean
                unreadCount: number
              }) => [
              String(item.conversationId),
              {
                isTyping: Boolean(item.isTyping),
                unreadCount: Number(item.unreadCount) || 0,
              },
            ]),
          )

          setItems((current) =>
            sortItems(
              current.map((item) => ({
                ...item,
                isTyping: itemsByConversation.get(item.conversationId)?.isTyping ?? false,
                unreadCount: itemsByConversation.get(item.conversationId)?.unreadCount ?? 0,
              })),
            ),
          )
          return
        }

        if (data.type === 'conversation_unread_count' && data.conversationId) {
          setItems((current) =>
            sortItems(
              current.map((item) =>
                item.conversationId === String(data.conversationId)
                  ? {
                      ...item,
                      unreadCount: Number(data.unreadCount) || 0,
                      lastMessageAt:
                        typeof data.lastMessageAt === 'string' ? data.lastMessageAt : item.lastMessageAt,
                    }
                  : item,
              ),
            ),
          )
          return
        }

        if (data.type === 'conversation_typing' && data.conversationId) {
          setItems((current) =>
            current.map((item) =>
              item.conversationId === String(data.conversationId)
                ? {
                    ...item,
                    isTyping: Boolean(data.isTyping),
                  }
                : item,
            ),
          )
        }
      }

      ws.onclose = (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null
        }

        if (!shouldReconnectRef.current || event.code === 1008) return

        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, 3_000)
      }

      ws.onerror = () => {
        ws.close()
      }

      return ws
    }

    function refreshSnapshot() {
      if (document.visibilityState === 'hidden') return

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        subscribeToConversationsList()
        return
      }

      connect()
    }

    connect()

    window.addEventListener('focus', refreshSnapshot)
    window.addEventListener('pageshow', refreshSnapshot)
    document.addEventListener('visibilitychange', refreshSnapshot)

    return () => {
      shouldReconnectRef.current = false
      window.removeEventListener('focus', refreshSnapshot)
      window.removeEventListener('pageshow', refreshSnapshot)
      document.removeEventListener('visibilitychange', refreshSnapshot)

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'disconnect' }))
      }

      wsRef.current?.close(1000, 'Page closed')
      wsRef.current = null
    }
  }, [])

  if (items.length === 0) {
    return <p style={{ color: '#94a3b8' }}>Nenhuma conversa ainda. Inicie uma nova conversa.</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => (
        <li key={item.conversationId}>
          <Link
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              border: '1px solid #2d3748',
              borderRadius: 16,
              textDecoration: 'none',
              color: '#f5f7fb',
              background: '#121826',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
            }}
          >
            {item.avatarUrl ? (
              <div
                style={{
                  position: 'relative',
                  width: 48,
                  height: 48,
                  minWidth: 48,
                  minHeight: 48,
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <Image
                  src={item.avatarUrl}
                  alt={item.name}
                  fill
                  sizes="48px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  minWidth: 48,
                  minHeight: 48,
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  background: '#0070f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {item.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {item.name}
                </div>
                {item.unreadCount > 0 && (
                  <span
                    style={{
                      minWidth: 22,
                      height: 22,
                      padding: '0 7px',
                      borderRadius: 999,
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    aria-label={`${item.unreadCount} mensagens nao lidas`}
                    title={`${item.unreadCount} mensagens nao lidas`}
                  >
                    {item.unreadCount}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: item.isTyping ? '#60a5fa' : '#9aa4b2',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.isTyping
                  ? 'Digitando...'
                  : item.unreadCount > 0
                  ? formatUnreadLabel(item.unreadCount)
                  : item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Sem mensagens ainda'}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
