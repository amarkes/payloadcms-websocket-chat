import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
  },
  auth: true,
  access: {
    create: () => true,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => {
      if (!req.user) return false

      return {
        id: {
          equals: req.user.id,
        },
      }
    },
    delete: () => false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'sex',
      type: 'select',
      options: [
        { label: 'Masculino', value: 'male' },
        { label: 'Feminino', value: 'female' },
        { label: 'Prefiro nao informar', value: 'prefer_not_to_say' },
      ],
    },
    {
      name: 'birthDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'enableMessageObfuscation',
      type: 'checkbox',
      defaultValue: false,
      label: 'Ativar ofuscacao de mensagens',
    },
    // ── Social profile ────────────────────────────────────────────────────────
    {
      name: 'username',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: {
        description: 'Handle público único (ex: @joao_silva)',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Descrição curta do perfil',
      },
    },
    {
      name: 'website',
      type: 'text',
      admin: {
        description: 'URL do site pessoal',
      },
    },
    {
      name: 'isPrivate',
      type: 'checkbox',
      defaultValue: false,
      label: 'Perfil privado',
      admin: {
        description: 'Se ativado, novos seguidores precisam de aprovação',
      },
    },
    {
      name: 'followersCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'followingCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'postsCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    // ── Password reset (internal) ─────────────────────────────────────────────
    {
      name: 'passwordResetCodeHash',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
        disableListColumn: true,
        disableListFilter: true,
      },
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
    },
    {
      name: 'passwordResetCodeExpiresAt',
      type: 'date',
      admin: {
        hidden: true,
        readOnly: true,
        disableListColumn: true,
        disableListFilter: true,
      },
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
    },
  ],
}
