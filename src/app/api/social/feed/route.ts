/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'
import { enrichPostsWithSocialDetails } from '@/lib/social-feed'

export async function GET(request: Request) {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10))

  const p = payload as any

  const followsResult = await p.find({
    collection: 'follows',
    where: {
      and: [
        { follower: { equals: user.id } },
        { status: { equals: 'accepted' } },
      ],
    },
    overrideAccess: true,
    depth: 0,
    limit: 2000,
  })

  const followingIds: (string | number)[] = followsResult.docs.map((f: any) => {
    const v = f.following
    return typeof v === 'object' && v !== null ? v.id : v
  })

  const feedAuthorIds = [user.id, ...followingIds]

  const postsResult = await p.find({
    collection: 'posts',
    where: {
      and: [
        { author: { in: feedAuthorIds } },
        { isArchived: { equals: false } },
      ],
    },
    sort: '-createdAt',
    depth: 1,
    page,
    limit,
    overrideAccess: false,
    user,
  })

  postsResult.docs = await enrichPostsWithSocialDetails(p, user, postsResult.docs)

  return NextResponse.json(postsResult)
}
