'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, Volume2, VolumeX } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState, type ReactNode } from 'react'

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
  comments?: ReelComment[]
}

export type ReelComment = {
  id: number
  content: string
  createdAt: string
  author: ReelAuthor
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
  const [comments, setComments] = useState<ReelComment[]>(reel.comments ?? [])
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount ?? 0)
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [isMuted, setIsMuted] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [reacting, setReacting] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLikesCount(reel.likesCount ?? 0)
    setDislikesCount(reel.dislikesCount ?? 0)
    setUserReaction(initialUserReaction)
    setComments(reel.comments ?? [])
    setCommentsCount(reel.commentsCount ?? 0)
    setCommentText('')
    setCommentError('')
    setVideoCurrentTime(0)
    setVideoDuration(0)
    setIsPaused(false)
    setReacting(false)

    const video = videoRef.current
    if (!video) return

    video.pause()
    video.currentTime = 0
    video.load()
    void video.play().catch(() => null)
  }, [initialUserReaction, reel.dislikesCount, reel.id, reel.likesCount])

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video
        .play()
        .then(() => setIsPaused(false))
        .catch(() => null)
      return
    }

    video.pause()
    setIsPaused(true)
  }

  async function handleShare() {
    const url = `${window.location.origin}/reels?username=${encodeURIComponent(username)}`
    if (navigator.share) {
      await navigator.share({ title: reel.caption || 'Reel', url }).catch(() => null)
      return
    }

    await navigator.clipboard?.writeText(url).catch(() => null)
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = commentText.trim()
    if (!currentUserId || !content || commenting) return

    setCommenting(true)
    setCommentError('')

    try {
      const response = await fetch('/api/social/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          targetType: 'reel',
          targetId: String(reel.id),
          content,
        }),
      })
      const data = (await response.json()) as { comment?: ReelComment; message?: string }

      if (!response.ok || !data.comment) throw new Error(data.message || 'Erro ao comentar.')

      setComments((current) => [...current, data.comment!])
      setCommentsCount((count) => count + 1)
      setCommentText('')
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Erro ao comentar.')
    } finally {
      setCommenting(false)
    }
  }

  useEffect(() => {
    const onReactionUpdate = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          targetType: 'post' | 'reel' | 'comment'
          targetId: string
          likesCount: number
          dislikesCount: number
        }>
      ).detail

      if (detail.targetType !== 'reel' || detail.targetId !== String(reel.id)) return

      setLikesCount(detail.likesCount)
      setDislikesCount(detail.dislikesCount)
    }

    window.addEventListener('social:reaction-update', onReactionUpdate as EventListener)
    return () =>
      window.removeEventListener('social:reaction-update', onReactionUpdate as EventListener)
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
  const thumbnailUrl = reel.thumbnail?.filename
    ? `/api/media/file/${reel.thumbnail.filename}`
    : undefined
  const authorName = reel.author.name || reel.author.username || reel.author.email || 'Criador'
  const username = reel.author.username || reel.author.email || 'user'
  const avatarUrl = reel.author.avatar?.filename
    ? `/api/media/file/${reel.author.avatar.filename}`
    : null
  const progress = videoDuration > 0 ? Math.min(100, (videoCurrentTime / videoDuration) * 100) : 0

  return (
    <>
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
            key={reel.id}
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            loop
            muted={isMuted}
            playsInline
            onClick={togglePlayback}
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
            onLoadedMetadata={(event) => {
              setVideoDuration(event.currentTarget.duration || 0)
            }}
            onTimeUpdate={(event) => {
              setVideoCurrentTime(event.currentTarget.currentTime || 0)
              setVideoDuration(event.currentTarget.duration || 0)
            }}
            style={{
              width: '100%',
              height: 'min(78vh, 760px)',
              minHeight: 640,
              objectFit: 'cover',
              background: '#000',
              cursor: 'pointer',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              height: 'min(78vh, 760px)',
              minHeight: 640,
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
            background:
              'linear-gradient(180deg, rgba(2,6,23,0.04), rgba(2,6,23,0.18) 45%, rgba(2,6,23,0.82) 100%)',
            pointerEvents: 'none',
          }}
        />

        {isPaused && (
          <button
            type="button"
            onClick={togglePlayback}
            aria-label="Reproduzir reel"
            style={{
              position: 'absolute',
              inset: 0,
              margin: 'auto',
              width: 82,
              height: 82,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(2, 6, 23, 0.46)',
              color: '#fff',
              fontSize: 34,
              zIndex: 4,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            ▶
          </button>
        )}

        <div
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 24,
            display: 'flex',
            gap: 18,
            alignItems: 'flex-end',
            zIndex: 2,
          }}
        >
          <div style={{ minWidth: 0, flex: 1, color: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Link
                href={`/u/${username}`}
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
                  <Image
                    src={avatarUrl}
                    alt={authorName}
                    fill
                    sizes="35px"
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
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>

              <div
                style={{
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Link
                  href={`/u/${username}`}
                  style={{ fontSize: 14, color: '#fff', textDecoration: 'none', fontWeight: 700 }}
                >
                  {authorName}
                </Link>
                {currentUserId !== reel.author.id && (
                  <button
                    type="button"
                    onClick={() =>
                      fetch(`/api/social/follow/${reel.author.id}`, {
                        method: 'POST',
                        credentials: 'same-origin',
                      })
                    }
                    style={{
                      height: 26,
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.38)',
                      background: 'rgba(2,6,23,0.24)',
                      color: '#fff',
                      padding: '0 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Seguir
                  </button>
                )}
              </div>
            </div>

            {reel.caption && (
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, maxWidth: 420 }}>
                {reel.caption}
              </p>
            )}

            <div
              style={{ display: 'flex', gap: 12, color: '#cbd5e1', fontSize: 12, marginTop: 10 }}
            >
              <span>{formatRelativeTime(reel.createdAt)}</span>
              <span>{formatDuration(reel.duration)}</span>
              <span>{commentsCount} comentários</span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, pointerEvents: 'auto' }}>
            <ActionPill
              active={userReaction === 'like'}
              label={`${likesCount}`}
              onClick={() => handleReact('like')}
            >
              <Heart size={20} fill="currentColor" strokeWidth={0} />
            </ActionPill>
            <ActionPill active label={`${commentsCount}`} onClick={() => null}>
              <MessageCircle size={20} />
            </ActionPill>
            <ActionPill
              active={false}
              label="Share"
              showLabel={false}
              onClick={() => void handleShare()}
            >
              <Share2 size={20} />
            </ActionPill>
            <ActionPill
              active={false}
              showLabel={false}
              label={isMuted ? 'Som off' : 'Som on'}
              onClick={() => setIsMuted((current) => !current)}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </ActionPill>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 5,
            background: 'rgba(148, 163, 184, 0.16)',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#22d3ee',
              transform: `scaleX(${progress / 100})`,
              transformOrigin: 'left center',
              transition: 'transform 80ms linear',
            }}
          />
        </div>
      </article>

      <div
        style={{
          position: 'absolute',
          left: 'calc(100% + 80px)',
          top: 0,
          zIndex: 8,
          width: 360,
          maxWidth: 'calc(100vw - 520px)',
          height: 'min(78vh, 760px)',
          minHeight: 640,
          borderRadius: 22,
          border: '1px solid rgba(255, 255, 255, 0.14)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(15, 23, 42, 0.38))',
          padding: 16,
          color: '#f8fafc',
          boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <strong style={{ color: '#22d3ee', fontSize: 18 }}>Comentarios</strong>
          <span
            style={{
              minWidth: 24,
              height: 16,
              borderRadius: 999,
              background: 'rgba(34, 211, 238, 0.22)',
              color: '#67e8f9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {commentsCount}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            alignContent: 'start',
            gap: 14,
            flex: 1,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {comments.length === 0 ? (
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13 }}>Nenhum comentario ainda.</p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.4 }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: '#2563eb',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {(comment.author.name || comment.author.username || comment.author.email || '?')
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#22d3ee', fontSize: 12, fontWeight: 800 }}>
                    @{comment.author.username || comment.author.email || comment.author.name}
                  </div>
                  <div style={{ color: '#e2e8f0' }}>{comment.content}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleCommentSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <input
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            disabled={!currentUserId || commenting}
            placeholder="Adicionar comentario..."
            style={{
              minWidth: 0,
              flex: 1,
              height: 40,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(2, 6, 23, 0.52)',
              color: '#fff',
              padding: '0 14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!commentText.trim() || commenting}
            style={{
              border: 'none',
              borderRadius: 999,
              background: '#22d3ee',
              color: '#020617',
              height: 40,
              padding: '0 14px',
              fontSize: 12,
              fontWeight: 900,
              cursor: !commentText.trim() || commenting ? 'not-allowed' : 'pointer',
              opacity: !commentText.trim() || commenting ? 0.55 : 1,
            }}
          >
            POST
          </button>
        </form>
        {commentError && (
          <p style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0' }}>{commentError}</p>
        )}
      </div>
    </>
  )
}

function ActionPill({
  active = false,
  showLabel = true,
  children,
  label,
  onClick,
}: {
  active?: boolean
  showLabel?: boolean
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 55,
        height: 55,
        minHeight: 55,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(15, 23, 42, 0.3)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        gridTemplateRows: '30px 16px',
        cursor: 'pointer',
        backdropFilter: 'blur(5px)',
        fontWeight: 700,
        padding: 2,
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, lineHeight: 1 }}>
        {children}
      </span>
      {showLabel && <span style={{ fontSize: 8, whiteSpace: 'nowrap' }}>{label}</span>}
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
