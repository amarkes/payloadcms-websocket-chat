/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CollectionConfig, Where } from 'payload'
import { resolveRelationshipId } from '../../lib/social-utils'
import { emitStoryNew } from '../../websocket/social-events'

const STORY_TTL_MS = 24 * 60 * 60 * 1000

export const Stories: CollectionConfig = {
  slug: 'stories',
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['author', 'expiresAt', 'viewsCount', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (data && !data.author && req.user) {
          data.author = req.user.id
        }

        if (data && !data.expiresAt) {
          data.expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString()
        }

        const mediaId = resolveRelationshipId(data?.media ?? originalDoc?.media)
        if (!mediaId) return data

        const media = await req.payload.findByID({
          collection: 'media',
          id: mediaId,
          depth: 0,
          overrideAccess: true,
          req,
        })

        if (!media?.mimeType?.startsWith('image/') && !media?.mimeType?.startsWith('video/')) {
          throw new Error('Stories aceitam apenas imagem ou video.')
        }

        return data
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        if (operation === 'create') {
          const authorId = resolveRelationshipId(doc.author)
          if (authorId) {
            emitStoryNew({
              storyId: String(doc.id),
              authorId: String(authorId),
              expiresAt: doc.expiresAt,
            })
          }
        }
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => {
      if (!req.user) return false

      return {
        expiresAt: {
          greater_than: new Date().toISOString(),
        },
      } as Where
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
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'viewedBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'viewsCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
  timestamps: true,
}
