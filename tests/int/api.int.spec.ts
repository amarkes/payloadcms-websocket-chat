/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from 'crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import config from '@/payload.config'
import { getAuthenticatedUser, getPayloadClient } from '@/lib/chat-auth'
import * as followRoute from '@/app/api/social/follow/[userId]/route'
import * as reactRoute from '@/app/api/social/react/route'
import * as storiesActiveRoute from '@/app/api/stories/active/route'
import * as storiesViewRoute from '@/app/api/stories/[id]/view/route'
import * as exploreRoute from '@/app/api/social/feed/explore/route'

vi.mock('@/lib/chat-auth', () => ({
  getAuthenticatedUser: vi.fn(),
  getPayloadClient: vi.fn(),
}))

type CleanupEntry = {
  collection: string
  id: number | string
}

let payload: Payload
const cleanupEntries: CleanupEntry[] = []
const mockedGetAuthenticatedUser = vi.mocked(getAuthenticatedUser)
const mockedGetPayloadClient = vi.mocked(getPayloadClient)

beforeAll(async () => {
  const payloadConfig = await config
  payload = await getPayload({ config: payloadConfig })
})

afterEach(async () => {
  while (cleanupEntries.length > 0) {
    const entry = cleanupEntries.pop()!

    await (payload as any)
      .delete({
        collection: entry.collection,
        id: entry.id,
        overrideAccess: true,
      })
      .catch(() => null)
  }

  vi.clearAllMocks()
})

async function createUser(overrides?: Partial<{
  email: string
  isPrivate: boolean
  name: string
  password: string
  username: string
}>) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 100000)}`
  const user = await payload.create({
    collection: 'users',
    data: {
      name: overrides?.name || `User ${unique}`,
      username: overrides?.username ? `${overrides.username}-${unique}` : `spec-${unique}`,
      email: overrides?.email || `spec-${unique}@example.com`,
      password: overrides?.password || 'password123',
      isPrivate: overrides?.isPrivate ?? false,
    },
    overrideAccess: true,
    depth: 0,
  })

  cleanupEntries.push({ collection: 'users', id: user.id })
  return user
}

async function createMediaStub({
  alt,
  filename,
  mimeType,
}: {
  alt: string
  filename: string
  mimeType: string
}) {
  const ext = path.extname(filename) || (mimeType.startsWith('image/') ? '.png' : '.mp4')
  const filePath = path.join(tmpdir(), `payload-media-${randomUUID()}${ext}`)

  try {
    await writeFile(
      filePath,
      mimeType.startsWith('image/') ? createTinyPngBuffer() : createTinyMp4Buffer(),
    )

    const media = await (payload as any).create({
      collection: 'media',
      data: {
        alt,
      },
      filePath,
      overrideAccess: true,
      depth: 0,
    })

    cleanupEntries.push({ collection: 'media', id: media.id })
    return media
  } finally {
    await unlink(filePath).catch(() => null)
  }
}

function createTinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZxX8AAAAASUVORK5CYII=',
    'base64',
  )
}

function createTinyMp4Buffer() {
  return Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')
}

describe('Social API', () => {
  it('toggles follows and reactions through the custom endpoints', async () => {
    const follower = await createUser({ username: 'spec-follower' })
    const author = await createUser({ username: 'spec-author' })

    mockedGetAuthenticatedUser.mockResolvedValue({ payload, user: follower } as any)

    const followResponse = await followRoute.POST(new Request('http://localhost/api/social/follow'), {
      params: Promise.resolve({ userId: String(author.id) }),
    })
    expect(followResponse.status).toBe(200)
    await expect(followResponse.json()).resolves.toMatchObject({ action: 'followed' })

    const post = await (payload as any).create({
      collection: 'posts',
      data: {
        author: author.id,
        caption: 'post para curtir',
        visibility: 'public',
      },
      overrideAccess: true,
      depth: 0,
    })
    cleanupEntries.push({ collection: 'posts', id: post.id })

    const addReactionResponse = await reactRoute.POST(
      new Request('http://localhost/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'post',
          targetId: String(post.id),
          type: 'like',
        }),
      }),
    )

    expect(addReactionResponse.status).toBe(200)
    await expect(addReactionResponse.json()).resolves.toMatchObject({ action: 'added', type: 'like' })

    const likedPost = await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(likedPost.likesCount).toBe(1)

    const removeReactionResponse = await reactRoute.POST(
      new Request('http://localhost/api/social/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'post',
          targetId: String(post.id),
          type: 'like',
        }),
      }),
    )

    expect(removeReactionResponse.status).toBe(200)
    await expect(removeReactionResponse.json()).resolves.toMatchObject({ action: 'removed', type: 'like' })

    const neutralPost = await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(neutralPost.likesCount).toBe(0)
  })

  it('returns active stories for followed users and records unique views', async () => {
    const viewer = await createUser({ username: 'spec-viewer' })
    const author = await createUser({ username: 'spec-story-author', isPrivate: true })
    const media = await createMediaStub({
      alt: 'story-media',
      filename: 'story.png',
      mimeType: 'image/png',
    })

    const follow = await (payload as any).create({
      collection: 'follows',
      data: {
        follower: viewer.id,
        following: author.id,
        status: 'accepted',
      },
      overrideAccess: true,
      depth: 0,
    })
    cleanupEntries.push({ collection: 'follows', id: follow.id })

    const story = await (payload as any).create({
      collection: 'stories',
      data: {
        author: author.id,
        media: media.id,
        caption: 'story ativa',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      overrideAccess: true,
      depth: 0,
    })
    cleanupEntries.push({ collection: 'stories', id: story.id })

    mockedGetAuthenticatedUser.mockResolvedValue({ payload, user: viewer } as any)

    const activeResponse = await storiesActiveRoute.GET()
    expect(activeResponse.status).toBe(200)

    const activeData = (await activeResponse.json()) as {
      groups: Array<{ author: { id: string }; stories: Array<{ id: string }> }>
      totalStories: number
    }

    expect(activeData.totalStories).toBe(1)
    expect(activeData.groups.some((group) => group.author.id === String(author.id))).toBe(true)

    const firstView = await storiesViewRoute.POST(new Request('http://localhost/api/stories/view'), {
      params: Promise.resolve({ id: String(story.id) }),
    })
    expect(firstView.status).toBe(200)
    await expect(firstView.json()).resolves.toMatchObject({ viewed: true, viewsCount: 1 })

    const secondView = await storiesViewRoute.POST(new Request('http://localhost/api/stories/view'), {
      params: Promise.resolve({ id: String(story.id) }),
    })
    expect(secondView.status).toBe(200)
    await expect(secondView.json()).resolves.toMatchObject({ viewed: true, viewsCount: 1 })
  })

  it('filters the explore feed by hashtag', async () => {
    const author = await createUser({ username: 'spec-explore-author' })

    const matchingPost = await (payload as any).create({
      collection: 'posts',
      data: {
        author: author.id,
        caption: 'Post com #Payload e #Realtime',
        visibility: 'public',
      },
      overrideAccess: true,
      depth: 0,
    })
    cleanupEntries.push({ collection: 'posts', id: matchingPost.id })

    const otherPost = await (payload as any).create({
      collection: 'posts',
      data: {
        author: author.id,
        caption: 'Post sem a hashtag procurada',
        visibility: 'public',
      },
      overrideAccess: true,
      depth: 0,
    })
    cleanupEntries.push({ collection: 'posts', id: otherPost.id })

    mockedGetPayloadClient.mockResolvedValue(payload)

    const response = await exploreRoute.GET(
      new Request('http://localhost/api/social/feed/explore?tag=payload'),
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      docs: Array<{ id: number; caption?: string }>
    }

    expect(data.docs).toHaveLength(1)
    expect(data.docs[0]?.id).toBe(matchingPost.id)
  })

  it('generates a thumbnail when a reel is created', async () => {
    const author = await createUser({ username: 'spec-reel-author' })
    const video = await createMediaStub({
      alt: 'reel-video',
      filename: 'clip.mp4',
      mimeType: 'video/mp4',
    })

    const reel = await (payload as any).create({
      collection: 'reels',
      data: {
        author: author.id,
        video: video.id,
        caption: 'reel com thumbnail',
        visibility: 'public',
      },
      overrideAccess: true,
      depth: 1,
    })

    const storedReel = await (payload as any).findByID({
      collection: 'reels',
      id: reel.id,
      depth: 1,
      overrideAccess: true,
    })

    const thumbnailId =
      typeof storedReel.thumbnail === 'object' && storedReel.thumbnail !== null
        ? storedReel.thumbnail.id
        : storedReel.thumbnail

    if (thumbnailId) {
      cleanupEntries.push({ collection: 'media', id: thumbnailId })
    }

    cleanupEntries.push({ collection: 'reels', id: reel.id })

    expect(storedReel.thumbnail).toBeTruthy()
  })
})
