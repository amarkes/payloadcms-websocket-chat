import type { CollectionConfig } from 'payload'
import { adjustCount } from '../../lib/social-counts'
import {
  getReactionCountsForTarget,
  reactionTargetCollectionMap as targetCollectionMap,
  type ReactionTargetType,
} from '../../lib/social-targets'
import { resolveRelationshipId } from '../../lib/social-utils'
import { emitReactionUpdate } from '../../websocket/social-events'

export const Reactions: CollectionConfig = {
  slug: 'reactions',
  admin: {
    useAsTitle: 'reactionKey',
    defaultColumns: ['user', 'type', 'targetType', 'targetId', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        const userId = resolveRelationshipId(data?.user ?? originalDoc?.user)
        const targetType = data?.targetType ?? originalDoc?.targetType
        const targetId = data?.targetId ?? originalDoc?.targetId

        if (data && userId && targetType && targetId) {
          data.reactionKey = `${userId}:${targetType}:${targetId}`
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const collection = targetCollectionMap[doc.targetType as ReactionTargetType]
        if (!collection) return

        if (operation === 'create') {
          if (doc.type === 'like' || doc.type === 'dislike') {
            const field = doc.type === 'like' ? 'likesCount' : 'dislikesCount'
            await adjustCount(
              req.payload,
              collection as Parameters<typeof adjustCount>[1],
              doc.targetId,
              field,
              1,
              req,
            )
          }
        }

        if (operation === 'update' && previousDoc?.type !== doc.type) {
          if (previousDoc.type === 'like' || previousDoc.type === 'dislike') {
            const oldField = previousDoc.type === 'like' ? 'likesCount' : 'dislikesCount'
            await adjustCount(
              req.payload,
              collection as Parameters<typeof adjustCount>[1],
              doc.targetId,
              oldField,
              -1,
              req,
            )
          }
          if (doc.type === 'like' || doc.type === 'dislike') {
            const newField = doc.type === 'like' ? 'likesCount' : 'dislikesCount'
            await adjustCount(
              req.payload,
              collection as Parameters<typeof adjustCount>[1],
              doc.targetId,
              newField,
              1,
              req,
            )
          }
        }

        const counts = await getReactionCountsForTarget(
          req.payload,
          doc.targetType as ReactionTargetType,
          doc.targetId,
          req,
        )

        emitReactionUpdate({
          targetType: doc.targetType as ReactionTargetType,
          targetId: String(doc.targetId),
          likesCount: counts.likesCount,
          dislikesCount: counts.dislikesCount,
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const collection = targetCollectionMap[doc.targetType as ReactionTargetType]
        if (!collection) return

        if (doc.type === 'like' || doc.type === 'dislike') {
          const field = doc.type === 'like' ? 'likesCount' : 'dislikesCount'
          await adjustCount(
            req.payload,
            collection as Parameters<typeof adjustCount>[1],
            doc.targetId,
            field,
            -1,
            req,
          )
        }

        const counts = await getReactionCountsForTarget(
          req.payload,
          doc.targetType as ReactionTargetType,
          doc.targetId,
          req,
        )

        emitReactionUpdate({
          targetType: doc.targetType as ReactionTargetType,
          targetId: String(doc.targetId),
          likesCount: counts.likesCount,
          dislikesCount: counts.dislikesCount,
        })
      },
    ],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => {
      if (!req.user) return false
      return { user: { equals: req.user.id } }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return { user: { equals: req.user.id } }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Like', value: 'like' },
        { label: 'Dislike', value: 'dislike' },
        { label: 'Emoji', value: 'emoji' },
      ],
    },
    {
      name: 'emoji',
      type: 'text',
      maxLength: 16,
      admin: {
        condition: (_, siblingData) => siblingData.type === 'emoji',
      },
    },
    {
      name: 'targetType',
      type: 'select',
      required: true,
      options: [
        { label: 'Post', value: 'post' },
        { label: 'Reel', value: 'reel' },
        { label: 'Comentário', value: 'comment' },
      ],
    },
    {
      name: 'targetId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      // Synthetic unique key: "<userId>:<targetType>:<targetId>"
      name: 'reactionKey',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        hidden: true,
        readOnly: true,
        disableListColumn: true,
        disableListFilter: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
  timestamps: true,
}
