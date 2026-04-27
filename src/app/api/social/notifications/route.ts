/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

function normalizeNotification(notification: any) {
  const actor = notification.actor && typeof notification.actor === 'object' ? notification.actor : null

  return {
    id: String(notification.id),
    title: notification.title,
    body: notification.body ?? '',
    href: notification.href,
    createdAt: notification.createdAt,
    readAt: notification.readAt ?? null,
    actor: actor
      ? {
          id: Number(actor.id),
          name: actor.name ?? null,
          email: actor.email ?? '',
          username: actor.username ?? null,
          avatar:
            actor.avatar && typeof actor.avatar === 'object'
              ? { filename: actor.avatar.filename ?? null }
              : null,
        }
      : null,
  }
}

export async function GET() {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const p = payload as any
  if (!p.collections?.notifications) {
    return NextResponse.json({ items: [], unreadCount: 0 })
  }

  const result = await p.find({
    collection: 'notifications',
    where: { recipient: { equals: user.id } },
    sort: '-createdAt',
    depth: 2,
    limit: 30,
    overrideAccess: false,
    user,
  })

  const unreadCount = result.docs.filter((notification: any) => !notification.readAt).length

  return NextResponse.json({
    items: result.docs.map(normalizeNotification),
    unreadCount,
  })
}

export async function PATCH(request: Request) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const body = (await request.json()) as { id?: string }

  if (!body.id) {
    return NextResponse.json({ message: 'ID obrigatorio.' }, { status: 400 })
  }

  const p = payload as any
  if (!p.collections?.notifications) {
    return NextResponse.json({ message: 'Colecao de notificacoes indisponivel.' }, { status: 503 })
  }

  const updated = await p.update({
    collection: 'notifications',
    id: body.id,
    data: { readAt: new Date().toISOString() },
    depth: 2,
    overrideAccess: false,
    user,
  })

  return NextResponse.json({ notification: normalizeNotification(updated) })
}
