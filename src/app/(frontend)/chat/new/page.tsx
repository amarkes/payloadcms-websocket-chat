import { headers as getHeaders } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import type { Media, User } from '@/payload-types'

interface PageProps {
  searchParams: Promise<{ q?: string }>
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

  return (
    normalizedParticipants.length === 2 &&
    normalizedParticipants[0] === Math.min(userA, userB) &&
    normalizedParticipants[1] === Math.max(userA, userB)
  )
}

async function startConversation(formData: FormData) {
  'use server'

  const participantId = String(formData.get('participantId') || '')
  const participantUserId = Number(participantId)

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/chat')
  }

  if (!participantId || !Number.isFinite(participantUserId) || participantId === String(user.id)) {
    redirect('/chat/new?q=')
  }

  const otherUser = await payload.findByID({
    collection: 'users',
    id: participantId,
    overrideAccess: false,
    user,
  })

  if (!otherUser) {
    redirect('/chat/new?q=')
  }

  const participantKey = getParticipantKey(Number(user.id), participantUserId)

  const existing = await payload.find({
    collection: 'conversations',
    where: {
      participantKey: {
        equals: participantKey,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: false,
    user,
  })

  if (existing.docs.length > 0) {
    redirect(`/chat/${existing.docs[0].id}`)
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
    await payload.update({
      collection: 'conversations',
      id: legacyConversation.id,
      data: {
        participants: [user.id, participantUserId],
      },
      depth: 0,
      overrideAccess: false,
      user,
    })

    redirect(`/chat/${legacyConversation.id}`)
  }

  const conversation = await payload.create({
    collection: 'conversations',
    data: {
      participants: [user.id, participantUserId],
    },
    depth: 0,
    overrideAccess: false,
    user,
  })

  redirect(`/chat/${conversation.id}`)
}

export default async function NewConversationPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  const query = q.trim()

  const payload = await getPayload({ config: await config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/chat')
  }

  let results: User[] = []

  const result = await payload.find({
    collection: 'users',
    where:
      query.length >= 2
        ? {
            and: [
              {
                or: [{ name: { contains: query } }, { email: { contains: query } }],
              },
              {
                id: {
                  not_equals: user.id,
                },
              },
            ],
          }
        : {
            id: {
              not_equals: user.id,
            },
          },
    sort: 'name',
    depth: 1,
    limit: query.length >= 2 ? 12 : 24,
    overrideAccess: false,
    user,
  })

  results = result.docs as User[]

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '40px auto',
        fontFamily: 'sans-serif',
        padding: '0 16px',
        color: '#f5f7fb',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>Nova conversa</h1>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 40,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid #2d3748',
            background: '#121826',
            color: '#cbd5e1',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Voltar
        </Link>
      </div>
      <p style={{ color: '#9aa4b2', marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
        Busque por nome ou e-mail ou escolha alguem da lista de pessoas cadastradas.
      </p>

      <form action="/chat/new" method="get" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Buscar por nome ou email..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 14px',
            fontSize: 16,
            border: '1px solid #2d3748',
            borderRadius: 8,
            boxSizing: 'border-box',
            background: '#121826',
            color: '#f5f7fb',
          }}
        />
        <button
          type="submit"
          style={{
            border: 0,
            borderRadius: 8,
            background: '#1f7aec',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Buscar
        </button>
      </form>

      {results.length === 0 && (
        <p style={{ color: '#9aa4b2' }}>
          {query.length >= 2 ? 'Nenhum usuario encontrado.' : 'Nenhuma outra pessoa cadastrada.'}
        </p>
      )}

      <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 10 }}>
        {query.length >= 2 ? 'Resultados da busca' : 'Pessoas cadastradas'}
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 10,
        }}
      >
        {results.map((resultUser) => {
          const avatarUrl =
            resultUser.avatar && typeof resultUser.avatar === 'object'
              ? `/api/media/file/${(resultUser.avatar as Media).filename}`
              : null

          return (
            <li key={resultUser.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  padding: 12,
                  border: '1px solid #2d3748',
                  borderRadius: 12,
                  background: '#121826',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={resultUser.name || resultUser.email}
                      width={44}
                      height={44}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#0070f3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {(resultUser.name || resultUser.email).charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{resultUser.name || resultUser.email}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#9aa4b2',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {resultUser.email}
                    </div>
                  </div>
                </div>

                <form action={startConversation}>
                  <input type="hidden" name="participantId" value={String(resultUser.id)} />
                  <button
                    type="submit"
                    style={{
                      border: 0,
                      borderRadius: 8,
                      background: '#0070f3',
                      color: '#fff',
                      padding: '10px 14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Conversar
                  </button>
                </form>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
