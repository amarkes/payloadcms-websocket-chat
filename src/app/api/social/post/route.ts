import { randomUUID } from 'crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

export async function POST(request: Request) {
  const tempPaths: string[] = []

  try {
    const { payload, user } = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
    }

    const formData = await request.formData()
    const caption = String(formData.get('caption') || '').trim()
    const rawVisibility = String(formData.get('visibility') || 'public').trim()
    const visibility = (['public', 'followers', 'private'].includes(rawVisibility)
      ? rawVisibility
      : 'public') as 'public' | 'followers' | 'private'

    const mediaFiles = formData
      .getAll('media')
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (!caption && mediaFiles.length === 0) {
      return NextResponse.json({ message: 'Adicione uma legenda ou midia.' }, { status: 400 })
    }

    const mediaIds: number[] = []

    for (const file of mediaFiles.slice(0, 10)) {
      const ext = path.extname(file.name || '') || '.bin'
      const tmpPath = path.join(tmpdir(), `social-media-${randomUUID()}${ext}`)
      tempPaths.push(tmpPath)

      await writeFile(tmpPath, Buffer.from(await file.arrayBuffer()))

      const uploaded = await payload.create({
        collection: 'media',
        data: { alt: caption.slice(0, 80) || 'Post media' },
        filePath: tmpPath,
        depth: 0,
        overrideAccess: true,
      })

      mediaIds.push(Number(uploaded.id))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const post = await p.create({
      collection: 'posts',
      data: {
        author: user.id,
        caption,
        visibility,
        media: mediaIds.map((id) => ({ file: id })),
      },
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({ id: post.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel criar o post.'
    return NextResponse.json({ message }, { status: 400 })
  } finally {
    for (const p of tempPaths) {
      await unlink(p).catch(() => null)
    }
  }
}
