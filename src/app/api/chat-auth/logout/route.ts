import { NextResponse } from 'next/server'

import { createExpiredAuthCookie } from '@/lib/chat-auth'

export async function POST() {
  const response = NextResponse.json({
    message: 'Sessao encerrada.',
  })

  response.headers.set('Set-Cookie', await createExpiredAuthCookie())

  return response
}
