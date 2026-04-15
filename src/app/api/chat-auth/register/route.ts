import { NextResponse } from 'next/server'

import { createAuthCookie, getPayloadClient } from '@/lib/chat-auth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
      name?: string
      username?: string
      password?: string
    }

    const name = body.name?.trim()
    const username = body.username?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password?.trim()

    if (!name || !username || !email || !password) {
      return NextResponse.json({ message: 'Preencha nome, usuário, e-mail e senha.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const payload = await getPayloadClient()

    await payload.create({
      collection: 'users',
      data: {
        name,
        username,
        email,
        password,
      },
      depth: 0,
      overrideAccess: false,
    })

    const result = await payload.login({
      collection: 'users',
      data: {
        email,
        password,
      },
      depth: 0,
    })

    const response = NextResponse.json({
      message: 'Conta criada com sucesso.',
      user: result.user,
    })

    response.headers.set('Set-Cookie', await createAuthCookie(result.token))

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel criar a conta.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
