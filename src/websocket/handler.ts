import type { IncomingMessage } from 'http'
import type { WebSocket as WsSocket, WebSocketServer } from 'ws'
import { getPayload } from 'payload'
import { CHAT_MESSAGES_PAGE_SIZE } from '../lib/chat-messages.js'
import { getUnreadNotificationsSummaryForUserId } from '../lib/chat-notifications.js'
import config from '../payload.config.js'
import {
  addUserSocket,
  broadcastToUserSockets,
  getUserSockets,
  removeUserSocket,
} from './social-events.js'

interface AuthenticatedSocket extends WsSocket {
  currentConversationId?: string
  finalized?: boolean
  userId?: string
  isAlive?: boolean
  lastSeenAt?: number
  notificationsSubscribed?: boolean
}

type MessageRecord = {
  content?: string | null
  conversation?: unknown
  deletedFor?: unknown
  deletedForEveryone?: boolean | null
  id: number | string
  readBy?: unknown
  sender?: unknown
}

type WsMessage =
  | { type: 'join_conversation'; conversationId: string }
  | { type: 'leave_conversation'; conversationId: string }
  | { type: 'subscribe_conversations_list' }
  | { type: 'subscribe_notifications' }
  | { type: 'send_message'; conversationId: string; content: string }
  | { type: 'mark_read'; conversationId: string }
  | { type: 'edit_message'; conversationId: string; messageId: string; content: string }
  | { type: 'react_message'; conversationId: string; messageId: string; emoji: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'delete_message'; conversationId: string; messageId: string; scope: 'self' | 'everyone' }
  | { type: 'heartbeat' }
  | { type: 'disconnect' }

// conversationId -> set of connected sockets
const rooms = new Map<string, Set<AuthenticatedSocket>>()
const onlineUsers = new Map<string, number>()
const conversationTypingUsers = new Map<string, Set<string>>()

function broadcast(conversationId: string, data: object, exclude?: AuthenticatedSocket) {
  const room = rooms.get(conversationId)
  if (!room) return
  const payload = JSON.stringify(data)
  for (const client of room) {
    if (client !== exclude && client.readyState === 1 /* OPEN */) {
      client.send(payload)
    }
  }
}

function leaveAllRooms(socket: AuthenticatedSocket) {
  for (const [conversationId, room] of rooms) {
    if (socket.userId) {
      setConversationTypingState(conversationId, socket.userId, false)
      broadcast(conversationId, { type: 'typing', conversationId, userId: socket.userId, isTyping: false }, socket)
    }
    room.delete(socket)
    if (room.size === 0) rooms.delete(conversationId)
  }
  socket.currentConversationId = undefined
}

function broadcastToUser(userId: string, data: object, exclude?: AuthenticatedSocket) {
  broadcastToUserSockets(userId, data, { exclude })
}

function setConversationTypingState(conversationId: string, userId: string, isTyping: boolean) {
  if (isTyping) {
    if (!conversationTypingUsers.has(conversationId)) {
      conversationTypingUsers.set(conversationId, new Set())
    }

    conversationTypingUsers.get(conversationId)?.add(userId)
    return
  }

  const typingUsers = conversationTypingUsers.get(conversationId)

  if (!typingUsers) return

  typingUsers.delete(userId)

  if (typingUsers.size === 0) {
    conversationTypingUsers.delete(conversationId)
  }
}

function broadcastNotificationsToUser(userId: string, data: object, exclude?: AuthenticatedSocket) {
  broadcastToUserSockets(userId, data, {
    exclude,
    requireNotificationsSubscribed: true,
  })
}

function setUserOnline(userId: string) {
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1)
}

function setUserOffline(userId: string): boolean {
  const currentConnections = onlineUsers.get(userId) || 0

  if (currentConnections <= 1) {
    onlineUsers.delete(userId)
    return true
  }

  onlineUsers.set(userId, currentConnections - 1)
  return false
}

function isUserOnline(userId: string): boolean {
  return (onlineUsers.get(userId) || 0) > 0
}

function normalizeRelationshipIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (typeof entry === 'object' && entry && 'id' in entry) {
        return Number(entry.id)
      }

      return Number(entry)
    })
    .filter((entry) => Number.isFinite(entry))
}

function getRelationshipId(value: unknown): number | null {
  if (typeof value === 'object' && value && 'id' in value) {
    const id = Number(value.id)
    return Number.isFinite(id) ? id : null
  }

  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function isMessageDeletedForUser(message: MessageRecord, userId: number) {
  if (message.deletedForEveryone) return true

  const deletedFor = normalizeRelationshipIds(message.deletedFor)

  return deletedFor.includes(userId)
}

function isMessageUnreadForUser(message: MessageRecord, userId: number) {
  if (isMessageDeletedForUser(message, userId)) return false

  const readBy = normalizeRelationshipIds(message.readBy)

  return !readBy.includes(userId)
}

function normalizeReactions(
  value: unknown,
): Array<{
  emoji: string
  users: number[]
}> {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null

      const reaction = entry as {
        emoji?: unknown
        users?: unknown
      }

      if (typeof reaction.emoji !== 'string' || !reaction.emoji.trim()) return null

      return {
        emoji: reaction.emoji,
        users: normalizeRelationshipIds(reaction.users),
      }
    })
    .filter(
      (
        entry,
      ): entry is {
        emoji: string
        users: number[]
      } => Boolean(entry),
    )
}

async function getConversationParticipantIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
) {
  const conversation = await payload.findByID({
    collection: 'conversations',
    id: conversationId,
    depth: 0,
    overrideAccess: true,
  })

  if (!conversation) return []

  return normalizeRelationshipIds(conversation.participants)
}

async function getVisibleConversationMessagesForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  userId: number,
) {
  const messages = await payload.find({
    collection: 'messages',
    where: {
      conversation: {
        equals: conversationId,
      },
    },
    sort: '-createdAt',
    depth: 1,
    limit: CHAT_MESSAGES_PAGE_SIZE,
    overrideAccess: true,
  })

  return messages.docs
    .filter((message: MessageRecord) => !isMessageDeletedForUser(message, userId))
    .reverse()
}

async function getUnreadCountForConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  userId: number,
) {
  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [
        { conversation: { equals: conversationId } },
        { sender: { not_equals: userId } },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  return messages.docs.filter((message: MessageRecord) =>
    isMessageUnreadForUser(message, userId),
  ).length
}

async function pushUnreadCountToUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  userId: number,
  lastMessageAt?: string | null,
) {
  const unreadCount = await getUnreadCountForConversation(payload, conversationId, userId)

  broadcastToUser(String(userId), {
    type: 'conversation_unread_count',
    conversationId: String(conversationId),
    unreadCount,
    ...(lastMessageAt ? { lastMessageAt } : {}),
  })
}

async function pushUnreadCountsToParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  participantIds?: number[],
  lastMessageAt?: string | null,
) {
  const resolvedParticipantIds =
    participantIds && participantIds.length > 0
      ? participantIds
      : await getConversationParticipantIds(payload, conversationId)

  await Promise.all(
    resolvedParticipantIds.map(async (participantId) => {
      await pushUnreadCountToUser(payload, conversationId, participantId, lastMessageAt)
    }),
  )
}

async function pushNotificationsSummaryToUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: number,
) {
  const summary = await getUnreadNotificationsSummaryForUserId({
    payload,
    userId,
  })

  broadcastNotificationsToUser(String(userId), {
    type: 'notifications_summary',
    summary,
  })
}

async function pushNotificationsSummaryToParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  participantIds?: number[],
) {
  const resolvedParticipantIds =
    participantIds && participantIds.length > 0
      ? participantIds
      : await getConversationParticipantIds(payload, conversationId)

  await Promise.all(
    resolvedParticipantIds.map(async (participantId) => {
      await pushNotificationsSummaryToUser(payload, participantId)
    }),
  )
}

async function broadcastToConversationParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  data: object,
  participantIds?: number[],
) {
  const resolvedParticipantIds =
    participantIds && participantIds.length > 0
      ? participantIds
      : await getConversationParticipantIds(payload, conversationId)

  for (const participantId of resolvedParticipantIds) {
    broadcastToUser(String(participantId), data)
  }
}

async function broadcastToActiveConversationSockets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  data: object,
  participantIds?: number[],
  exclude?: AuthenticatedSocket,
) {
  const resolvedParticipantIds =
    participantIds && participantIds.length > 0
      ? participantIds
      : await getConversationParticipantIds(payload, conversationId)

  const payloadString = JSON.stringify(data)

  for (const participantId of resolvedParticipantIds) {
    const sockets = getUserSockets(String(participantId))

    if (!sockets) continue

    for (const socket of sockets) {
      if (
        socket === exclude ||
        socket.readyState !== 1 /* OPEN */ ||
        socket.currentConversationId !== String(conversationId)
      ) {
        continue
      }

      socket.send(payloadString)
    }
  }
}

async function pushConversationTypingToParticipants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  conversationId: number,
  typingUserId: number,
  isTyping: boolean,
  participantIds?: number[],
) {
  const resolvedParticipantIds =
    participantIds && participantIds.length > 0
      ? participantIds
      : await getConversationParticipantIds(payload, conversationId)

  for (const participantId of resolvedParticipantIds) {
    if (participantId === typingUserId) continue

    broadcastToUser(String(participantId), {
      type: 'conversation_typing',
      conversationId: String(conversationId),
      isTyping,
    })
  }
}

export async function setupWebSocket(wss: WebSocketServer) {
  const payload = await getPayload({ config: await config })

  const broadcastPresence = async (
    userId: string,
    isOnline: boolean,
    excludeSocket?: AuthenticatedSocket,
  ) => {
    const userNumericId = Number(userId)

    if (!Number.isFinite(userNumericId)) return

    const conversations = await payload.find({
      collection: 'conversations',
      where: {
        participants: {
          in: [userNumericId],
        },
      },
      depth: 0,
      limit: 200,
      overrideAccess: true,
    })

    for (const conversation of conversations.docs) {
      broadcast(String(conversation.id), { type: 'presence', userId, isOnline }, excludeSocket)
    }
  }

  const finalizeSocket = async (ws: AuthenticatedSocket) => {
    if (ws.finalized || !ws.userId) return

    ws.finalized = true
    if (ws.currentConversationId) {
      const conversationNumericId = Number(ws.currentConversationId)
      const typingUserNumericId = Number(ws.userId)

      if (Number.isFinite(conversationNumericId) && Number.isFinite(typingUserNumericId)) {
        await pushConversationTypingToParticipants(
          payload,
          conversationNumericId,
          typingUserNumericId,
          false,
        )
      }
    }
    const becameOffline = setUserOffline(ws.userId)
    removeUserSocket(ws.userId, ws)

    leaveAllRooms(ws)

    if (becameOffline) {
      await broadcastPresence(ws.userId, false, ws)
    }
  }

  wss.on('connection', async (ws: AuthenticatedSocket, req: IncomingMessage) => {
    // Mark alive immediately so the heartbeat checker does not terminate this
    // socket while authentication is still in progress (payload.auth is async).
    ws.isAlive = true
    ws.lastSeenAt = Date.now()

    // Authenticate using the Payload session cookie sent automatically by the browser
    const cookieHeader = req.headers.cookie || ''
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    const secFetchSiteHeader =
      typeof req.headers['sec-fetch-site'] === 'string' ? req.headers['sec-fetch-site'] : ''

    const headers = new Headers()

    if (cookieHeader) headers.set('cookie', cookieHeader)
    if (originHeader) headers.set('origin', originHeader)
    if (secFetchSiteHeader) headers.set('sec-fetch-site', secFetchSiteHeader)

    let userId: string | undefined

    try {
      const { user } = await payload.auth({ headers })
      if (!user) {
        console.warn('[WS] Unauthorized connection')
        ws.close(1008, 'Unauthorized')
        return
      }
      userId = String(user.id)
    } catch {
      console.warn('[WS] Authentication failed')
      ws.close(1008, 'Authentication failed')
      return
    }

    ws.userId = userId
    ws.isAlive = true
    ws.finalized = false
    ws.lastSeenAt = Date.now()
    ws.notificationsSubscribed = false
    const wasOffline = !isUserOnline(userId)
    setUserOnline(userId)
    addUserSocket(userId, ws)

    ws.on('pong', () => {
      ws.isAlive = true
      ws.lastSeenAt = Date.now()
    })

    ws.on('message', async (raw) => {
      let message: WsMessage

      try {
        message = JSON.parse(raw.toString()) as WsMessage
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
        return
      }

      ws.lastSeenAt = Date.now()

      try {
        switch (message.type) {
          case 'join_conversation':
            await handleJoin(ws, message.conversationId, payload)
            break

          case 'leave_conversation':
            await handleLeave(ws, message.conversationId, payload)
            break

          case 'send_message':
            await handleSend(ws, message.conversationId, message.content, payload)
            break

          case 'subscribe_conversations_list':
            await handleSubscribeConversationsList(ws, payload)
            break

          case 'subscribe_notifications':
            await handleSubscribeNotifications(ws, payload)
            break

          case 'mark_read':
            await handleMarkRead(ws, message.conversationId, payload)
            break

          case 'edit_message':
            await handleEdit(ws, message.conversationId, message.messageId, message.content, payload)
            break

          case 'react_message':
            await handleReact(ws, message.conversationId, message.messageId, message.emoji, payload)
            break

          case 'typing':
            await handleTyping(ws, message.conversationId, message.isTyping, payload)
            break

          case 'delete_message':
            await handleDelete(ws, message.conversationId, message.messageId, message.scope, payload)
            break

          case 'heartbeat':
            ws.isAlive = true
            break

          case 'disconnect':
            await finalizeSocket(ws)
            ws.close(1000, 'Client disconnected')
            break

          default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }))
        }
      } catch (err) {
        console.error('[WS] Error handling message:', err)
        ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }))
      }
    })

    ws.on('close', () => {
      void finalizeSocket(ws)
    })
    ws.on('error', () => {
      void finalizeSocket(ws)
    })

    ws.send(JSON.stringify({ type: 'connected', userId }))

    if (wasOffline) {
      await broadcastPresence(userId, true, ws)
    }
  })

  // Heartbeat — detect and drop dead connections faster to keep presence responsive
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<AuthenticatedSocket>) {
      const isStale = !ws.lastSeenAt || Date.now() - ws.lastSeenAt > 12_000

      if (!ws.isAlive || isStale) {
        void finalizeSocket(ws)
        ws.terminate()
        continue
      }

      ws.isAlive = false
      ws.ping()
    }
  }, 4_000)

  wss.on('close', () => clearInterval(heartbeat))
}

async function handleJoin(
  ws: AuthenticatedSocket,
  conversationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const userNumericId = Number(ws.userId)

  if (!Number.isFinite(conversationNumericId) || !Number.isFinite(userNumericId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid conversation' }))
    return
  }

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      and: [{ id: { equals: conversationNumericId } }, { participants: { in: [userNumericId] } }],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  if (conversations.docs.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not a participant' }))
    return
  }

  const conversation = conversations.docs[0]

  if (ws.currentConversationId && ws.currentConversationId !== conversationId) {
    await handleLeave(ws, ws.currentConversationId, payload)
  }

  if (!rooms.has(conversationId)) rooms.set(conversationId, new Set())
  rooms.get(conversationId)!.add(ws)
  ws.currentConversationId = conversationId

  ws.send(JSON.stringify({ type: 'joined', conversationId }))

  await handleMarkRead(ws, conversationId, payload)

  const visibleMessages = await getVisibleConversationMessagesForUser(
    payload,
    conversationNumericId,
    userNumericId,
  )

  ws.send(
    JSON.stringify({
      type: 'conversation_snapshot',
      conversationId,
      messages: visibleMessages,
    }),
  )

  for (const participant of conversation.participants || []) {
    const participantId =
      typeof participant === 'object' && participant && 'id' in participant
        ? String(participant.id)
        : String(participant)

    if (participantId === ws.userId) continue

    ws.send(
      JSON.stringify({
        type: 'presence',
        userId: participantId,
        isOnline: isUserOnline(participantId),
      }),
    )
  }
}

async function handleLeave(
  ws: AuthenticatedSocket,
  conversationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const room = rooms.get(conversationId)
  if (!room) return
  if (ws.userId) {
    setConversationTypingState(conversationId, ws.userId, false)
    broadcast(conversationId, { type: 'typing', conversationId, userId: ws.userId, isTyping: false }, ws)

    const conversationNumericId = Number(conversationId)
    const typingUserNumericId = Number(ws.userId)

    if (Number.isFinite(conversationNumericId) && Number.isFinite(typingUserNumericId)) {
      await pushConversationTypingToParticipants(
        payload,
        conversationNumericId,
        typingUserNumericId,
        false,
      )
    }
  }
  room.delete(ws)
  if (room.size === 0) rooms.delete(conversationId)
  if (ws.currentConversationId === conversationId) {
    ws.currentConversationId = undefined
  }
  ws.send(JSON.stringify({ type: 'left', conversationId }))
}

async function handleTyping(
  ws: AuthenticatedSocket,
  conversationId: string,
  isTyping: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  if (ws.userId) {
    setConversationTypingState(conversationId, ws.userId, isTyping)

    const conversationNumericId = Number(conversationId)
    const typingUserNumericId = Number(ws.userId)

    if (Number.isFinite(conversationNumericId) && Number.isFinite(typingUserNumericId)) {
      await pushConversationTypingToParticipants(
        payload,
        conversationNumericId,
        typingUserNumericId,
        isTyping,
      )
    }
  }

  broadcast(conversationId, { type: 'typing', conversationId, userId: ws.userId, isTyping }, ws)
}

async function handleSend(
  ws: AuthenticatedSocket,
  conversationId: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const userNumericId = Number(ws.userId)

  if (!Number.isFinite(conversationNumericId) || !Number.isFinite(userNumericId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid conversation' }))
    return
  }

  if (!content?.trim()) {
    ws.send(JSON.stringify({ type: 'error', message: 'Empty message' }))
    return
  }

  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  // Save message — bypass access control since auth is already validated
  const saved = await payload.create({
    collection: 'messages',
    data: {
      conversation: conversationNumericId,
      sender: userNumericId,
      content: content.trim(),
      readBy: [userNumericId],
    },
    overrideAccess: true,
    depth: 1,
  })

  // Keep conversation metadata up to date
  await payload.update({
    collection: 'conversations',
    id: conversationNumericId,
    data: {
      lastMessage: saved.id,
      lastMessageAt: saved.createdAt,
    },
    overrideAccess: true,
  })

  // Broadcast to every socket in the room (including sender for confirmation)
  const newMessageEvent = { type: 'new_message', message: saved }

  broadcast(conversationId, newMessageEvent)
  await broadcastToActiveConversationSockets(payload, conversationNumericId, newMessageEvent)

  await pushUnreadCountsToParticipants(payload, conversationNumericId, undefined, saved.createdAt)
  await pushNotificationsSummaryToParticipants(payload, conversationNumericId)
}

async function handleSubscribeConversationsList(
  ws: AuthenticatedSocket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const userNumericId = Number(ws.userId)

  if (!Number.isFinite(userNumericId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid user' }))
    return
  }

  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      participants: {
        in: [userNumericId],
      },
    },
    depth: 0,
    limit: 200,
    sort: '-lastMessageAt',
    overrideAccess: true,
  })

  const items = await Promise.all(
    conversations.docs.map(async (conversation: { id: number | string }) => {
      const conversationId = String(conversation.id)
      const typingUsers = conversationTypingUsers.get(conversationId)

      return {
        conversationId,
        isTyping: Array.from(typingUsers || []).some((typingUserId) => typingUserId !== ws.userId),
        unreadCount: await getUnreadCountForConversation(
          payload,
          Number(conversation.id),
          userNumericId,
        ),
      }
    }),
  )

  ws.send(
    JSON.stringify({
      type: 'conversation_unread_snapshot',
      items,
    }),
  )
}

async function handleSubscribeNotifications(
  ws: AuthenticatedSocket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const userNumericId = Number(ws.userId)

  if (!Number.isFinite(userNumericId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid user' }))
    return
  }

  ws.notificationsSubscribed = true

  const summary = await getUnreadNotificationsSummaryForUserId({
    payload,
    userId: userNumericId,
  })

  ws.send(
    JSON.stringify({
      type: 'notifications_summary',
      summary,
    }),
  )
}

async function handleMarkRead(
  ws: AuthenticatedSocket,
  conversationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const userNumericId = Number(ws.userId)

  if (!Number.isFinite(conversationNumericId) || !Number.isFinite(userNumericId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid read request' }))
    return
  }

  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [
        { conversation: { equals: conversationNumericId } },
        { sender: { not_equals: userNumericId } },
      ],
    },
    depth: 0,
    limit: 1000,
    sort: 'createdAt',
    overrideAccess: true,
  })

  const unreadMessages = messages.docs.filter((message: MessageRecord) =>
    isMessageUnreadForUser(message, userNumericId),
  )

  if (unreadMessages.length === 0) return

  const readMessageIds: string[] = []

  await Promise.all(
    unreadMessages.map(async (message: MessageRecord) => {
      const readBy = normalizeRelationshipIds(message.readBy)

      if (!readBy.includes(userNumericId)) {
        await payload.update({
          collection: 'messages',
          id: message.id,
          data: {
            readBy: [...readBy, userNumericId],
          },
          depth: 0,
          overrideAccess: true,
        })
      }

      readMessageIds.push(String(message.id))
    }),
  )

  if (readMessageIds.length === 0) return

  const messageReadEvent = {
    type: 'messages_read',
    conversationId,
    userId: ws.userId,
    messageIds: readMessageIds,
  }

  broadcast(conversationId, messageReadEvent)
  await broadcastToConversationParticipants(payload, conversationNumericId, messageReadEvent)

  await pushUnreadCountToUser(payload, conversationNumericId, userNumericId)
  await pushNotificationsSummaryToUser(payload, userNumericId)
}

async function handleDelete(
  ws: AuthenticatedSocket,
  conversationId: string,
  messageId: string,
  scope: 'self' | 'everyone',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const messageNumericId = Number(messageId)
  const userNumericId = Number(ws.userId)

  if (
    !Number.isFinite(conversationNumericId) ||
    !Number.isFinite(messageNumericId) ||
    !Number.isFinite(userNumericId)
  ) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid delete request' }))
    return
  }

  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [{ id: { equals: messageNumericId } }, { conversation: { equals: conversationNumericId } }],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  if (messages.docs.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Message not found' }))
    return
  }

  const existingMessage = messages.docs[0]

  if (scope === 'self') {
    const deletedFor = normalizeRelationshipIds(existingMessage.deletedFor)

    if (!deletedFor.includes(userNumericId)) {
      await payload.update({
        collection: 'messages',
        id: messageNumericId,
        data: {
          deletedFor: [...deletedFor, userNumericId],
        },
        overrideAccess: true,
      })
    }

    const deleteForSelfEvent = {
      type: 'message_deleted',
      conversationId,
      messageId,
      scope: 'self',
    }

    ws.send(
      JSON.stringify({
        ...deleteForSelfEvent,
      }),
    )
    await broadcastToActiveConversationSockets(
      payload,
      conversationNumericId,
      deleteForSelfEvent,
      [userNumericId],
      ws,
    )
    await pushUnreadCountToUser(payload, conversationNumericId, userNumericId)
    await pushNotificationsSummaryToUser(payload, userNumericId)
    return
  }

  const senderId = getRelationshipId(existingMessage.sender)

  if (senderId !== userNumericId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the sender can delete for everyone' }))
    return
  }

  const deletedMessage = await payload.update({
    collection: 'messages',
    id: messageNumericId,
    data: {
      content: 'Mensagem apagada',
      deletedForEveryone: true,
    },
    overrideAccess: true,
    depth: 1,
  })

  const deleteForEveryoneEvent = {
    type: 'message_deleted',
    conversationId,
    messageId,
    scope: 'everyone',
    message: deletedMessage,
  }

  broadcast(conversationId, deleteForEveryoneEvent)
  await broadcastToActiveConversationSockets(payload, conversationNumericId, deleteForEveryoneEvent)

  await pushUnreadCountsToParticipants(payload, conversationNumericId)
  await pushNotificationsSummaryToParticipants(payload, conversationNumericId)
}

async function handleEdit(
  ws: AuthenticatedSocket,
  conversationId: string,
  messageId: string,
  content: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const messageNumericId = Number(messageId)
  const userNumericId = Number(ws.userId)
  const trimmedContent = content?.trim()

  if (
    !Number.isFinite(conversationNumericId) ||
    !Number.isFinite(messageNumericId) ||
    !Number.isFinite(userNumericId)
  ) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid edit request' }))
    return
  }

  if (!trimmedContent) {
    ws.send(JSON.stringify({ type: 'error', message: 'Empty message' }))
    return
  }

  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [{ id: { equals: messageNumericId } }, { conversation: { equals: conversationNumericId } }],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  if (messages.docs.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Message not found' }))
    return
  }

  const existingMessage = messages.docs[0]
  const senderId = getRelationshipId(existingMessage.sender)

  if (senderId !== userNumericId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the sender can edit this message' }))
    return
  }

  if (existingMessage.deletedForEveryone) {
    ws.send(JSON.stringify({ type: 'error', message: 'Deleted messages cannot be edited' }))
    return
  }

  const updatedMessage = await payload.update({
    collection: 'messages',
    id: messageNumericId,
    data: {
      content: trimmedContent,
      editedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    depth: 1,
  })

  const updatedMessageEvent = {
    type: 'message_updated',
    message: updatedMessage,
  }

  broadcast(conversationId, updatedMessageEvent)
  await broadcastToActiveConversationSockets(payload, conversationNumericId, updatedMessageEvent)

  await pushNotificationsSummaryToParticipants(payload, conversationNumericId)
}

async function handleReact(
  ws: AuthenticatedSocket,
  conversationId: string,
  messageId: string,
  emoji: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversationNumericId = Number(conversationId)
  const messageNumericId = Number(messageId)
  const userNumericId = Number(ws.userId)
  const normalizedEmoji = emoji?.trim()

  if (
    !Number.isFinite(conversationNumericId) ||
    !Number.isFinite(messageNumericId) ||
    !Number.isFinite(userNumericId)
  ) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid reaction request' }))
    return
  }

  if (!normalizedEmoji) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid emoji' }))
    return
  }

  const room = rooms.get(conversationId)
  if (!room?.has(ws)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Join the conversation first' }))
    return
  }

  const messages = await payload.find({
    collection: 'messages',
    where: {
      and: [{ id: { equals: messageNumericId } }, { conversation: { equals: conversationNumericId } }],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  if (messages.docs.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Message not found' }))
    return
  }

  const existingMessage = messages.docs[0]

  if (existingMessage.deletedForEveryone) {
    ws.send(JSON.stringify({ type: 'error', message: 'Deleted messages cannot receive reactions' }))
    return
  }

  const currentReactions = normalizeReactions(existingMessage.reactions)
  const existingReaction = currentReactions.find((reaction) => reaction.emoji === normalizedEmoji)
  const isRemovingOwnReaction = Boolean(existingReaction?.users.includes(userNumericId))

  const nextReactions = currentReactions
    .map((reaction) => {
      if (reaction.emoji !== normalizedEmoji) return reaction

      const hasUserReaction = reaction.users.includes(userNumericId)

      return {
        emoji: reaction.emoji,
        users: hasUserReaction
          ? reaction.users.filter((id) => id !== userNumericId)
          : [...reaction.users, userNumericId],
      }
    })
    .filter((reaction) => reaction.users.length > 0)

  const hasReaction = nextReactions.some((reaction) => reaction.emoji === normalizedEmoji)

  if (!hasReaction && !isRemovingOwnReaction) {
    nextReactions.push({
      emoji: normalizedEmoji,
      users: [userNumericId],
    })
  }

  const updatedMessage = await payload.update({
    collection: 'messages',
    id: messageNumericId,
    data: {
      reactions: nextReactions,
    },
    overrideAccess: true,
    depth: 1,
  })

  broadcast(conversationId, {
    type: 'message_updated',
    message: updatedMessage,
  })
}
