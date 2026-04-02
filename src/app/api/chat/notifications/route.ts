import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/chat-auth'
import { getUnreadNotificationsSummary } from '@/lib/chat-notifications'

export async function GET() {
  try {
    const { payload, user } = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
    }

    const summary = await getUnreadNotificationsSummary({
      payload,
      user,
    })

    return NextResponse.json(summary)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nao foi possivel carregar notificacoes.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
