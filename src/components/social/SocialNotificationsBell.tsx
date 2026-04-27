'use client'

import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type NotificationItem = {
  id: string
  title: string
  body: string
  href: string
  createdAt: string
  readAt?: string | null
}

type NotificationsSummary = {
  items: NotificationItem[]
  unreadCount: number
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function SocialNotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<NotificationsSummary>({ items: [], unreadCount: 0 })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)
  const wsRef = useRef<WebSocket | null>(null)

  async function refreshNotifications() {
    const res = await fetch('/api/social/notifications', { credentials: 'same-origin' })
    if (!res.ok) return

    const data = (await res.json()) as NotificationsSummary
    setSummary(data)
  }

  async function markRead(id: string) {
    setSummary((current) => ({
      items: current.items.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
      unreadCount: Math.max(0, current.unreadCount - 1),
    }))

    await fetch('/api/social/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id }),
    })
  }

  async function openNotification(item: NotificationItem) {
    setOpen(false)
    if (!item.readAt) await markRead(item.id)
    router.push(item.href)
  }

  useEffect(() => {
    void refreshNotifications()
  }, [])

  useEffect(() => {
    function subscribe(ws: WebSocket) {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'subscribe_notifications' }))
    }

    function connect() {
      const current = wsRef.current
      if (
        current?.readyState === WebSocket.OPEN ||
        current?.readyState === WebSocket.CONNECTING
      ) {
        return
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      wsRef.current = ws

      ws.addEventListener('open', () => subscribe(ws))

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as {
            notification?: NotificationItem
            summary?: NotificationsSummary
            type?: string
          }

          if (data.type === 'connected') {
            subscribe(ws)
            return
          }

          if (data.type === 'notifications_summary') {
            void refreshNotifications()
            return
          }

          if (data.type !== 'social:notification:new' || !data.notification) return

          setSummary((currentSummary) => ({
            items: [
              data.notification!,
              ...currentSummary.items.filter((item) => item.id !== data.notification!.id),
            ].slice(0, 30),
            unreadCount: currentSummary.unreadCount + 1,
          }))
        } catch {
          // Ignore malformed websocket messages from the shared channel.
        }
      })

      ws.addEventListener('close', (event) => {
        if (wsRef.current === ws) wsRef.current = null
        if (!shouldReconnectRef.current || event.code === 1008) return

        reconnectTimerRef.current = setTimeout(connect, 3000)
      })

      ws.addEventListener('error', () => {
        ws.close()
      })
    }

    function refreshConnection() {
      if (document.visibilityState === 'hidden') return
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        subscribe(wsRef.current)
        return
      }

      connect()
    }

    connect()
    window.addEventListener('focus', refreshConnection)
    window.addEventListener('pageshow', refreshConnection)
    document.addEventListener('visibilitychange', refreshConnection)

    return () => {
      shouldReconnectRef.current = false
      window.removeEventListener('focus', refreshConnection)
      window.removeEventListener('pageshow', refreshConnection)
      document.removeEventListener('visibilitychange', refreshConnection)

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

      wsRef.current?.close(1000, 'Notifications closed')
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (!target || rootRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          void refreshNotifications()
        }}
        aria-label="Notificacoes"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-neutral-300/20 bg-neutral-200 text-neutral-700 hover:text-primary hover:border-primary/30 transition-colors"
      >
        <Bell size={17} />
        {summary.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-secondary text-neutral text-[10px] font-bold">
            {summary.unreadCount > 99 ? '99+' : summary.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[min(360px,calc(100vw-32px))] max-h-[460px] overflow-y-auto rounded-2xl border border-neutral-300/20 bg-neutral-100 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-300/20 px-4 py-3">
            <div>
              <div className="font-bold text-neutral-900">Notificacoes</div>
              <div className="text-xs text-neutral-500">
                {summary.unreadCount} nao lida{summary.unreadCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          {summary.items.length === 0 ? (
            <div className="px-4 py-5 text-sm text-neutral-500">Nenhuma notificacao.</div>
          ) : (
            <div className="flex flex-col">
              {summary.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    void openNotification(item)
                  }}
                  className={`block w-full border-0 border-b border-neutral-300/20 px-4 py-3 text-left transition-colors hover:bg-neutral-200 ${
                    item.readAt ? 'text-neutral-600' : 'text-neutral-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{item.title}</div>
                      {item.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{item.body}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-500">{formatTime(item.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
