import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/chat-auth'
import { getConversationMessagesPage } from '@/lib/chat-messages'

interface RouteContext {
  params: Promise<{
    conversationId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { conversationId } = await context.params
    const { payload, user } = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || '1')

    const result = await getConversationMessagesPage({
      conversationId,
      page,
      payload,
      user,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
