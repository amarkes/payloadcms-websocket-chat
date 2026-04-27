'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import ReelPlayer, { type ReelData } from '@/components/social/ReelPlayer'

interface ReelsNavigatorProps {
  reels: ReelData[]
  currentUserId: number | null
  reactionMap: Record<string, 'like' | 'dislike'>
  prevLabel: string
  nextLabel: string
}

export default function ReelsNavigator({
  reels,
  currentUserId,
  reactionMap,
  prevLabel,
  nextLabel,
}: ReelsNavigatorProps) {
  const [index, setIndex] = useState(0)

  const current = reels[index]
  if (!current) return null

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] relative">
      <div className="relative flex items-center gap-5">
        {/* Phone frame wrapper */}
        <div className="relative w-[min(430px,calc(100vw-96px))]">
        <ReelPlayer
          key={current.id}
          reel={current}
          currentUserId={currentUserId}
          initialUserReaction={reactionMap[String(current.id)] ?? null}
        />
        </div>

        {/* Navigation arrows */}
        <div className="flex flex-col gap-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label={prevLabel}
          className="w-10 h-10 rounded-full border border-neutral-300/20 bg-neutral-200 text-neutral-600 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(reels.length - 1, i + 1))}
          disabled={index === reels.length - 1}
          aria-label={nextLabel}
          className="w-10 h-10 rounded-full border border-neutral-300/20 bg-neutral-200 text-neutral-600 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <ChevronDown size={18} />
        </button>
        </div>
      </div>

      {/* Counter */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {reels.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={[
              'h-1 rounded-full transition-all',
              i === index ? 'w-6 bg-primary' : 'w-1.5 bg-neutral-500',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
