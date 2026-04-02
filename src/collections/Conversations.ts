import type { CollectionConfig } from 'payload'

function normalizeParticipantIds(participants: unknown): number[] {
  if (!Array.isArray(participants)) return []

  return participants
    .map((participant) => {
      if (typeof participant === 'object' && participant && 'id' in participant) {
        return Number(participant.id)
      }

      return Number(participant)
    })
    .filter((participantId) => Number.isFinite(participantId))
    .sort((a, b) => a - b)
}

function getParticipantKey(participants: unknown): string {
  return normalizeParticipantIds(participants).join(':')
}

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['participants', 'lastMessageAt', 'createdAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        const normalizedParticipants = normalizeParticipantIds(data?.participants ?? originalDoc?.participants)

        if (data && normalizedParticipants.length === 2) {
          data.participants = normalizedParticipants
          data.participantKey = getParticipantKey(normalizedParticipants)
        }

        return data
      },
    ],
  },
  access: {
    // Only authenticated users can create conversations
    create: ({ req }) => Boolean(req.user),
    // Users can only read conversations they participate in
    read: ({ req }) => {
      if (!req.user) return false
      return {
        participants: {
          in: [req.user.id],
        },
      }
    },
    update: ({ req }) => {
      if (!req.user) return false
      return {
        participants: {
          in: [req.user.id],
        },
      }
    },
    delete: ({ req }) => Boolean(req.user?.collection === 'users' && req.user),
  },
  fields: [
    {
      name: 'participants',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
      minRows: 2,
      maxRows: 2,
      admin: {
        description: 'Exactly 2 participants per conversation',
      },
    },
    {
      name: 'lastMessage',
      type: 'relationship',
      relationTo: 'messages',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: {
          displayFormat: 'dd/MM/yyyy HH:mm',
        },
      },
    },
    {
      name: 'participantKey',
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
