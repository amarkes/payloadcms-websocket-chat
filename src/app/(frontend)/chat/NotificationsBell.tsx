'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type NotificationItem = {
  conversationId: string
  createdAt: string
  id: string
  senderAvatarUrl: string | null
  senderName: string
  snippet: string
}

type NotificationsSummary = {
  items: NotificationItem[]
  unreadCount: number
}

export default function NotificationsBell({
  initialSummary,
}: {
  initialSummary: NotificationsSummary
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [summary, setSummary] = useState<NotificationsSummary>(initialSummary)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)

  useEffect(() => {
    setSummary(initialSummary)
  }, [initialSummary])

  useEffect(() => {
    function subscribeToNotifications() {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return

      wsRef.current.send(JSON.stringify({ type: 'subscribe_notifications' }))
    }

    function connect() {
      const existingSocket = wsRef.current

      if (
        existingSocket?.readyState === WebSocket.OPEN ||
        existingSocket?.readyState === WebSocket.CONNECTING
      ) {
        return existingSocket
      }

      setLoading(true)

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as
          | { type: 'connected' }
          | { type: 'notifications_summary'; summary: NotificationsSummary }

        if (data.type === 'connected') {
          subscribeToNotifications()
          return
        }

        if (data.type === 'notifications_summary') {
          setSummary(data.summary)
          setLoading(false)
        }
      }

      ws.onclose = (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null
        }

        setLoading(false)

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

    function refreshSubscription() {
      if (document.visibilityState === 'hidden') return

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        subscribeToNotifications()
        return
      }

      connect()
    }

    connect()
    window.addEventListener('focus', refreshSubscription)
    window.addEventListener('pageshow', refreshSubscription)
    document.addEventListener('visibilitychange', refreshSubscription)

    return () => {
      shouldReconnectRef.current = false
      window.removeEventListener('focus', refreshSubscription)
      window.removeEventListener('pageshow', refreshSubscription)
      document.removeEventListener('visibilitychange', refreshSubscription)

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'disconnect' }))
      }

      wsRef.current?.close(1000, 'Notifications closed')
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null

      if (!target || rootRef.current?.contains(target)) return

      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const visibleUnreadCount = summary.unreadCount

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          setIsOpen((current) => !current)
        }}
        aria-label="Abrir notificacoes"
        title="Notificacoes"
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#111827',
          border: '1px solid #243041',
          display: 'grid',
          placeItems: 'center',
          color: '#f5f7fb',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Bell size={18} strokeWidth={2.1} />
        {visibleUnreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -2,
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #05070d',
            }}
          >
            {visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 460,
            overflowY: 'auto',
            borderRadius: 18,
            border: '1px solid #243041',
            background: 'rgba(11, 15, 25, 0.98)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.42)',
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid #1f2937',
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Nao lidas</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                {visibleUnreadCount} conversa{visibleUnreadCount === 1 ? '' : 's'}
              </div>
            </div>
            {loading && <div style={{ color: '#60a5fa', fontSize: 12 }}>Atualizando...</div>}
          </div>

          {summary.items.length === 0 ? (
            <div style={{ padding: '18px 16px', color: '#94a3b8', fontSize: 14 }}>
              Nenhuma conversa com mensagens nao lidas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {summary.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/chat/${item.conversationId}`}
                  onClick={() => {
                    setIsOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 16px',
                    textDecoration: 'none',
                    color: '#f5f7fb',
                    borderBottom: '1px solid #111827',
                  }}
                >
                  {item.senderAvatarUrl ? (
                    <img
                      src={item.senderAvatarUrl}
                      alt={item.senderName}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: '#2563eb',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {item.senderName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 4,
                      }}
                    >
                      <strong
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.senderName}
                      </strong>
                      <span style={{ color: '#94a3b8', fontSize: 12, flexShrink: 0 }}>
                        {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      style={{
                        color: '#cbd5e1',
                        fontSize: 13,
                        lineHeight: 1.45,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.snippet}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
