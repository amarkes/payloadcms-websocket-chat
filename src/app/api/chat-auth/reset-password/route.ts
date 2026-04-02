import { NextResponse } from 'next/server'

import { createAuthCookie, getPayloadClient, hashResetCode } from '@/lib/chat-auth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string
      email?: string
      password?: string
    }

    const email = body.email?.trim().toLowerCase()
    const code = body.code?.trim()
    const password = body.password?.trim()

    if (!email || !code || !password) {
      return NextResponse.json(
        { message: 'Informe e-mail, codigo e nova senha.' },
        { status: 400 },
      )
    }

    if (password.length < 8) {
      return NextResponse.json({ message: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const users = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
    })

    if (users.docs.length === 0) {
      return NextResponse.json({ message: 'Codigo invalido ou expirado.' }, { status: 400 })
    }

    const user = users.docs[0]

    if (
      !user.passwordResetCodeHash ||
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeHash !== hashResetCode(code) ||
      new Date(user.passwordResetCodeExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json({ message: 'Codigo invalido ou expirado.' }, { status: 400 })
    }

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
      },
      depth: 0,
      overrideAccess: true,
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
      message: 'Senha atualizada com sucesso.',
      user: result.user,
    })

    response.headers.set('Set-Cookie', await createAuthCookie(result.token))

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel redefinir a senha.'

    return NextResponse.json({ message }, { status: 400 })
  }
}
