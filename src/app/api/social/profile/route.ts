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
    const username = String(formData.get('username') || '').trim()
    const bio = String(formData.get('bio') || '').trim()
    const website = String(formData.get('website') || '').trim()
    const isPrivate = formData.get('isPrivate') === 'true'
    const avatar = formData.get('avatar')

    if (!name) {
      return NextResponse.json({ message: 'O nome e obrigatorio.' }, { status: 400 })
    }

    if (!username) {
      return NextResponse.json({ message: 'O nome de usuario e obrigatorio.' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json(
        { message: 'Username deve ter 3-30 caracteres (letras, numeros ou _).' },
        { status: 400 },
      )
    }

    let avatarId: number | undefined

    if (avatar instanceof File && avatar.size > 0) {
      const ext = path.extname(avatar.name || '') || '.bin'
      tempAvatarPath = path.join(tmpdir(), `social-avatar-${randomUUID()}${ext}`)

      await writeFile(tempAvatarPath, Buffer.from(await avatar.arrayBuffer()))

      const uploaded = await payload.create({
        collection: 'media',
        data: { alt: `Avatar de ${name}` },
        filePath: tempAvatarPath,
        depth: 0,
        overrideAccess: false,
        user,
      })

      avatarId = Number(uploaded.id)
    }

    const updatedUser = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        name,
        username,
        bio: bio || null,
        website: website || null,
        isPrivate,
        ...(avatarId ? { avatar: avatarId } : {}),
      } as never,
      depth: 0,
      overrideAccess: false,
      user,
    })

    return NextResponse.json({ message: 'Perfil atualizado.', user: updatedUser })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar o perfil.'
    if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ message: 'Este username ja esta em uso.' }, { status: 409 })
    }
    return NextResponse.json({ message }, { status: 400 })
  } finally {
    if (tempAvatarPath) {
      await unlink(tempAvatarPath).catch(() => null)
    }
  }
}
