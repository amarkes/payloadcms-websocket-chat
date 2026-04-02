// POST /api/conversations — find or create a private conversation with another user
// GET  /api/conversations — list conversations for the current user

import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'

async function getUser() {
  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })
  return { payload, user }
}

function getParticipantKey(userA: number, userB: number): string {
  return [userA, userB].sort((a, b) => a - b).join(':')
}

function matchesParticipantPair(participants: unknown, userA: number, userB: number): boolean {
  if (!Array.isArray(participants)) return false

  const normalizedParticipants = participants
    .map((participant) => {
      if (typeof participant === 'object' && participant && 'id' in participant) {
        return Number(participant.id)
      }

      return Number(participant)
    })
    .filter((participantId) => Number.isFinite(participantId))
    .sort((a, b) => a - b)

  return normalizedParticipants.length === 2 && normalizedParticipants[0] === Math.min(userA, userB) && normalizedParticipants[1] === Math.max(userA, userB)
}

export async function GET() {
  const { payload, user } = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await payload.find({
    collection: 'conversations',
    sort: '-lastMessageAt',
    depth: 2,
    limit: 50,
    overrideAccess: false,
    user,
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { payload, user } = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { participantId } = body

  if (!participantId || participantId === String(user.id)) {
    return NextResponse.json({ error: 'Invalid participantId' }, { status: 400 })
  }

  // Verify the other user exists
  const otherUser = await payload.findByID({
    collection: 'users',
    id: participantId,
    overrideAccess: true,
  })

  if (!otherUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const participantUserId = Number(participantId)
  const participantKey = getParticipantKey(Number(user.id), participantUserId)

  // Check if a conversation already exists between these two users
  const existing = await payload.find({
    collection: 'conversations',
    where: {
      participantKey: {
        equals: participantKey,
      },
    },
    limit: 1,
    depth: 2,
    overrideAccess: false,
    user,
  })

  if (existing.docs.length > 0) {
    return NextResponse.json(existing.docs[0])
  }

  const legacyConversations = await payload.find({
    collection: 'conversations',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    user,
  })

  const legacyConversation = legacyConversations.docs.find((conversation) =>
    matchesParticipantPair(conversation.participants, Number(user.id), participantUserId),
  )

  if (legacyConversation) {
    const updatedConversation = await payload.update({
      collection: 'conversations',
      id: legacyConversation.id,
      data: {
        participants: [user.id, participantUserId],
      },
      depth: 2,
      overrideAccess: false,
      user,
    })

    return NextResponse.json(updatedConversation)
  }

  // Create a new conversation
  const conversation = await payload.create({
    collection: 'conversations',
    data: {
      participants: [user.id, participantUserId],
    },
    depth: 2,
    overrideAccess: false,
    user,
  })

  return NextResponse.json(conversation, { status: 201 })
}
