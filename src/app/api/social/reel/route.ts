import { randomUUID } from 'crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

export async function POST(request: Request) {
  let tempVideoPath: string | null = null

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
    const video = formData.get('video')

    if (!(video instanceof File) || video.size === 0) {
      return NextResponse.json({ message: 'Selecione um video para publicar.' }, { status: 400 })
    }

    if (!video.type.startsWith('video/')) {
      return NextResponse.json({ message: 'Reels aceitam apenas arquivos de video.' }, { status: 400 })
    }

    const ext = path.extname(video.name || '') || '.mp4'
    tempVideoPath = path.join(tmpdir(), `social-reel-${randomUUID()}${ext}`)

    await writeFile(tempVideoPath, Buffer.from(await video.arrayBuffer()))

    const uploadedVideo = await payload.create({
      collection: 'media',
      data: { alt: caption.slice(0, 80) || 'Reel video' },
      filePath: tempVideoPath,
      depth: 0,
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const reel = await p.create({
      collection: 'reels',
      data: {
        author: user.id,
        video: Number(uploadedVideo.id),
        caption,
        visibility,
        duration: 0,
      },
      depth: 0,
      overrideAccess: false,
      user,
    })

    return NextResponse.json({ id: reel.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel criar o reel.'
    return NextResponse.json({ message }, { status: 400 })
  } finally {
    if (tempVideoPath) {
      await unlink(tempVideoPath).catch(() => null)
    }
  }
}

