/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BasePayload } from 'payload'
import { getAcceptedFollowingIds } from './social-access'
import { normalizeRelationshipIds, resolveRelationshipId } from './social-utils'

export interface StoryMediaData {
  filename?: string | null
  mimeType?: string | null
}

export interface StoryAuthorData {
  id: string
  name?: string | null
  username?: string | null
  avatar?: StoryMediaData | null
}

export interface StoryItemData {
  id: string
  author: StoryAuthorData
  caption?: string | null
  createdAt: string
  expiresAt: string
  media?: StoryMediaData | null
  viewed: boolean
  viewsCount: number
}

export interface StoryGroupData {
  author: StoryAuthorData
  hasUnviewed: boolean
  latestCreatedAt: string
  stories: StoryItemData[]
}

function toStoryItem(doc: any, viewerId?: string | number | null): StoryItemData {
  const viewedIds = normalizeRelationshipIds(doc.viewedBy)
  const authorId = resolveRelationshipId(doc.author)
  const author =
    typeof doc.author === 'object' && doc.author !== null
      ? doc.author
      : { id: authorId }

  return {
    id: String(doc.id),
    author: {
      id: String(resolveRelationshipId(author) ?? ''),
      name: author?.name ?? null,
      username: author?.username ?? null,
      avatar:
        author?.avatar && typeof author.avatar === 'object'
          ? {
              filename: author.avatar.filename ?? null,
              mimeType: author.avatar.mimeType ?? null,
            }
          : null,
    },
    caption: doc.caption ?? null,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    media:
      doc.media && typeof doc.media === 'object'
        ? {
            filename: doc.media.filename ?? null,
            mimeType: doc.media.mimeType ?? null,
          }
        : null,
    viewed: viewerId ? viewedIds.some((id) => String(id) === String(viewerId)) : false,
    viewsCount: Number(doc.viewsCount ?? viewedIds.length ?? 0),
  }
}

export function groupStoriesByAuthor(
  docs: any[],
  viewerId?: string | number | null,
): StoryGroupData[] {
  const groups = new Map<string, StoryGroupData>()

  for (const doc of docs) {
    const story = toStoryItem(doc, viewerId)
    const authorId = story.author.id

    if (!groups.has(authorId)) {
      groups.set(authorId, {
        author: story.author,
        hasUnviewed: !story.viewed,
        latestCreatedAt: story.createdAt,
        stories: [story],
      })
      continue
    }

    const current = groups.get(authorId)!
    current.stories.push(story)
    current.hasUnviewed = current.hasUnviewed || !story.viewed

    if (new Date(story.createdAt).getTime() > new Date(current.latestCreatedAt).getTime()) {
      current.latestCreatedAt = story.createdAt
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      stories: group.stories.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    }))
    .sort(
      (a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime(),
    )
}

export async function getActiveStoriesForAuthorIds({
  authorIds,
  payload,
  viewerId,
}: {
  authorIds: Array<string | number>
  payload: BasePayload
  viewerId?: string | number | null
}) {
  if (authorIds.length === 0) {
    return [] as StoryGroupData[]
  }

  const result = await (payload as any).find({
    collection: 'stories',
    where: {
      and: [
        { author: { in: authorIds } },
        { expiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
    sort: '-createdAt',
    depth: 2,
    limit: 100,
    overrideAccess: true,
  })

  return groupStoriesByAuthor(result.docs, viewerId)
}

export async function getFeedStoryGroups(payload: BasePayload, viewerId: string | number) {
  const followingIds = await getAcceptedFollowingIds(payload, viewerId)
  const authorIds = [viewerId, ...followingIds]

  return getActiveStoriesForAuthorIds({
    authorIds,
    payload,
    viewerId,
  })
}
