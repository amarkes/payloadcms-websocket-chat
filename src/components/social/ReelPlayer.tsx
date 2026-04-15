'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type ReelAuthor = {
  id: number
  name?: string | null
  email?: string | null
  username?: string | null
  avatar?: { filename?: string | null } | null
}

export type ReelMedia = {
  filename?: string | null
  mimeType?: string | null
}

export type ReelData = {
  id: number
  author: ReelAuthor
  caption?: string | null
  createdAt: string
  duration?: number | null
  likesCount?: number | null
  dislikesCount?: number | null
  commentsCount?: number | null
  visibility: 'public' | 'followers' | 'private'
  thumbnail?: ReelMedia | null
  video?: ReelMedia | null
}

interface ReelPlayerProps {
  currentUserId: number | null
  initialUserReaction?: 'like' | 'dislike' | null
  reel: ReelData
}

export default function ReelPlayer({
  currentUserId,
  initialUserReaction = null,
  reel,
}: ReelPlayerProps) {
  const [likesCount, setLikesCount] = useState(reel.likesCount ?? 0)
  const [dislikesCount, setDislikesCount] = useState(reel.dislikesCount ?? 0)
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(initialUserReaction)
  const [isMuted, setIsMuted] = useState(true)
  const [reacting, setReacting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onReactionUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        targetType: 'post' | 'reel' | 'comment'
        targetId: string
        likesCount: number
        dislikesCount: number
      }>).detail

      if (detail.targetType !== 'reel' || detail.targetId !== String(reel.id)) return

      setLikesCount(detail.likesCount)
      setDislikesCount(detail.dislikesCount)
    }

    window.addEventListener('social:reaction-update', onReactionUpdate as EventListener)
    return () => window.removeEventListener('social:reaction-update', onReactionUpdate as EventListener)
  }, [reel.id])

  useEffect(() => {
    const node = cardRef.current
    const video = videoRef.current
    if (!node || !video) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.65
        if (visible) {
          void video.play().catch(() => null)
        } else {
          video.pause()
        }
      },
      { threshold: [0.3, 0.65, 0.9] },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  async function handleReact(type: 'like' | 'dislike') {
    if (!currentUserId || reacting) return

    const previousReaction = userReaction
    const previousLikes = likesCount
    const previousDislikes = dislikesCount

    if (previousReaction === type) {
      setUserReaction(null)
      if (type === 'like') setLikesCount((current) => Math.max(0, current - 1))
      else setDislikesCount((current) => Math.max(0, current - 1))
    } else {
      setUserReaction(type)
      if (type === 'like') {
        setLikesCount((current) => current + 1)
        if (previousReaction === 'dislike') setDislikesCount((current) => Math.max(0, current - 1))
      } else {
        setDislikesCount((current) => current + 1)
        if (previousReaction === 'like') setLikesCount((current) => Math.max(0, current - 1))
      }
    }

    setReacting(true)
    try {
      const response = await fetch('/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          targetType: 'reel',
          targetId: String(reel.id),
          type,
        }),
      })

      if (!response.ok) throw new Error('Erro ao reagir.')
    } catch {
      setUserReaction(previousReaction)
      setLikesCount(previousLikes)
      setDislikesCount(previousDislikes)
    } finally {
      setReacting(false)
    }
  }

  const videoUrl = reel.video?.filename ? `/api/media/file/${reel.video.filename}` : null
  const thumbnailUrl = reel.thumbnail?.filename ? `/api/media/file/${reel.thumbnail.filename}` : undefined
  const authorName = reel.author.name || reel.author.username || reel.author.email || 'Criador'
  const username = reel.author.username || reel.author.email || 'user'
  const avatarUrl = reel.author.avatar?.filename
    ? `/api/media/file/${reel.author.avatar.filename}`
    : null

  return (
    <article
      ref={cardRef}
      style={{
        position: 'relative',
        borderRadius: 28,
        overflow: 'hidden',
        background: '#020617',
        border: '1px solid rgba(148, 163, 184, 0.16)',
        minHeight: 620,
      }}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          loop
          muted={isMuted}
          playsInline
          controls
          style={{ width: '100%', height: 620, objectFit: 'cover', background: '#000' }}
        />
      ) : (
        <div
          style={{
            height: 620,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
        >
          Reel sem vídeo.
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(2,6,23,0.10), rgba(2,6,23,0.72) 78%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 18,
          display: 'flex',
          gap: 18,
          alignItems: 'flex-end',
          zIndex: 2,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, color: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                background: '#0f172a',
                flexShrink: 0,
              }}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt={authorName} fill sizes="42px" style={{ objectFit: 'cover' }} />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <Link href={`/u/${username}`} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
                {authorName}
              </Link>
              <div style={{ color: '#cbd5e1', fontSize: 12 }}>@{username}</div>
            </div>
          </div>

          {reel.caption && (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, maxWidth: 420 }}>{reel.caption}</p>
          )}

          <div style={{ display: 'flex', gap: 12, color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>
            <span>{formatRelativeTime(reel.createdAt)}</span>
            <span>{formatDuration(reel.duration)}</span>
            <span>{reel.commentsCount ?? 0} comentários</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, pointerEvents: 'auto' }}>
          <ActionPill
            active={userReaction === 'like'}
            label={`${likesCount}`}
            onClick={() => handleReact('like')}
          >
            ♥
          </ActionPill>
          <ActionPill
            active={userReaction === 'dislike'}
            label={`${dislikesCount}`}
            onClick={() => handleReact('dislike')}
          >
            👎
          </ActionPill>
          <ActionPill active={false} label={isMuted ? 'Som off' : 'Som on'} onClick={() => setIsMuted((current) => !current)}>
            {isMuted ? '🔇' : '🔊'}
          </ActionPill>
        </div>
      </div>
    </article>
  )
}

function ActionPill({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 68,
        minHeight: 68,
        borderRadius: 999,
        border: active ? '1px solid rgba(96,165,250,0.72)' : '1px solid rgba(255,255,255,0.18)',
        background: active ? 'rgba(30, 64, 175, 0.52)' : 'rgba(15, 23, 42, 0.58)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        fontWeight: 700,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{children}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  )
}

function formatDuration(duration?: number | null) {
  const safeDuration = Number(duration ?? 0)
  if (!safeDuration || safeDuration < 1) return 'curto'
  const minutes = Math.floor(safeDuration / 60)
  const seconds = Math.floor(safeDuration % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}
