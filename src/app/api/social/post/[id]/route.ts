import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { payload, user } = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

    const { id } = await params
    const postId = Number(id)
    if (!Number.isFinite(postId)) {
      return NextResponse.json({ message: 'ID invalido.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const existing = await p.findByID({
      collection: 'posts',
      id: postId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing) return NextResponse.json({ message: 'Post nao encontrado.' }, { status: 404 })
    if (String(existing.author) !== String(user.id) && String(existing.author?.id) !== String(user.id)) {
      return NextResponse.json({ message: 'Sem permissao.' }, { status: 403 })
    }

    const body = (await request.json()) as {
      caption?: string
      visibility?: 'public' | 'followers' | 'private'
    }

    const data: Record<string, unknown> = {}
    if (typeof body.caption === 'string') data.caption = body.caption.trim()
    if (['public', 'followers', 'private'].includes(body.visibility ?? '')) {
      data.visibility = body.visibility
    }

    const updated = await p.update({
      collection: 'posts',
      id: postId,
      data,
      depth: 0,
      overrideAccess: false,
      user,
    })

    return NextResponse.json({ post: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar post.'
    return NextResponse.json({ message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { payload, user } = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })

    const { id } = await params
    const postId = Number(id)
    if (!Number.isFinite(postId)) {
      return NextResponse.json({ message: 'ID invalido.' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = payload as any
    const existing = await p.findByID({
      collection: 'posts',
      id: postId,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing) return NextResponse.json({ message: 'Post nao encontrado.' }, { status: 404 })
    if (String(existing.author) !== String(user.id) && String(existing.author?.id) !== String(user.id)) {
      return NextResponse.json({ message: 'Sem permissao.' }, { status: 403 })
    }

    await p.delete({
      collection: 'posts',
      id: postId,
      overrideAccess: false,
      user,
    })

    return NextResponse.json({ message: 'Post removido.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao remover post.'
    return NextResponse.json({ message }, { status: 400 })
  }
}
