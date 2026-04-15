import type { CollectionConfig, Where } from 'payload'
import { adjustFollowCounts } from '../../lib/social-counts'
import { resolveRelationshipId } from '../../lib/social-utils'
import { emitFollowRequest } from '../../websocket/social-events'

export const Follows: CollectionConfig = {
  slug: 'follows',
  admin: {
    useAsTitle: 'followKey',
    defaultColumns: ['follower', 'following', 'status', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        const followerId = resolveRelationshipId(data?.follower ?? originalDoc?.follower)
        const followingId = resolveRelationshipId(data?.following ?? originalDoc?.following)

        if (data && followerId && followingId) {
          data.followKey = `${followerId}:${followingId}`
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const isNowAccepted = doc.status === 'accepted'
        const wasAlreadyAccepted = previousDoc?.status === 'accepted'
        const followerId = resolveRelationshipId(doc.follower)
        const followingId = resolveRelationshipId(doc.following)

        if (followerId && followingId && isNowAccepted && !wasAlreadyAccepted) {
          await adjustFollowCounts(req.payload, followerId, followingId, 1, req)
        }

        if (followerId && followingId && !isNowAccepted && wasAlreadyAccepted && operation === 'update') {
          await adjustFollowCounts(req.payload, followerId, followingId, -1, req)
        }

        if (operation === 'create' && doc.status === 'pending' && followerId && followingId) {
          emitFollowRequest(followingId, { followerId: String(followerId) })
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (doc.status === 'accepted') {
          const followerId = resolveRelationshipId(doc.follower)
          const followingId = resolveRelationshipId(doc.following)

          if (followerId && followingId) {
            await adjustFollowCounts(req.payload, followerId, followingId, -1, req)
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
        or: [
          { follower: { equals: req.user.id } } as Where,
          { following: { equals: req.user.id } } as Where,
        ],
      } as Where
    },
    update: ({ req }) => {
      if (!req.user) return false
      // Only the person being followed can accept a pending request
      return { following: { equals: req.user.id } } as Where
    },
    delete: ({ req }) => {
      if (!req.user) return false
      // Follower can unfollow; the followed person can remove a follower
      return {
        or: [
          { follower: { equals: req.user.id } } as Where,
          { following: { equals: req.user.id } } as Where,
        ],
      } as Where
    },
  },
  fields: [
    {
      name: 'follower',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'following',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'accepted',
      options: [
        { label: 'Pendente', value: 'pending' },
        { label: 'Aceito', value: 'accepted' },
      ],
    },
    {
      // Synthetic unique key: "<followerId>:<followingId>"
      name: 'followKey',
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
