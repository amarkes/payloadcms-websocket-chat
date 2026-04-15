'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import Image from 'next/image'
import type { StoryGroupData, StoryItemData } from '@/lib/social-stories'

interface StoryViewerProps {
  groups: StoryGroupData[]
  initialGroupIndex: number
  onClose: () => void
}

const IMAGE_DURATION_MS = 5000

export default function StoryViewer({
  groups,
  initialGroupIndex,
  onClose,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [imageProgress, setImageProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const viewedStoriesRef = useRef(new Set<string>())

  const activeGroup = groups[groupIndex]
  const activeStory = activeGroup?.stories[storyIndex]

  const progressValues = useMemo(
    () =>
      activeGroup?.stories.map((story, index) => {
        if (index < storyIndex) return 100
        if (index > storyIndex) return 0
        return imageProgress
      }) ?? [],
    [activeGroup?.stories, imageProgress, storyIndex],
  )

  useEffect(() => {
    setGroupIndex(initialGroupIndex)
    setStoryIndex(0)
  }, [initialGroupIndex])

  useEffect(() => {
    if (!activeStory || viewedStoriesRef.current.has(activeStory.id)) return

    viewedStoriesRef.current.add(activeStory.id)
    void fetch(`/api/stories/${activeStory.id}/view`, {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => null)
  }, [activeStory])

  useEffect(() => {
    setImageProgress(0)
  }, [activeStory?.id])

  useEffect(() => {
    if (!activeStory || activeStory.media?.mimeType?.startsWith('video/')) return

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const progress = ((Date.now() - startedAt) / IMAGE_DURATION_MS) * 100
      if (progress >= 100) {
        window.clearInterval(interval)
        moveNext()
        return
      }
      setImageProgress(progress)
    }, 80)

    return () => window.clearInterval(interval)
  }, [activeStory])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') moveNext()
      if (event.key === 'ArrowLeft') movePrevious()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function moveNext() {
    if (!activeGroup) return

    if (storyIndex < activeGroup.stories.length - 1) {
      setStoryIndex((current) => current + 1)
      return
    }

    if (groupIndex < groups.length - 1) {
      setGroupIndex((current) => current + 1)
      setStoryIndex(0)
      return
    }

    onClose()
  }

  function movePrevious() {
    if (!activeGroup) return

    if (storyIndex > 0) {
      setStoryIndex((current) => current - 1)
      return
    }

    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1]
      setGroupIndex((current) => current - 1)
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1))
    }
  }

  if (!activeStory || !activeGroup) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(2, 6, 23, 0.94)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(420px, 100%)',
          height: 'min(780px, calc(100dvh - 40px))',
          borderRadius: 28,
          overflow: 'hidden',
          background: '#020617',
          boxShadow: '0 40px 120px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            zIndex: 3,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeGroup.stories.length}, 1fr)`, gap: 6 }}>
            {progressValues.map((value, index) => (
              <div
                key={`${activeGroup.author.id}-${index}`}
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.22)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${value}%`,
                    height: '100%',
                    background: '#f8fafc',
                    transition: activeGroup.stories[index]?.media?.mimeType?.startsWith('video/')
                      ? 'width 0.12s linear'
                      : 'none',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#0f172a',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              {activeGroup.author.avatar?.filename ? (
                <Image
                  src={`/api/media/file/${activeGroup.author.avatar.filename}`}
                  alt={activeGroup.author.username || activeGroup.author.name || 'story'}
                  fill
                  sizes="40px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  {(activeGroup.author.username || activeGroup.author.name || 'S').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ color: '#f8fafc', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                @{activeGroup.author.username || activeGroup.author.name || 'story'}
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {formatStoryTime(activeStory.createdAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginLeft: 'auto',
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(15, 23, 42, 0.62)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 20,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Story anterior"
          onClick={movePrevious}
          style={navHitAreaStyle('left')}
        />
        <button
          type="button"
          aria-label="Próxima story"
          onClick={moveNext}
          style={navHitAreaStyle('right')}
        />

        {renderStoryMedia(activeStory, videoRef, moveNext, setImageProgress)}

        {activeStory.caption && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 20,
              zIndex: 3,
              padding: '14px 16px',
              borderRadius: 18,
              background: 'rgba(2, 6, 23, 0.62)',
              color: '#f8fafc',
              fontSize: 14,
              lineHeight: 1.5,
              backdropFilter: 'blur(12px)',
            }}
          >
            {activeStory.caption}
          </div>
        )}
      </div>
    </div>
  )
}

function renderStoryMedia(
  story: StoryItemData,
  videoRef: RefObject<HTMLVideoElement | null>,
  onEnded: () => void,
  onVideoProgress: (value: number) => void,
) {
  const src = story.media?.filename ? `/api/media/file/${story.media.filename}` : null

  if (!src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          background: '#0f172a',
        }}
      >
        Story sem mídia.
      </div>
    )
  }

  if (story.media?.mimeType?.startsWith('video/')) {
    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        controls
        onEnded={onEnded}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget
          if (!duration) return
          onVideoProgress(Math.min(100, (currentTime / duration) * 100))
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }

  return <Image src={src} alt="" fill sizes="420px" style={{ objectFit: 'cover' }} />
}

function navHitAreaStyle(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width: '32%',
    zIndex: 2,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  }
}

function formatStoryTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const hours = Math.max(0, Math.floor(diffMs / 3_600_000))

  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(diffMs / 60_000))
    return `${minutes} min`
  }

  return `${hours} h`
}
