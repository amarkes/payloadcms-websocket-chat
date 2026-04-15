'use client'

import { useEffect, useRef, useState } from 'react'
import PostCard, { type PostData } from './PostCard'

interface FeedScrollerProps {
  initialDocs: PostData[]
  initialTotalPages: number
  initialPage: number
  feedUrl: string
  currentUserId: number | null
  initialUserReactions?: Record<string, 'like' | 'dislike'>
}

export default function FeedScroller({
  initialDocs,
  initialTotalPages,
  initialPage,
  feedUrl,
  currentUserId,
  initialUserReactions = {},
}: FeedScrollerProps) {
  const [docs, setDocs] = useState<PostData[]>(initialDocs)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reset when feedUrl changes (e.g. navigating between /feed and explore)
  useEffect(() => {
    setDocs(initialDocs)
    setPage(initialPage)
    setTotalPages(initialTotalPages)
    setError('')
  }, [feedUrl, initialDocs, initialPage, initialTotalPages])

  async function fetchNextPage(nextPage: number) {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError('')

    try {
      const separator = feedUrl.includes('?') ? '&' : '?'
      const res = await fetch(`${feedUrl}${separator}page=${nextPage}&limit=10`, {
        credentials: 'same-origin',
      })
      const data = (await res.json()) as {
        docs?: PostData[]
        totalPages?: number
        page?: number
        message?: string
      }

      if (!res.ok || !Array.isArray(data.docs)) {
        throw new Error(data.message || 'Erro ao carregar posts.')
      }

      setDocs((prev) => {
        const existingIds = new Set(prev.map((d) => d.id))
        const newDocs = (data.docs ?? []).filter((d) => !existingIds.has(d.id))
        return [...prev, ...newDocs]
      })
      setPage(Number(data.page) || nextPage)
      setTotalPages(Number(data.totalPages) || 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar posts.')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          setPage((prev) => {
            const nextPage = prev + 1
            if (nextPage <= totalPages) {
              void fetchNextPage(nextPage)
            }
            return prev
          })
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, feedUrl])

  if (docs.length === 0 && !loading) {
    return (
      <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 15 }}>
        Nenhum post ainda. Siga alguem ou explore novos perfis.
      </p>
    )
  }

  return (
    <div>
      {docs.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          initialUserReaction={initialUserReactions[String(post.id)] ?? null}
        />
      ))}

      {error && (
        <p style={{ color: '#fca5a5', textAlign: 'center', fontSize: 13, margin: '12px 0' }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ color: '#64748b', textAlign: 'center', fontSize: 13, margin: '12px 0' }}>
          Carregando...
        </p>
      )}

      {/* Sentinel for IntersectionObserver */}
      {page < totalPages && <div ref={sentinelRef} style={{ height: 40 }} />}
    </div>
  )
}
