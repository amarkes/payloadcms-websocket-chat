'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from 'react'

export type PostAuthor = {
  id: number
  name?: string | null
  email: string
  username?: string | null
  avatar?: { filename?: string | null } | null
}

export type PostMediaItem = {
  file?: {
    filename?: string | null
    mimeType?: string | null
    width?: number | null
    height?: number | null
  } | null
}

export type PostReactionChoice = {
  type: 'like' | 'dislike' | 'emoji'
  emoji?: string | null
}

export type PostReactionSummary = PostReactionChoice & {
  key: string
  count: number
  users: PostAuthor[]
}

export type PostComment = {
  id: number
  content: string
  createdAt: string
  parentId?: number | null
  author: PostAuthor
  replies?: PostComment[]
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
  reactionSummaries?: PostReactionSummary[]
  comments?: PostComment[]
  currentUserReaction?: PostReactionChoice | null
}

interface PostCardProps {
  post: PostData
  currentUserId: number | null
  initialUserReaction?: PostReactionChoice | null
  commentsPreviewLimit?: number | null
  showDetailLink?: boolean
}

const emojiOptions = ['❤️', '😂', '😮', '😢', '🔥'] as const

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
        onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
        style={{ color: '#60a5fa', textDecoration: 'none' }}
      >
        {part}
      </Link>
    ) : (
      part
    ),
  )
}

export default function PostCard({
  post,
  currentUserId,
  initialUserReaction = null,
  commentsPreviewLimit = 5,
  showDetailLink = true,
}: PostCardProps) {
  const router = useRouter()
  const editCaptionRef = useRef<HTMLTextAreaElement | null>(null)
  const commentInputRef = useRef<HTMLInputElement | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressReactionClickRef = useRef(false)
  const [likesCount, setLikesCount] = useState(post.likesCount ?? 0)
  const [dislikesCount, setDislikesCount] = useState(post.dislikesCount ?? 0)
  const [commentsCount, setCommentsCount] = useState(post.commentsCount ?? 0)
  const [reactionSummaries, setReactionSummaries] = useState<PostReactionSummary[]>(
    post.reactionSummaries ?? [],
  )
  const [comments, setComments] = useState<PostComment[]>(post.comments ?? [])
  const [visibleRootCommentsCount, setVisibleRootCommentsCount] = useState(() =>
    commentsPreviewLimit === null ? post.comments?.length ?? 0 : commentsPreviewLimit,
  )
  const [userReaction, setUserReaction] = useState<PostReactionChoice | null>(
    initialUserReaction ?? post.currentUserReaction ?? null,
  )
  const [mediaIndex, setMediaIndex] = useState(0)
  const [reacting, setReacting] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [heldReactionKey, setHeldReactionKey] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null)
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState('')
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
  const currentMediaFile = mediaItems[mediaIndex]?.file
  const currentMediaRatio =
    currentMediaFile?.width && currentMediaFile?.height
      ? `${Math.max(0.8, Math.min(1.9, currentMediaFile.width / currentMediaFile.height))} / 1`
      : '4 / 3'

  function applyPostDetails(details?: Partial<PostData> | null) {
    if (!details) return
    setLikesCount(details.likesCount ?? 0)
    setDislikesCount(details.dislikesCount ?? 0)
    setReactionSummaries(details.reactionSummaries ?? [])
    setUserReaction(details.currentUserReaction ?? null)
  }

  function getReactionUsers(type: 'like' | 'dislike') {
    return reactionSummaries.find((summary) => summary.type === type)?.users ?? []
  }

  function formatUsers(users: PostAuthor[]) {
    if (users.length === 0) return ''
    return users.map((user) => user.name || user.username || user.email).join(', ')
  }

  function getUserHandle(user: PostAuthor) {
    return user.username || user.email
  }

  function getDisplayName(user: PostAuthor) {
    return user.name || user.username || user.email
  }

  function getMentionUsers() {
    const users = new Map<string, PostAuthor>()
    users.set(String(post.author.id), post.author)

    for (const comment of comments) {
      users.set(String(comment.author.id), comment.author)
      for (const reply of comment.replies ?? []) {
        users.set(String(reply.author.id), reply.author)
      }
    }

    return Array.from(users.values())
  }

  function getMentionQuery() {
    const match = commentText.match(/(?:^|\s)@([\w.]*)$/)
    return match?.[1]?.toLowerCase() ?? null
  }

  function insertMention(user: PostAuthor) {
    const handle = getUserHandle(user)
    setCommentText((current) => current.replace(/(?:^|\s)@([\w.]*)$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : ''
      return `${prefix}@${handle} `
    }))
    requestAnimationFrame(() => commentInputRef.current?.focus())
  }

  function renderCommentContent(content: string) {
    return content.split(/(@[\w.]+)/g).map((part, index) => {
      if (!part.startsWith('@')) return part

      return (
        <Link
          key={`${part}-${index}`}
          href={`/u/${part.slice(1)}`}
          style={{ color: '#67e8f9', textDecoration: 'none', fontWeight: 700 }}
        >
          {part}
        </Link>
      )
    })
  }

  function startHold(reactionKey: string) {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      suppressReactionClickRef.current = true
      setHeldReactionKey(reactionKey)
    }, 450)
  }

  function stopHold() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  function clearHold() {
    stopHold()
    setHeldReactionKey(null)
  }

  function showReplyForm(comment: PostComment) {
    const handle = getUserHandle(comment.author)
    setReplyTarget(comment.parentId ? comments.find((item) => item.id === comment.parentId) ?? comment : comment)
    setCommentText(`@${handle} `)
    requestAnimationFrame(() => commentInputRef.current?.focus())
  }

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

    const onCommentNew = (event: Event) => {
      const detail = (event as CustomEvent<{
        targetType: 'post' | 'reel'
        targetId: string
        comment?: { authorId?: string; parentId?: string | null }
      }>).detail

      if (detail.targetType !== 'post' || detail.targetId !== String(post.id)) return
      if (String(detail.comment?.authorId) === String(currentUserId)) return
      if (detail.comment?.parentId) return
      setCommentsCount((count) => count + 1)
    }

    window.addEventListener('social:reaction-update', onReactionUpdate as EventListener)
    window.addEventListener('social:comment-new', onCommentNew as EventListener)
    return () => {
      window.removeEventListener('social:reaction-update', onReactionUpdate as EventListener)
      window.removeEventListener('social:comment-new', onCommentNew as EventListener)
    }
  }, [currentUserId, post.id])

  async function handleReact(type: 'like' | 'dislike' | 'emoji', emoji?: string) {
    if (suppressReactionClickRef.current) {
      suppressReactionClickRef.current = false
      return
    }
    if (!currentUserId || reacting) return

    setReacting(true)
    try {
      const res = await fetch('/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ targetType: 'post', targetId: String(post.id), type, emoji }),
      })
      const data = (await res.json()) as { details?: Partial<PostData>; message?: string }
      if (!res.ok) throw new Error(data.message || 'failed')
      applyPostDetails(data.details)
    } catch {
      // Keep the previous UI state if the request fails.
    } finally {
      setReacting(false)
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = commentText.trim()
    if (!currentUserId || !content || commenting) return

    setCommenting(true)
    setCommentError('')
    try {
      const res = await fetch('/api/social/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          targetType: 'post',
          targetId: String(post.id),
          content,
          parentId: replyTarget?.id ?? null,
        }),
      })
      const data = (await res.json()) as { comment?: PostComment; message?: string }
      if (!res.ok || !data.comment) throw new Error(data.message || 'Erro ao comentar.')

      setComments((current) => {
        if (!data.comment?.parentId) return [...current, data.comment!]

        return current.map((comment) =>
          comment.id === data.comment?.parentId
            ? { ...comment, replies: [...(comment.replies ?? []), data.comment] }
            : comment,
        )
      })
      if (!data.comment.parentId) setCommentsCount((count) => count + 1)
      setCommentText('')
      setReplyTarget(null)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Erro ao comentar.')
    } finally {
      setCommenting(false)
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

  const mentionQuery = getMentionQuery()
  const mentionCandidates =
    mentionQuery === null
      ? []
      : getMentionUsers()
          .filter((user) => {
            const handle = getUserHandle(user).toLowerCase()
            const name = getDisplayName(user).toLowerCase()
            return handle.includes(mentionQuery) || name.includes(mentionQuery)
          })
          .slice(0, 5)
  const visibleEmojiSummaries = reactionSummaries.filter(
    (summary) => summary.type === 'emoji' && summary.count > 0 && summary.emoji,
  )
  const visibleComments =
    commentsPreviewLimit === null ? comments : comments.slice(-visibleRootCommentsCount)
  const hiddenCommentsCount =
    commentsPreviewLimit === null ? 0 : Math.max(0, comments.length - visibleComments.length)

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
        {showDetailLink && (
          <Link
            href={`/feed/${post.id}`}
            style={{
              color: '#67e8f9',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            Ver post
          </Link>
        )}
        <Link
          href={`/feed/${post.id}`}
          style={{ color: '#64748b', fontSize: 12, flexShrink: 0, textDecoration: 'none' }}
        >
          {formatRelativeTime(post.createdAt)}
        </Link>
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
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: currentMediaRatio,
            maxHeight: 620,
            background: '#0a0f1a',
          }}
        >
          {mediaItems[mediaIndex]?.file?.mimeType?.startsWith('video') ? (
            <video
              src={`/api/media/file/${mediaItems[mediaIndex].file!.filename!}`}
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
        <div
          role="link"
          tabIndex={0}
          onClick={() => router.push(`/feed/${post.id}`)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              router.push(`/feed/${post.id}`)
            }
          }}
          style={{
            display: 'block',
            padding: '12px 16px 8px',
            color: '#e2e8f0',
            fontSize: 14,
            lineHeight: 1.5,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {renderCaption(post.caption)}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 16px 8px',
        }}
      >
        {([
          { key: 'like', label: '👍', count: likesCount, users: getReactionUsers('like') },
          { key: 'dislike', label: '👎', count: dislikesCount, users: getReactionUsers('dislike') },
        ] as const).map((reaction) => (
          <div key={reaction.key} style={{ position: 'relative' }}>
            <button
              aria-label={reaction.key === 'like' ? `Curtir post ${post.id}` : `Nao curtir post ${post.id}`}
              onClick={() => handleReact(reaction.key)}
              onPointerDown={() => startHold(reaction.key)}
              onPointerUp={clearHold}
              onPointerLeave={clearHold}
              onPointerCancel={clearHold}
              disabled={!currentUserId || reacting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                cursor: currentUserId ? 'pointer' : 'default',
                color:
                  userReaction?.type === reaction.key
                    ? reaction.key === 'like'
                      ? '#22c55e'
                      : '#ef4444'
                    : '#94a3b8',
                fontSize: 14,
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: 18 }}>{reaction.label}</span>
              <span>{reaction.count}</span>
            </button>
            {heldReactionKey === reaction.key && reaction.users.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '100%',
                  marginBottom: 8,
                  width: 220,
                  maxWidth: '70vw',
                  borderRadius: 10,
                  border: '1px solid #334155',
                  background: '#020617',
                  color: '#e2e8f0',
                  padding: '8px 10px',
                  fontSize: 12,
                  lineHeight: 1.4,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                  zIndex: 20,
                }}
              >
                {formatUsers(reaction.users)}
              </div>
            )}
          </div>
        ))}

        <Link
          href={`/feed/${post.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: '#64748b',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          <span>{commentsCount}</span>
        </Link>

        {visibleEmojiSummaries.map((summary) => {
          const emoji = summary.emoji ?? ''
          const active = userReaction?.type === 'emoji' && userReaction.emoji === emoji

          return (
            <div key={summary.key} style={{ position: 'relative' }}>
              <button
                aria-label={`Reagir com ${emoji}`}
                onClick={() => handleReact('emoji', emoji)}
                onPointerDown={() => startHold(summary.key)}
                onPointerUp={clearHold}
                onPointerLeave={clearHold}
                onPointerCancel={clearHold}
                disabled={!currentUserId || reacting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  minHeight: 28,
                  border: `1px solid ${active ? '#22d3ee' : '#243041'}`,
                  borderRadius: 999,
                  background: active ? 'rgba(34, 211, 238, 0.12)' : '#0f1724',
                  color: active ? '#a5f3fc' : '#94a3b8',
                  cursor: currentUserId ? 'pointer' : 'default',
                  padding: '3px 8px',
                  fontSize: 13,
                }}
              >
                <span>{emoji}</span>
                <span>{summary.count}</span>
              </button>
              {heldReactionKey === summary.key && summary.users.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: '100%',
                    marginBottom: 8,
                    width: 220,
                    maxWidth: '70vw',
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#020617',
                    color: '#e2e8f0',
                    padding: '8px 10px',
                    fontSize: 12,
                    lineHeight: 1.4,
                    boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                    zIndex: 20,
                  }}
                >
                  {formatUsers(summary.users)}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Escolher emoticon"
            onClick={() => setEmojiPickerOpen((open) => !open)}
            disabled={!currentUserId}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid #243041',
              background: '#0f1724',
              color: '#94a3b8',
              cursor: currentUserId ? 'pointer' : 'default',
              fontSize: 18,
              lineHeight: '26px',
            }}
          >
            +
          </button>
          {emojiPickerOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                bottom: '100%',
                marginBottom: 8,
                display: 'flex',
                gap: 6,
                padding: 8,
                background: '#020617',
                border: '1px solid #243041',
                borderRadius: 999,
                boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                zIndex: 20,
              }}
            >
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Reagir com ${emoji}`}
                  onClick={() => {
                    void handleReact('emoji', emoji)
                    setEmojiPickerOpen(false)
                  }}
                  disabled={reacting}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: 'none',
                    background: userReaction?.type === 'emoji' && userReaction.emoji === emoji ? '#164e63' : '#0f1724',
                    cursor: 'pointer',
                    fontSize: 17,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1f2a3a', padding: '12px 16px 14px' }}>
        {comments.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {hiddenCommentsCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setVisibleRootCommentsCount((current) =>
                    Math.min(comments.length, current + (commentsPreviewLimit ?? 5)),
                  )
                }
                style={{
                  width: 'fit-content',
                  border: 'none',
                  background: 'none',
                  color: '#67e8f9',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                Mostrar {Math.min(hiddenCommentsCount, commentsPreviewLimit ?? 5)} comentario
                {Math.min(hiddenCommentsCount, commentsPreviewLimit ?? 5) === 1 ? '' : 's'} mais antigo
                {Math.min(hiddenCommentsCount, commentsPreviewLimit ?? 5) === 1 ? '' : 's'}
              </button>
            )}
            {visibleComments.map((comment) => {
              const commentAuthor = getDisplayName(comment.author)

              return (
                <div key={comment.id}>
                  <div style={{ color: '#dbeafe', fontSize: 13, lineHeight: 1.4 }}>
                    <Link
                      href={`/u/${getUserHandle(comment.author)}`}
                      style={{ color: '#f5f7fb', fontWeight: 700, textDecoration: 'none' }}
                    >
                      {commentAuthor}
                    </Link>{' '}
                    <span style={{ color: '#cbd5e1' }}>{renderCommentContent(comment.content)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showReplyForm(comment)}
                    style={{
                      marginTop: 4,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      color: '#64748b',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Responder
                  </button>

                  {(comment.replies ?? []).length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gap: 7,
                        marginTop: 8,
                        marginLeft: 18,
                        paddingLeft: 10,
                        borderLeft: '1px solid #243041',
                      }}
                    >
                      {(comment.replies ?? []).map((reply) => (
                        <div key={reply.id}>
                          <div style={{ color: '#dbeafe', fontSize: 13, lineHeight: 1.4 }}>
                            <Link
                              href={`/u/${getUserHandle(reply.author)}`}
                              style={{ color: '#f5f7fb', fontWeight: 700, textDecoration: 'none' }}
                            >
                              {getDisplayName(reply.author)}
                            </Link>{' '}
                            <span style={{ color: '#cbd5e1' }}>
                              {renderCommentContent(reply.content)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => showReplyForm(reply)}
                            style={{
                              marginTop: 4,
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              color: '#64748b',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Responder
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {replyTarget && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 8,
              color: '#94a3b8',
              fontSize: 12,
            }}
          >
            <span>Respondendo @{getUserHandle(replyTarget.author)}</span>
            <button
              type="button"
              onClick={() => {
                setReplyTarget(null)
                setCommentText('')
              }}
              style={{
                border: 'none',
                background: 'none',
                color: '#67e8f9',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
              }}
            >
              cancelar
            </button>
          </div>
        )}

        <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {mentionCandidates.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 58,
                bottom: '100%',
                marginBottom: 8,
                border: '1px solid #243041',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#020617',
                boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                zIndex: 15,
              }}
            >
              {mentionCandidates.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => insertMention(user)}
                  style={{
                    display: 'block',
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid #111827',
                    background: 'transparent',
                    color: '#e2e8f0',
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {getDisplayName(user)} <span style={{ color: '#64748b' }}>@{getUserHandle(user)}</span>
                </button>
              ))}
            </div>
          )}
          <input
            ref={commentInputRef}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            disabled={!currentUserId || commenting}
            maxLength={500}
            placeholder={replyTarget ? 'Escreva uma resposta...' : 'Escreva um comentario...'}
            style={{
              flex: 1,
              minWidth: 0,
              height: 38,
              borderRadius: 10,
              border: '1px solid #243041',
              background: '#0f1724',
              color: '#f5f7fb',
              padding: '0 12px',
              outline: 'none',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={!currentUserId || commenting || !commentText.trim()}
            style={{
              height: 38,
              borderRadius: 10,
              border: 'none',
              background: !commentText.trim() || commenting ? '#1e293b' : '#06b6d4',
              color: '#fff',
              padding: '0 14px',
              fontWeight: 700,
              cursor: !commentText.trim() || commenting ? 'not-allowed' : 'pointer',
            }}
          >
            {commenting ? '...' : 'Enviar'}
          </button>
        </form>
        {commentError && (
          <p style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0' }}>{commentError}</p>
        )}
      </div>
    </div>
  )
}
