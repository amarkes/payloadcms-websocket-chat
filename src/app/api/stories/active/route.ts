import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/chat-auth'
import { getFeedStoryGroups } from '@/lib/social-stories'

export async function GET() {
  const { payload, user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ message: 'Nao autenticado.' }, { status: 401 })
  }

  const groups = await getFeedStoryGroups(payload, user.id)

  return NextResponse.json({
    groups,
    totalGroups: groups.length,
    totalStories: groups.reduce((total, group) => total + group.stories.length, 0),
  })
}
