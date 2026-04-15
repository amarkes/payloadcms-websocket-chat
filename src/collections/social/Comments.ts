// NOTE: 'posts', 'reels', 'comments' collection slugs are not yet in Payload-generated types.
// Remove the `as any` cast after running `pnpm generate:types`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CollectionConfig, Where } from 'payload'
import { adjustCount } from '../../lib/social-counts'
import {
  commentTargetCollectionMap as targetCollectionMap,
  type CommentTargetType,
} from '../../lib/social-targets'
import { resolveRelationshipId } from '../../lib/social-utils'
import { emitCommentNew } from '../../websocket/social-events'

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['author', 'targetType', 'targetId', 'content', 'createdAt'],
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        // Only root comments (no parent) count toward commentsCount on the target
        if (operation === 'create' && !doc.parent) {
          const collection = targetCollectionMap[doc.targetType as CommentTargetType]
          if (collection) {
            await adjustCount(req.payload, collection, doc.targetId, 'commentsCount', 1, req)
          }
        }

        if (operation === 'create') {
          emitCommentNew({
            targetType: doc.targetType as CommentTargetType,
            targetId: String(doc.targetId),
            comment: {
              id: String(doc.id),
              authorId: String(resolveRelationshipId(doc.author) ?? ''),
              content: doc.content,
              createdAt: doc.createdAt,
              parentId: doc.parent ? String(resolveRelationshipId(doc.parent)) : null,
            },
          })
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!doc.parent) {
          const collection = targetCollectionMap[doc.targetType as CommentTargetType]
          if (collection) {
            await adjustCount(req.payload, collection, doc.targetId, 'commentsCount', -1, req)
          }
        }
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    // Comments inherit the visibility of the parent entity; read is permissive here
    // and tightened at the feed/endpoint level in later phases
    read: () => true,
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
      name: 'targetType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Post', value: 'post' },
        { label: 'Reel', value: 'reel' },
      ],
    },
    {
      name: 'targetId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      // null = root comment; set = reply to another comment (1 level deep)
      name: 'parent',
      type: 'relationship',
      relationTo: 'comments' as any,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
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
      name: 'isDeleted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Soft delete — preserva respostas filhas',
      },
    },
  ],
  timestamps: true,
}
