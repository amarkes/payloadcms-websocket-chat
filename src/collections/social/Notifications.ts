import type { CollectionConfig, Where } from 'payload'

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['recipient', 'actor', 'type', 'title', 'readAt', 'createdAt'],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => {
      if (!req.user) return false
      return { recipient: { equals: req.user.id } } as Where
    },
    update: ({ req }) => {
      if (!req.user) return false
      return { recipient: { equals: req.user.id } } as Where
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return { recipient: { equals: req.user.id } } as Where
    },
  },
  fields: [
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [{ label: 'Mencao em comentario', value: 'comment_mention' }],
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      index: true,
    },
    {
      name: 'comment',
      type: 'relationship',
      relationTo: 'comments',
      required: true,
    },
    {
      name: 'href',
      type: 'text',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
    },
    {
      name: 'notificationKey',
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
    {
      name: 'readAt',
      type: 'date',
      index: true,
    },
  ],
  timestamps: true,
}

