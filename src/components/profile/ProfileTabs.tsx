'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Grid3x3, Film, Tag } from 'lucide-react'
import type { PostData } from '@/components/social/PostCard'

interface ProfileTabsProps {
  posts: PostData[]
  reels: any[]
  profileUsername: string
  postsLabel: string
  reelsLabel: string
  taggedLabel: string
  noPostsLabel: string
  noReelsLabel: string
  viewAllLabel: string
}

type Tab = 'posts' | 'reels' | 'tagged'

export default function ProfileTabs({
  posts,
  reels,
  profileUsername,
  postsLabel,
  reelsLabel,
  taggedLabel,
  noPostsLabel,
  noReelsLabel,
  viewAllLabel,
}: ProfileTabsProps) {
  const [tab, setTab] = useState<Tab>('posts')

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'posts', label: postsLabel, icon: Grid3x3 },
    { key: 'reels', label: reelsLabel, icon: Film },
    { key: 'tagged', label: taggedLabel, icon: Tag },
  ]

  return (
    <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-300/20">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2',
              tab === key
                ? 'text-primary border-primary'
                : 'text-neutral-500 border-transparent hover:text-neutral-700',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3">
        {tab === 'posts' && (
          posts.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 py-10">{noPostsLabel}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((post) => {
                const firstMedia = post.media?.[0]?.file?.filename
                return (
                  <Link
                    key={post.id}
                    href="/feed"
                    className="block aspect-square rounded-xl overflow-hidden relative bg-neutral-300/20 hover:opacity-90 transition-opacity"
                  >
                    {firstMedia ? (
                      <Image
                        src={`/api/media/file/${firstMedia}`}
                        alt={post.caption || 'Post'}
                        fill
                        sizes="33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center">
                        <p className="text-neutral-500 text-[10px] leading-tight line-clamp-3">
                          {post.caption?.slice(0, 60) || ''}
                        </p>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        )}

        {tab === 'reels' && (
          reels.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 py-10">{noReelsLabel}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {reels.map((reel) => (
                <Link
                  key={reel.id}
                  href={`/reels?username=${encodeURIComponent(profileUsername)}`}
                  className="block aspect-[9/16] rounded-xl overflow-hidden relative bg-neutral-300/20 hover:opacity-90 transition-opacity"
                >
                  {reel.thumbnail?.filename ? (
                    <Image
                      src={`/api/media/file/${reel.thumbnail.filename}`}
                      alt={reel.caption || 'Reel'}
                      fill
                      sizes="33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-tertiary/40 to-secondary/30 flex items-center justify-center">
                      <Film size={24} className="text-neutral-400" />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )
        )}

        {tab === 'tagged' && (
          <p className="text-center text-sm text-neutral-500 py-10">Em breve</p>
        )}
      </div>
    </div>
  )
}
