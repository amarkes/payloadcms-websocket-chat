import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TrendingUp } from 'lucide-react'

interface TrendingTopic {
  tag: string
  category: string
  vibes: string
  isLive?: boolean
}

interface TrendingTopicsProps {
  topics?: TrendingTopic[]
}

const DEFAULT_TOPICS: TrendingTopic[] = [
  { tag: '#Web3Gaming', category: 'TECHNOLOGY', vibes: '42.5k', isLive: true },
  { tag: '#NeonFestival2024', category: 'MUSIC', vibes: '12k', isLive: true },
  { tag: '#GlassmorphismTips', category: 'ART & DESIGN', vibes: '8.9k' },
  { tag: '#CryptoArt', category: 'TECHNOLOGY', vibes: '6.1k' },
  { tag: '#Metaverse', category: 'TECH', vibes: '21.3k' },
]

export default async function TrendingTopics({ topics = DEFAULT_TOPICS }: TrendingTopicsProps) {
  const t = await getTranslations('trending')

  return (
    <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} className="text-primary" />
        <h3 className="text-sm font-semibold text-neutral-800">{t('title')}</h3>
      </div>

      <div className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <Link
            key={topic.tag}
            href={`/explore?tag=${topic.tag.slice(1)}`}
            className="group flex flex-col px-2 py-2.5 rounded-xl hover:bg-neutral-300/20 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {topic.category}
              </span>
              {topic.isLive && (
                <span className="px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary text-[9px] font-bold uppercase tracking-wider">
                  LIVE
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-neutral-800 group-hover:text-primary transition-colors">
              {topic.tag}
            </span>
            <span className="text-xs text-neutral-500 mt-0.5">
              {topic.vibes} {t('vibes')}
            </span>
          </Link>
        ))}
      </div>

      <button className="mt-2 w-full text-xs text-primary font-medium hover:underline text-left px-2 py-1">
        {t('showMore')}
      </button>
    </div>
  )
}
