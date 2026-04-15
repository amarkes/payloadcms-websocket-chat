'use client'

import { useState } from 'react'

type FollowState = 'following' | 'pending' | 'not_following'

interface FollowButtonProps {
  targetUserId: number
  initialState: FollowState
}

const labels: Record<FollowState, string> = {
  not_following: 'Seguir',
  pending: 'Solicitado',
  following: 'Seguindo',
}

export default function FollowButton({ targetUserId, initialState }: FollowButtonProps) {
  const [followState, setFollowState] = useState<FollowState>(initialState)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return

    const prev = followState
    // Optimistic update
    if (prev === 'not_following') setFollowState('following')
    else setFollowState('not_following')

    setLoading(true)
    try {
      const res = await fetch(`/api/social/follow/${targetUserId}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { action?: string }

      if (!res.ok) throw new Error('failed')

      switch (data.action) {
        case 'followed':
          setFollowState('following')
          break
        case 'request_sent':
          setFollowState('pending')
          break
        case 'unfollowed':
        case 'request_cancelled':
          setFollowState('not_following')
          break
      }
    } catch {
      setFollowState(prev)
    } finally {
      setLoading(false)
    }
  }

  const isFollowing = followState === 'following' || followState === 'pending'

  return (
    <button
      aria-label={`Alternar seguir usuario ${targetUserId}`}
      onClick={toggle}
      disabled={loading}
      style={{
        minHeight: 36,
        padding: '0 18px',
        borderRadius: 999,
        border: isFollowing ? '1px solid #334155' : 'none',
        background: isFollowing ? 'transparent' : '#0070f3',
        color: isFollowing ? '#94a3b8' : '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
      }}
    >
      {labels[followState]}
    </button>
  )
}
