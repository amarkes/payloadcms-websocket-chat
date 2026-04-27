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
  activeConversationId,
}: {
  initialItems: Array<Omit<ConversationListItem, 'isTyping'> & { isTyping?: boolean }>
  activeConversationId?: string
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
    return (
      <p className="text-neutral-500 text-sm px-4 py-6 text-center">
        Nenhuma conversa ainda.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-300/10">
      {items.map((item) => {
        const isActive = activeConversationId === item.conversationId
        return (
          <li key={item.conversationId}>
            <Link
              href={item.href}
              className={[
                'flex items-center gap-3 px-4 py-3 transition-colors',
                isActive ? 'bg-primary/10' : 'hover:bg-neutral-300/20',
              ].join(' ')}
            >
              {item.avatarUrl ? (
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-neutral-300/20">
                  <Image src={item.avatarUrl} alt={item.name} fill sizes="40px" className="object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-tertiary/50 border border-neutral-300/20 flex items-center justify-center text-neutral-900 font-bold text-sm shrink-0">
                  {item.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={['text-sm font-semibold truncate', isActive ? 'text-primary' : 'text-neutral-800'].join(' ')}>
                    {item.name}
                  </span>
                  {item.unreadCount > 0 && (
                    <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-primary text-neutral text-[10px] font-bold flex items-center justify-center shrink-0">
                      {item.unreadCount}
                    </span>
                  )}
                </div>
                <p className={['text-xs truncate', item.isTyping ? 'text-primary' : 'text-neutral-500'].join(' ')}>
                  {item.isTyping
                    ? 'Digitando...'
                    : item.lastMessageAt
                      ? new Date(item.lastMessageAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Sem mensagens ainda'}
                </p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
