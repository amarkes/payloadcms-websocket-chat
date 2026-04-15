'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export type PostAuthor = {
  id: number
  name?: string | null
  email: string
  username?: string | null
  avatar?: { filename?: string | null } | null
}

export type PostMediaItem = {
  file?: { filename?: string | null; mimeType?: string | null } | null
}

export type PostData = {
  id: number
  caption?: string | null
  createdAt: string
  likesCount?: number | null
  dislikesCount?: number | null
  commentsCount?: number | null
  visibility: 'public' | 'followers' | 'private'
  author: PostAuthor
  media?: PostMediaItem[] | null
}

interface PostCardProps {
  post: PostData
  currentUserId: number | null
  initialUserReaction?: 'like' | 'dislike' | null
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function renderCaption(caption: string) {
  const parts = caption.split(/(#\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('#') ? (
      <Link
        key={i}
        href={`/explore?tag=${part.slice(1)}`}
        style={{ color: '#60a5fa', textDecoration: 'none' }}
      >
        {part}
      </Link>
    ) : (
      part
    ),
  )
}

export default function PostCard({ post, currentUserId, initialUserReaction = null }: PostCardProps) {
  const router = useRouter()
  const editCaptionRef = useRef<HTMLTextAreaElement | null>(null)
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0)
  const [dislikesCount, setDislikesCount] = useState(post.dislikesCount ?? 0)
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(initialUserReaction)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [reacting, setReacting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCaption, setEditCaption] = useState(post.caption ?? '')
  const [editVisibility, setEditVisibility] = useState(post.visibility)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [actionError, setActionError] = useState('')

  const isOwnPost = currentUserId !== null && currentUserId === post.author.id

  const authorName = post.author.name || post.author.email
  const authorUsername = post.author.username || post.author.email
  const avatarUrl = post.author.avatar?.filename
    ? `/api/media/file/${post.author.avatar.filename}`
    : null
  const mediaItems = (post.media ?? []).filter((m) => m.file?.filename)

  useEffect(() => {
    const onReactionUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{
        targetType: 'post' | 'reel' | 'comment'
        targetId: string
        likesCount: number
        dislikesCount: number
      }>).detail

      if (detail.targetType !== 'post' || detail.targetId !== String(post.id)) return

      setLikesCount(detail.likesCount)
      setDislikesCount(detail.dislikesCount)
    }

    window.addEventListener('social:reaction-update', onReactionUpdate as EventListener)
    return () =>
      window.removeEventListener('social:reaction-update', onReactionUpdate as EventListener)
  }, [post.id])

  async function handleReact(type: 'like' | 'dislike') {
    if (!currentUserId || reacting) return

    const prev = userReaction
    const prevLikes = likesCount
    const prevDislikes = dislikesCount

    // Optimistic update
    if (prev === type) {
      setUserReaction(null)
      if (type === 'like') setLikesCount((c) => Math.max(0, c - 1))
      else setDislikesCount((c) => Math.max(0, c - 1))
    } else {
      setUserReaction(type)
      if (type === 'like') {
        setLikesCount((c) => c + 1)
        if (prev === 'dislike') setDislikesCount((c) => Math.max(0, c - 1))
      } else {
        setDislikesCount((c) => c + 1)
        if (prev === 'like') setLikesCount((c) => Math.max(0, c - 1))
      }
    }

    setReacting(true)
    try {
      const res = await fetch('/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetType: 'post', targetId: String(post.id), type }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setUserReaction(prev)
      setLikesCount(prevLikes)
      setDislikesCount(prevDislikes)
    } finally {
      setReacting(false)
    }
  }

  async function handleSaveEdit() {
    setSaving(true)
    setActionError('')
    try {
      const res = await fetch(`/api/social/post/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ caption: editCaption, visibility: editVisibility }),
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Erro ao salvar.')
      setEditing(false)
      router.refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remover este post?')) return
    setDeleting(true)
    setActionError('')
    try {
      const res = await fetch(`/api/social/post/${post.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Erro ao remover.')
      setDeleted(true)
      router.refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao remover.')
      setDeleting(false)
    }
  }

  if (deleted) return null

  return (
    <div
      data-testid={`post-card-${post.id}`}
      style={{
        background: '#121826',
        border: '1px solid #1f2a3a',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Author row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
        }}
      >
        <Link href={`/u/${authorUsername}`} style={{ flexShrink: 0 }}>
          {avatarUrl ? (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <Image src={avatarUrl} alt={authorName} fill sizes="40px" style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Link
              href={`/u/${authorUsername}`}
              style={{ fontWeight: 600, color: '#f5f7fb', textDecoration: 'none', fontSize: 14 }}
            >
              {authorName}
            </Link>
            <span style={{ color: '#64748b', fontSize: 12 }}>@{authorUsername}</span>
          </div>
        </div>
        <span style={{ color: '#64748b', fontSize: 12, flexShrink: 0 }}>
          {formatRelativeTime(post.createdAt)}
        </span>
        {isOwnPost && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 18,
                padding: '0 4px',
                lineHeight: 1,
              }}
              aria-label="Opcoes"
            >
              ···
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  background: '#1a2235',
                  border: '1px solid #243041',
                  borderRadius: 12,
                  overflow: 'hidden',
                  zIndex: 10,
                  minWidth: 120,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => { setEditing(true); setMenuOpen(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    color: '#f5f7fb',
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => { handleDelete(); setMenuOpen(false) }}
                  disabled={deleting}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid #243041',
                    color: '#ef4444',
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deleting ? 'Removendo...' : 'Remover'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gap: 10 }}>
          <textarea
            ref={editCaptionRef}
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            rows={3}
            autoFocus
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid #243041',
              background: '#0f1724',
              color: '#f5f7fb',
              padding: '10px 12px',
              fontSize: 14,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['public', 'followers', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setEditVisibility(v)}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${editVisibility === v ? '#0070f3' : '#243041'}`,
                  background: editVisibility === v ? 'rgba(0,112,243,0.12)' : '#0f1724',
                  color: editVisibility === v ? '#60a5fa' : '#64748b',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {v === 'public' ? 'Publico' : v === 'followers' ? 'Seguidores' : 'Privado'}
              </button>
            ))}
          </div>
          {actionError && (
            <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{actionError}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: 'none',
                background: saving ? '#1e3a5f' : '#0070f3',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditCaption(post.caption ?? ''); setEditVisibility(post.visibility) }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: '1px solid #243041',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Media */}
      {mediaItems.length > 0 && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#0a0f1a' }}>
          {mediaItems[mediaIndex]?.file?.mimeType?.startsWith('video') ? (
            <video
              src={`/api/media/file/${mediaItems[mediaIndex].file!.filename!}`}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Image
              src={`/api/media/file/${mediaItems[mediaIndex].file!.filename!}`}
              alt={post.caption || 'Post'}
              fill
              sizes="(max-width: 700px) 100vw, 700px"
              style={{ objectFit: 'contain' }}
            />
          )}

          {mediaItems.length > 1 && (
            <>
              {mediaIndex > 0 && (
                <button
                  onClick={() => setMediaIndex((i) => i - 1)}
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ‹
                </button>
              )}
              {mediaIndex < mediaItems.length - 1 && (
                <button
                  onClick={() => setMediaIndex((i) => i + 1)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  ›
                </button>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 4,
                }}
              >
                {mediaItems.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: i === mediaIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div style={{ padding: '12px 16px 8px', color: '#e2e8f0', fontSize: 14, lineHeight: 1.5 }}>
          {renderCaption(post.caption)}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 16px 14px',
        }}
      >
        <button
          aria-label={`Curtir post ${post.id}`}
          onClick={() => handleReact('like')}
          disabled={!currentUserId || reacting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            cursor: currentUserId ? 'pointer' : 'default',
            color: userReaction === 'like' ? '#22c55e' : '#94a3b8',
            fontSize: 14,
            padding: 0,
          }}
        >
          <span style={{ fontSize: 18 }}>👍</span>
          <span>{likesCount}</span>
        </button>
        <button
          aria-label={`Nao curtir post ${post.id}`}
          onClick={() => handleReact('dislike')}
          disabled={!currentUserId || reacting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            cursor: currentUserId ? 'pointer' : 'default',
            color: userReaction === 'dislike' ? '#ef4444' : '#94a3b8',
            fontSize: 14,
            padding: 0,
          }}
        >
          <span style={{ fontSize: 18 }}>👎</span>
          <span>{dislikesCount}</span>
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 14 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span>{post.commentsCount ?? 0}</span>
        </span>
      </div>
    </div>
  )
}
