import type { BasePayload } from 'payload'

const STORIES_CLEANUP_INTERVAL_KEY = Symbol.for('payloadcms.stories.cleanup.interval')

type GlobalWithCleanup = typeof globalThis & {
  [STORIES_CLEANUP_INTERVAL_KEY]?: NodeJS.Timeout
}

export async function cleanupExpiredStories(payload: BasePayload) {
  return payload.delete({
    collection: 'stories',
    where: {
      expiresAt: {
        less_than: new Date().toISOString(),
      },
    },
    overrideAccess: true,
  })
}

export function startStoriesCleanupJob(payload: BasePayload) {
  const runtime = globalThis as GlobalWithCleanup

  if (runtime[STORIES_CLEANUP_INTERVAL_KEY]) {
    return
  }

  const intervalMs = Math.max(
    60_000,
    Number(process.env.STORIES_CLEANUP_INTERVAL_MS ?? 5 * 60_000),
  )

  void cleanupExpiredStories(payload).catch(() => null)

  const timer = setInterval(() => {
    void cleanupExpiredStories(payload).catch(() => null)
  }, intervalMs)

  timer.unref?.()
  runtime[STORIES_CLEANUP_INTERVAL_KEY] = timer
}
