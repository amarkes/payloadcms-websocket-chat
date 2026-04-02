import type { CollectionConfig, Where } from 'payload'

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    useAsTitle: 'content',
    defaultColumns: ['sender', 'conversation', 'content', 'createdAt'],
    hideAPIURL: true,
  },
  access: {
    // Creating messages is handled by the WebSocket server (overrideAccess: true)
    create: ({ req }) => Boolean(req.user),
    // Users can only read messages from conversations they participate in
    read: ({ req }) => {
      if (!req.user) return false

      const where: Where = {
        and: [
          {
            'conversation.participants': {
              in: [req.user.id],
            },
          },
          {
            or: [{ deletedFor: { exists: false } }, { deletedFor: { not_in: [req.user.id] } }],
          },
        ],
      }

      return where
    },
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations',
      required: true,
      index: true, // Critical index for query performance
    },
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'editedAt',
      type: 'date',
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
    {
      name: 'readBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description: 'Users who have read this message',
      },
    },
    {
      name: 'deletedFor',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
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
    {
      name: 'deletedForEveryone',
      type: 'checkbox',
      defaultValue: false,
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
    {
      name: 'reactions',
      type: 'array',
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
      fields: [
        {
          name: 'emoji',
          type: 'text',
          required: true,
        },
        {
          name: 'users',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
          required: true,
        },
      ],
    },
  ],
  timestamps: true,
}
