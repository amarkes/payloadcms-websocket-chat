import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/chat-auth'
import { markConversationMessagesAsRead } from '@/lib/chat-notifications'

interface RouteContext {
  params: Promise<{
    conversationId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { conversationId } = await context.params
    const conversationNumericId = Number(conversationId)
    const { payload, user } = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
    }

    if (!Number.isFinite(conversationNumericId)) {
      return NextResponse.json({ message: 'Conversa invalida.' }, { status: 400 })
    }

    await markConversationMessagesAsRead({
      conversationId: conversationNumericId,
      payload,
      user,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nao foi possivel marcar a conversa como lida.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
