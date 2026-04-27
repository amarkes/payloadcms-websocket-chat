import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

interface WhoToFollowProps {
  currentUserId?: number | string
  followingIds?: Array<string | number>
}

export default async function WhoToFollow({ currentUserId, followingIds = [] }: WhoToFollowProps) {
  const t = await getTranslations('whoToFollow')

  let suggestions: Array<User & { username?: string | null }> = []

  if (currentUserId) {
    try {
      const payload = await getPayload({ config: await config })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = payload as any
      const excludeIds = [currentUserId, ...followingIds].map(String)

      const result = await p.find({
        collection: 'users',
        limit: 5,
        overrideAccess: true,
        depth: 1,
      })

      suggestions = (result.docs as Array<User & { username?: string | null }>).filter(
        (u) => !excludeIds.includes(String(u.id)),
      )
    } catch {
      // silent fail — show empty state
    }
  }

  if (!suggestions.length) return null

  return (
    <div className="rounded-2xl border border-neutral-300/20 bg-neutral-200 p-4">
      <h3 className="text-sm font-semibold text-neutral-800 mb-3">{t('title')}</h3>

      <div className="flex flex-col gap-3">
        {suggestions.map((user) => {
          const name = user.name ?? user.email
          const uname = user.username ?? user.email
          const avatarUrl =
            user.avatar &&
            typeof user.avatar === 'object' &&
            'filename' in user.avatar &&
            user.avatar.filename
              ? `/api/media/file/${user.avatar.filename}`
              : null
          const initial = name[0]?.toUpperCase() ?? '?'

          return (
            <div key={user.id} className="flex items-center gap-3">
              <div className="shrink-0">
                {avatarUrl ? (
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-neutral-300/20">
                    <Image
                      src={avatarUrl}
                      alt={name}
                      width={36}
                      height={36}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-tertiary/30 border border-neutral-300/20 flex items-center justify-center text-neutral-700 font-bold text-xs">
                    {initial}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-800 truncate leading-tight">
                  {name}
                </p>
                <p className="text-xs text-neutral-500 truncate">@{uname}</p>
              </div>

              <FollowBtn userId={String(user.id)} label={t('follow')} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FollowBtn({ userId, label }: { userId: string; label: string }) {
  return (
    <form action={`/api/social/follow`} method="POST">
      <input type="hidden" name="followingId" value={userId} />
      <button
        type="submit"
        className="px-3 py-1 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors shrink-0"
      >
        {label}
      </button>
    </form>
  )
}
