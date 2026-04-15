'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StoryGroupData } from '@/lib/social-stories'
import StoryRing from './StoryRing'
import StoryViewer from './StoryViewer'

interface StoriesRailProps {
  groups: StoryGroupData[]
  title?: string
}

export default function StoriesRail({ groups, title = 'Stories' }: StoriesRailProps) {
  const router = useRouter()
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null)

  useEffect(() => {
    const refreshOnNewStory = () => {
      router.refresh()
    }

    window.addEventListener('social:story-new', refreshOnNewStory)
    return () => window.removeEventListener('social:story-new', refreshOnNewStory)
  }, [router])

  if (groups.length === 0) return null

  return (
    <>
      <div
        style={{
          display: 'grid',
          gap: 14,
          marginBottom: 24,
          padding: 18,
          borderRadius: 22,
          background: 'rgba(10, 15, 26, 0.82)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <span style={{ color: '#64748b', fontSize: 12 }}>{groups.length} perfis ativos</span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {groups.map((group, index) => (
            <StoryRing
              key={group.author.id}
              active={activeGroupIndex === index}
              group={group}
              onOpen={() => setActiveGroupIndex(index)}
            />
          ))}
        </div>
      </div>

      {activeGroupIndex !== null && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={activeGroupIndex}
          onClose={() => setActiveGroupIndex(null)}
        />
      )}
    </>
  )
}
