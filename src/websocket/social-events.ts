type SocketLike = {
  currentConversationId?: string
  notificationsSubscribed?: boolean
  readyState: number
  send: (data: string) => void
}

const userSockets = new Map<string, Set<SocketLike>>()

function sendToSocket(socket: SocketLike, payload: string) {
  if (socket.readyState === 1) {
    socket.send(payload)
  }
}

export function addUserSocket(userId: string, socket: SocketLike) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set())
  }

  userSockets.get(userId)?.add(socket)
}

export function removeUserSocket(userId: string, socket: SocketLike) {
  const sockets = userSockets.get(userId)

  if (!sockets) return

  sockets.delete(socket)

  if (sockets.size === 0) {
    userSockets.delete(userId)
  }
}

export function getUserSockets(userId: string) {
  return userSockets.get(userId)
}

export function broadcastToUserSockets(
  userId: string,
  data: object,
  options?: {
    exclude?: SocketLike
    requireNotificationsSubscribed?: boolean
  },
) {
  const sockets = userSockets.get(userId)

  if (!sockets) return

  const payload = JSON.stringify(data)

  for (const socket of sockets) {
    if (socket === options?.exclude) continue
    if (options?.requireNotificationsSubscribed && !socket.notificationsSubscribed) continue
    sendToSocket(socket, payload)
  }
}

export function broadcastToAllUserSockets(data: object) {
  const payload = JSON.stringify(data)
  const seen = new Set<SocketLike>()

  for (const sockets of userSockets.values()) {
    for (const socket of sockets) {
      if (seen.has(socket)) continue
      seen.add(socket)
      sendToSocket(socket, payload)
    }
  }
}

export function emitReactionUpdate(data: {
  targetType: 'post' | 'reel' | 'comment'
  targetId: string
  likesCount: number
  dislikesCount: number
}) {
  broadcastToAllUserSockets({ type: 'reaction:update', ...data })
}

export function emitCommentNew(data: {
  targetType: 'post' | 'reel'
  targetId: string
  comment: {
    id: string
    authorId: string
    content: string
    createdAt?: string
    parentId?: string | null
  }
}) {
  broadcastToAllUserSockets({ type: 'comment:new', ...data })
}

export function emitStoryNew(data: {
  storyId: string
  authorId: string
  expiresAt?: string
}) {
  broadcastToAllUserSockets({ type: 'story:new', ...data })
}

export function emitFollowRequest(targetUserId: string | number, data: { followerId: string }) {
  broadcastToUserSockets(String(targetUserId), { type: 'follow:request', ...data })
}
