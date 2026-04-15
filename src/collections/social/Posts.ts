// NOTE: 'follows' collection slug is not yet in Payload-generated types.
// Remove the `as any` cast after running `pnpm generate:types`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CollectionConfig, Where } from 'payload'
import { buildVisibilityWhere, getAcceptedFollowingIds } from '../../lib/social-access'
import { adjustCount } from '../../lib/social-counts'
import { extractHashtags, resolveRelationshipId } from '../../lib/social-utils'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['author', 'visibility', 'likesCount', 'commentsCount', 'createdAt'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.caption && typeof data.caption === 'string') {
          data.tags = extractHashtags(data.caption).map((tag) => ({ tag }))
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          const authorId = resolveRelationshipId(doc.author)
          if (authorId) {
            await adjustCount(req.payload, 'users', authorId, 'postsCount', 1, req)
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const authorId = resolveRelationshipId(doc.author)
        if (authorId) {
          await adjustCount(req.payload, 'users', authorId, 'postsCount', -1, req)
        }
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: async ({ req }) => {
      if (!req.user) {
        return {
          and: [
            { visibility: { equals: 'public' } } as Where,
            { isArchived: { equals: false } } as Where,
          ],
        } as Where
      }

      const followingIds = await getAcceptedFollowingIds(req.payload, req.user.id)

      return buildVisibilityWhere({
        archivedField: 'isArchived',
        followingIds,
        userId: req.user.id,
      })
    },
    update: ({ req }) => {
      if (!req.user) return false
      return { author: { equals: req.user.id } } as Where
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return { author: { equals: req.user.id } } as Where
    },
  },
  fields: [
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'caption',
      type: 'textarea',
    },
    {
      name: 'media',
      type: 'array',
      maxRows: 10,
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'tags',
      type: 'array',
      admin: {
        readOnly: true,
        description: 'Extraído automaticamente do caption via hashtags',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Público', value: 'public' },
        { label: 'Seguidores', value: 'followers' },
        { label: 'Privado', value: 'private' },
      ],
    },
    {
      name: 'isArchived',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'likesCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'dislikesCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'commentsCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
  ],
  timestamps: true,
}
