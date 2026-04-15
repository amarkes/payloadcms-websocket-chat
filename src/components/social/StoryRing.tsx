'use client'

import Image from 'next/image'
import type { StoryGroupData } from '@/lib/social-stories'

interface StoryRingProps {
  active?: boolean
  group: StoryGroupData
  onOpen: () => void
}

export default function StoryRing({ active = false, group, onOpen }: StoryRingProps) {
  const avatarUrl = group.author.avatar?.filename
    ? `/api/media/file/${group.author.avatar.filename}`
    : null
  const label = group.author.username || group.author.name || 'story'

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: '#e2e8f0',
        cursor: 'pointer',
        display: 'grid',
        gap: 8,
        justifyItems: 'center',
        minWidth: 72,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          padding: 3,
          borderRadius: '50%',
          background: group.hasUnviewed
            ? 'linear-gradient(135deg, #fb7185, #f59e0b, #22d3ee)'
            : '#243041',
          boxShadow: active ? '0 0 0 3px rgba(96, 165, 250, 0.35)' : 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#08101c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={label}
              fill
              sizes="66px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 24, fontWeight: 700 }}>
              {label.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          maxWidth: 82,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: active ? '#f8fafc' : '#94a3b8',
        }}
      >
        @{label}
      </span>
    </button>
  )
}
