import { NextResponse } from 'next/server'

import { createAuthCookie, getPayloadClient } from '@/lib/chat-auth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const password = body.password?.trim()

    if (!email || !password) {
      return NextResponse.json({ message: 'Informe e-mail e senha.' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const result = await payload.login({
      collection: 'users',
      data: {
        email,
        password,
      },
      depth: 0,
    })

    const response = NextResponse.json({
      message: 'Login realizado com sucesso.',
      user: result.user,
    })

    response.headers.set('Set-Cookie', await createAuthCookie(result.token))

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel entrar.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
