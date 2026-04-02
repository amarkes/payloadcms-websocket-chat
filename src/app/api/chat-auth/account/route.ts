import { randomUUID } from 'crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/chat-auth'

export async function PATCH(request: Request) {
  let tempAvatarPath: string | null = null

  try {
    const { payload, user } = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
    }

    const formData = await request.formData()
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase()
    const password = String(formData.get('password') || '').trim()
    const sex = String(formData.get('sex') || '').trim()
    const birthDate = String(formData.get('birthDate') || '').trim()
    const enableMessageObfuscation = String(formData.get('enableMessageObfuscation') || '').trim()
    const avatar = formData.get('avatar')

    if (!name || !email) {
      return NextResponse.json({ message: 'Nome e e-mail sao obrigatorios.' }, { status: 400 })
    }

    if (password && password.length < 8) {
      return NextResponse.json({ message: 'A nova senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    }

    const allowedSexValues = ['male', 'female', 'prefer_not_to_say']

    if (sex && !allowedSexValues.includes(sex)) {
      return NextResponse.json({ message: 'Sexo invalido.' }, { status: 400 })
    }

    let avatarId: number | undefined

    if (avatar instanceof File && avatar.size > 0) {
      const extension = path.extname(avatar.name || '') || '.bin'
      tempAvatarPath = path.join(tmpdir(), `chat-avatar-${randomUUID()}${extension}`)

      const buffer = Buffer.from(await avatar.arrayBuffer())
      await writeFile(tempAvatarPath, buffer)

      const uploadedAvatar = await payload.create({
        collection: 'media',
        data: {
          alt: `Avatar de ${name}`,
        },
        filePath: tempAvatarPath,
        depth: 0,
        overrideAccess: false,
        user,
      })

      avatarId = Number(uploadedAvatar.id)
    }

    const updatedUser = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        name,
        email,
        sex: sex || null,
        birthDate: birthDate || null,
        enableMessageObfuscation: enableMessageObfuscation === 'true',
        ...(avatarId ? { avatar: avatarId } : {}),
        ...(password ? { password } : {}),
      } as never,
      depth: 0,
      overrideAccess: false,
      user,
    })

    return NextResponse.json({
      message: 'Conta atualizada com sucesso.',
      user: updatedUser,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar a conta.'

    return NextResponse.json({ message }, { status: 400 })
  } finally {
    if (tempAvatarPath) {
      await unlink(tempAvatarPath).catch(() => null)
    }
  }
}
