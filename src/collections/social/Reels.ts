/* eslint-disable @typescript-eslint/no-explicit-any */

import { unlink } from 'fs/promises'
import type { CollectionConfig, Where } from 'payload'
import { buildVisibilityWhere, getAcceptedFollowingIds } from '../../lib/social-access'
import { createReelThumbnailFile } from '../../lib/reel-thumbnail'
import { resolveRelationshipId } from '../../lib/social-utils'

export const Reels: CollectionConfig = {
  slug: 'reels',
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['author', 'visibility', 'likesCount', 'commentsCount', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (data && !data.author && req.user) {
          data.author = req.user.id
        }

        const videoId = resolveRelationshipId(data?.video ?? originalDoc?.video)
        if (!videoId) return data

        const video = await req.payload.findByID({
          collection: 'media',
          id: videoId,
          depth: 0,
          overrideAccess: true,
          req,
        })

        if (!video?.mimeType?.startsWith('video/')) {
          throw new Error('Reels aceitam apenas arquivos de video.')
        }

        if (data && typeof data.duration !== 'number') {
          data.duration = Number(originalDoc?.duration ?? 0)
        }

        return data
      },
    ],
    afterChange: [
      async ({ context, doc, operation, req }) => {
        if (context?.skipThumbnailGeneration || !['create', 'update'].includes(operation)) {
          return
        }

        if (doc.thumbnail) {
          return
        }

        let thumbnailPath: string | null = null

        try {
          thumbnailPath = await createReelThumbnailFile({
            caption: doc.caption,
            reelId: doc.id,
          })

          const uploadedThumbnail = await req.payload.create({
            collection: 'media',
            data: {
              alt: `Thumbnail do reel ${doc.id}`,
            },
            filePath: thumbnailPath,
            depth: 0,
            overrideAccess: true,
            req,
          })

          await req.payload.update({
            collection: 'reels',
            id: doc.id,
            data: {
              thumbnail: uploadedThumbnail.id,
            },
            depth: 0,
            overrideAccess: true,
            context: {
              ...context,
              skipThumbnailGeneration: true,
            },
            req,
          })
        } finally {
          if (thumbnailPath) {
            await unlink(thumbnailPath).catch(() => null)
          }
        }
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: async ({ req }) => {
      if (!req.user) {
        return {
          visibility: {
            equals: 'public',
          },
        } as Where
      }

      const followingIds = await getAcceptedFollowingIds(req.payload, req.user.id)

      return buildVisibilityWhere({
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
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'caption',
      type: 'textarea',
    },
    {
      name: 'duration',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
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
