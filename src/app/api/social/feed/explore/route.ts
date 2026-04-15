/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/chat-auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10))
  const tag = searchParams.get('tag')?.trim().toLowerCase()

  const payload = await getPayloadClient()
  const p = payload as any

  const result = await p.find({
    collection: 'posts',
    where: {
      and: [
        { visibility: { equals: 'public' } },
        { isArchived: { equals: false } },
        ...(tag ? [{ 'tags.tag': { equals: tag } }] : []),
      ],
    },
    sort: '-createdAt',
    depth: 1,
    page,
    limit,
    overrideAccess: true,
  })

  return NextResponse.json(result)
}
