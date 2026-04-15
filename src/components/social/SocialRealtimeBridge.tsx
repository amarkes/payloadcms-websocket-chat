'use client'

import { useEffect } from 'react'

type SocialEvent =
  | {
      type: 'reaction:update'
      targetType: 'post' | 'reel' | 'comment'
      targetId: string
      likesCount: number
      dislikesCount: number
    }
  | {
      type: 'comment:new'
      targetType: 'post' | 'reel'
      targetId: string
      comment: {
        id: string
        authorId: string
        content: string
        createdAt?: string
        parentId?: string | null
      }
    }
  | {
      type: 'story:new'
      storyId: string
      authorId: string
      expiresAt?: string
    }
  | {
      type: 'follow:request'
      followerId: string
    }

function dispatchSocialEvent(event: SocialEvent) {
  window.dispatchEvent(new CustomEvent('social:event', { detail: event }))
  window.dispatchEvent(new CustomEvent(`social:${event.type.replace(':', '-')}`, { detail: event }))
}

export default function SocialRealtimeBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.addEventListener('message', (message) => {
      try {
        const data = JSON.parse(message.data) as { type?: string }

        if (
          data.type === 'reaction:update' ||
          data.type === 'comment:new' ||
          data.type === 'story:new' ||
          data.type === 'follow:request'
        ) {
          dispatchSocialEvent(data as SocialEvent)
        }
      } catch {
        // Ignore malformed events from the shared websocket channel.
      }
    })

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
  }, [])

  return null
}
