import { NextResponse } from 'next/server'

import {
  generateResetCode,
  getPayloadClient,
  getResetCodeExpiration,
  hashResetCode,
  sendResetCodeEmail,
} from '@/lib/chat-auth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
    }

    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ message: 'Informe seu e-mail.' }, { status: 400 })
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

    if (users.docs.length > 0) {
      const user = users.docs[0]
      const code = generateResetCode()

      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          passwordResetCodeHash: hashResetCode(code),
          passwordResetCodeExpiresAt: getResetCodeExpiration(),
        },
        depth: 0,
        overrideAccess: true,
      })

      await sendResetCodeEmail({
        code,
        email,
        name: user.name,
      })
    }

    return NextResponse.json({
      message: 'Se o e-mail existir, o codigo foi enviado.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel enviar o codigo.'

    return NextResponse.json({ message }, { status: 500 })
  }
}
