'use client'

import { Check, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'

interface Message {
  id: string | number
  content: string
  conversation?:
    | {
        id: string | number
      }
    | string
    | number
    | null
  createdAt: string
  editedAt?: string | null
  deletedForEveryone?: boolean | null
  reactions?: Array<{
    emoji: string
    users?: Array<
      | {
          id: string | number
        }
      | string
      | number
    > | null
  }> | null
  sender:
    | { id: string | number; name?: string; email: string; avatar?: { filename: string } | null }
    | string
    | number
  readBy?: Array<
    | {
        id: string | number
      }
    | string
    | number
  > | null
}

interface ChatParticipant {
  id: string
  name?: string
  email: string
  avatar?: { filename: string } | null
}

interface ChatInterfaceProps {
  conversationId: string
  currentUserId: string
  enableMessageObfuscation: boolean
  initialMessagesPage: number
  initialMessagesTotalDocs: number
  initialMessagesTotalPages: number
  otherUser: ChatParticipant
  initialMessages: Message[]
}

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export default function ChatInterface({
  conversationId,
  currentUserId,
  enableMessageObfuscation,
  initialMessagesPage,
  initialMessagesTotalDocs,
  initialMessagesTotalPages,
  otherUser,
  initialMessages,
}: ChatInterfaceProps) {
  const reactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🔥']
  const emojiOptions = [
    '😀',
    '😂',
    '🥹',
    '😍',
    '😎',
    '🤔',
    '😅',
    '😢',
    '🔥',
    '❤️',
    '👍',
    '🙏',
    '👏',
    '🎉',
    '🚀',
  ]
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [oldestLoadedPage, setOldestLoadedPage] = useState(initialMessagesPage)
  const [totalMessages, setTotalMessages] = useState(initialMessagesTotalDocs)
  const [totalPages, setTotalPages] = useState(initialMessagesTotalPages)
  const [pageError, setPageError] = useState('')
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [input, setInput] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false)
  const [isOtherUserOnline, setIsOtherUserOnline] = useState<boolean | null>(null)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [revealedMessageId, setRevealedMessageId] = useState<string | null>(null)
  const [status, setStatus] = useState<WsStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<Message[]>(initialMessages)
  const totalMessagesRef = useRef(initialMessagesTotalDocs)
  const shouldAutoScrollRef = useRef(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editingMessageIdRef = useRef<string | null>(null)
  const oldestLoadedPageRef = useRef(initialMessagesPage)
  const isJoinedRef = useRef(false)
  const pendingEditMessageIdRef = useRef<string | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingSentRef = useRef(false)
  const shouldReconnectRef = useRef(true)

  function getMessageConversationId(message: Message | null | undefined) {
    if (!message?.conversation) return null

    return getRelationshipId(message.conversation)
  }

  function mergeMessagesById(nextMessages: Message[]) {
    const messagesById = new Map<string, Message>()

    for (const message of nextMessages) {
      messagesById.set(String(message.id), message)
    }

    return Array.from(messagesById.values()).sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )
  }

  const loadOlderMessages = useCallback(
    async () => {
      const nextPage = oldestLoadedPageRef.current + 1

      if (isLoadingPage || nextPage > totalPages) return

      setIsLoadingPage(true)
      setPageError('')

      try {
        const scrollContainer = messagesContainerRef.current
        const previousScrollHeight = scrollContainer?.scrollHeight ?? 0
        const previousScrollTop = scrollContainer?.scrollTop ?? 0

        const response = await fetch(
          `/api/chat/conversations/${conversationId}/messages?page=${nextPage}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        )

        const data = (await response.json()) as {
          docs?: Message[]
          message?: string
          page?: number
          totalDocs?: number
          totalPages?: number
        }

        if (!response.ok || !Array.isArray(data.docs)) {
          throw new Error(data.message || 'Nao foi possivel carregar as mensagens.')
        }

        const resolvedPage = Number(data.page) || nextPage
        const nextPageMessages = data.docs as Message[]

        oldestLoadedPageRef.current = resolvedPage
        setOldestLoadedPage(resolvedPage)
        totalMessagesRef.current = Number(data.totalDocs) || 0
        setTotalMessages(totalMessagesRef.current)
        setTotalPages(Number(data.totalPages) || 1)
        shouldAutoScrollRef.current = false
        setMessages((prev) => mergeMessagesById([...nextPageMessages, ...prev]))

        window.requestAnimationFrame(() => {
          if (!scrollContainer) return

          const nextScrollHeight = scrollContainer.scrollHeight
          scrollContainer.scrollTop = nextScrollHeight - previousScrollHeight + previousScrollTop
        })
      } catch (error) {
        setPageError(
          error instanceof Error ? error.message : 'Nao foi possivel carregar as mensagens.',
        )
      } finally {
        setIsLoadingPage(false)
      }
    },
    [conversationId, isLoadingPage, totalPages],
  )

  const sendTypingState = useCallback(
    (isTyping: boolean) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || !isJoined) return

      if (typingSentRef.current === isTyping) return

      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId, isTyping }))
      typingSentRef.current = isTyping
    },
    [conversationId, isJoined],
  )

  const connect = useCallback(() => {
    shouldReconnectRef.current = true
    setStatus('connecting')
    setIsJoined(false)
    isJoinedRef.current = false
    setIsOtherUserTyping(false)
    setIsOtherUserOnline(null)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')

      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }))
        }
      }, 4_000)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'connected') {
        ws.send(JSON.stringify({ type: 'join_conversation', conversationId }))
        return
      }

      if (data.type === 'joined') {
        isJoinedRef.current = true
        setIsJoined(true)
        return
      }

      if (data.type === 'presence') {
        if (String(data.userId) === String(currentUserId)) return
        setIsOtherUserOnline(Boolean(data.isOnline))
        return
      }

      if (data.type === 'typing') {
        if (String(data.userId) === String(currentUserId)) return
        setIsOtherUserTyping(Boolean(data.isTyping))
        return
      }

      if (data.type === 'error') {
        pendingEditMessageIdRef.current = null
        isJoinedRef.current = false
        setIsJoined(false)
        setIsOtherUserTyping(false)
        setIsOtherUserOnline(null)
        setStatus('error')
        ws.close()
        return
      }

      if (data.type === 'new_message') {
        if (getMessageConversationId(data.message) !== String(conversationId)) {
          return
        }

        if (messagesRef.current.some((message) => String(message.id) === String(data.message.id))) {
          return
        }

        shouldAutoScrollRef.current = true
        setMessages((prev) => {
          return mergeMessagesById([...prev, data.message])
        })
        totalMessagesRef.current += 1
        setTotalMessages(totalMessagesRef.current)

        const senderId =
          typeof data.message?.sender === 'object' ? data.message.sender.id : data.message?.sender

        if (String(senderId) !== String(currentUserId)) {
          void markConversationAsRead()
        }

        setActiveMenuMessageId(null)
        return
      }

      if (data.type === 'messages_read' && Array.isArray(data.messageIds)) {
        if (String(data.conversationId) !== String(conversationId)) {
          return
        }

        const readMessageIds = new Set(
          data.messageIds.map((messageId: string | number) => String(messageId)),
        )

        setMessages((prev) =>
          prev.map((message) => {
            if (!readMessageIds.has(String(message.id))) return message

            const currentReadByIds = getReadByIds(message.readBy)

            if (currentReadByIds.includes(String(data.userId))) {
              return message
            }

            return {
              ...message,
              readBy: [...currentReadByIds, String(data.userId)],
            }
          }),
        )
        return
      }

      if (data.type === 'message_updated' && data.message) {
        if (getMessageConversationId(data.message) !== String(conversationId)) {
          return
        }

        setMessages((prev) =>
          prev.map((message) =>
            String(message.id) === String(data.message.id) ? data.message : message,
          ),
        )
        if (String(pendingEditMessageIdRef.current) === String(data.message.id)) {
          pendingEditMessageIdRef.current = null
          setEditingMessageId(null)
          setInput('')
        }
        return
      }

      if (data.type === 'message_deleted') {
        if (String(data.conversationId) !== String(conversationId)) {
          return
        }

        if (data.scope === 'self') {
          if (String(editingMessageIdRef.current) === String(data.messageId)) {
            pendingEditMessageIdRef.current = null
            setEditingMessageId(null)
            setInput('')
          }
          setMessages((prev) =>
            prev.filter((message) => String(message.id) !== String(data.messageId)),
          )
          setEditingMessageId((current) =>
            String(current) === String(data.messageId) ? null : current,
          )
          setActiveMenuMessageId((current) =>
            String(current) === String(data.messageId) ? null : current,
          )
          return
        }

        if (data.scope === 'everyone' && data.message) {
          if (String(editingMessageIdRef.current) === String(data.messageId)) {
            pendingEditMessageIdRef.current = null
            setEditingMessageId(null)
            setInput('')
          }
          setMessages((prev) =>
            prev.map((message) =>
              String(message.id) === String(data.messageId) ? data.message : message,
            ),
          )
          setEditingMessageId((current) =>
            String(current) === String(data.messageId) ? null : current,
          )
          setActiveMenuMessageId((current) =>
            String(current) === String(data.messageId) ? null : current,
          )
          return
        }
      }

      if (data.type === 'conversation_snapshot' && Array.isArray(data.messages)) {
        if (String(data.conversationId) !== String(conversationId)) {
          return
        }

        shouldAutoScrollRef.current = true
        setMessages((prev) => mergeMessagesById([...prev, ...data.messages]))
      }
    }

    ws.onclose = (event) => {
      const shouldReconnect = shouldReconnectRef.current && event.code !== 1008

      isJoinedRef.current = false
      setIsJoined(false)
      setIsOtherUserTyping(false)
      setIsOtherUserOnline(null)
      typingSentRef.current = false
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)

      setStatus('disconnected')

      if (shouldReconnect) {
        reconnectTimer.current = setTimeout(() => {
          connect()
        }, 3_000)
      }
    }

    ws.onerror = () => {
      isJoinedRef.current = false
      setIsJoined(false)
      setIsOtherUserTyping(false)
      setIsOtherUserOnline(null)
      setStatus('error')
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      ws.close()
    }
  }, [conversationId, currentUserId])

  useEffect(() => {
    setMessages(initialMessages)
    messagesRef.current = initialMessages
    setOldestLoadedPage(initialMessagesPage)
    oldestLoadedPageRef.current = initialMessagesPage
    totalMessagesRef.current = initialMessagesTotalDocs
    setTotalMessages(initialMessagesTotalDocs)
    setTotalPages(initialMessagesTotalPages)
    setPageError('')
  }, [initialMessages, initialMessagesPage, initialMessagesTotalDocs, initialMessagesTotalPages])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    function closeSocket() {
      shouldReconnectRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)

      const ws = wsRef.current
      if (!ws) return

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'disconnect' }))
        ws.close(1000, 'Page closed')
        return
      }

      if (ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Page closed')
      }
    }

    connect()
    window.addEventListener('pagehide', closeSocket)
    window.addEventListener('beforeunload', closeSocket)

    return () => {
      window.removeEventListener('pagehide', closeSocket)
      window.removeEventListener('beforeunload', closeSocket)
      closeSocket()
    }
  }, [connect])

  useEffect(() => {
    editingMessageIdRef.current = editingMessageId

    if (!editingMessageId) {
      pendingEditMessageIdRef.current = null
    }
  }, [editingMessageId])

  useEffect(() => {
    if (!isJoined) return

    void markConversationAsRead()
  }, [isJoined])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null

      if (!target?.closest('[data-chat-menu-root], [data-chat-menu-toggle]')) {
        setActiveMenuMessageId(null)
      }

      if (!target?.closest('[data-chat-emoji-root], [data-chat-emoji-toggle]')) {
        setIsEmojiPickerOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isLoadingPage) return
    if (!shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current = true
      return
    }

    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isLoadingPage, messages])

  async function markConversationAsRead() {
    if (wsRef.current?.readyState === WebSocket.OPEN && isJoinedRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'mark_read', conversationId }))
      return
    }

    try {
      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // Best effort only.
    }
  }

  function getRelationshipId(
    value:
      | {
          id: string | number
        }
      | string
      | number
      | null
      | undefined,
  ) {
    if (!value) return null
    return typeof value === 'object' ? String(value.id) : String(value)
  }

  function getReactionUserIds(
    reaction:
      | {
          emoji: string
          users?: Array<
            | {
                id: string | number
              }
            | string
            | number
          > | null
        }
      | null
      | undefined,
  ) {
    if (!reaction?.users) return []

    return reaction.users
      .map((entry) => getRelationshipId(entry))
      .filter((entry): entry is string => Boolean(entry))
  }

  function getReadByIds(
    readBy:
      | Array<
          | {
              id: string | number
            }
          | string
          | number
        >
      | null
      | undefined,
  ) {
    if (!Array.isArray(readBy)) return []

    return readBy
      .map((entry) => getRelationshipId(entry))
      .filter((entry): entry is string => Boolean(entry))
  }

  function sendMessage() {
    const content = input.trim()
    if (!content || wsRef.current?.readyState !== WebSocket.OPEN || !isJoined) return

    sendTypingState(false)

    if (editingMessageId) {
      pendingEditMessageIdRef.current = editingMessageId
      wsRef.current.send(
        JSON.stringify({
          type: 'edit_message',
          conversationId,
          messageId: editingMessageId,
          content,
        }),
      )
      setActiveMenuMessageId(null)
      setIsEmojiPickerOpen(false)
      return
    }

    wsRef.current.send(JSON.stringify({ type: 'send_message', conversationId, content }))
    setInput('')
  }

  function handleInputChange(value: string) {
    setInput(value)

    if (!value.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      sendTypingState(false)
      return
    }

    sendTypingState(true)

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      sendTypingState(false)
    }, 1200)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function appendEmoji(emoji: string) {
    setInput((current) => `${current}${emoji}`)
    setIsEmojiPickerOpen(false)
    textareaRef.current?.focus()
  }

  function startEditingMessage(message: Message) {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !isJoined || message.deletedForEveryone)
      return

    pendingEditMessageIdRef.current = null
    setEditingMessageId(String(message.id))
    setInput(message.content)
    setActiveMenuMessageId(null)
    setIsEmojiPickerOpen(false)

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const valueLength = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(valueLength, valueLength)
    })
  }

  function cancelEditingMessage() {
    sendTypingState(false)
    pendingEditMessageIdRef.current = null
    setEditingMessageId(null)
    setInput('')
  }

  function deleteMessage(messageId: string, scope: 'self' | 'everyone') {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !isJoined) return

    wsRef.current.send(JSON.stringify({ type: 'delete_message', conversationId, messageId, scope }))
    setActiveMenuMessageId(null)
  }

  function toggleReaction(messageId: string, emoji: string) {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !isJoined) return

    wsRef.current.send(JSON.stringify({ type: 'react_message', conversationId, messageId, emoji }))
    setActiveMenuMessageId(null)
  }

  function handleMessagePointerDown(messageId: string, shouldReveal: boolean) {
    if (!shouldReveal) return

    setRevealedMessageId(messageId)
  }

  function handleMessagePointerUp(messageId: string) {
    setRevealedMessageId((current) => (current === messageId ? null : current))
  }

  const canLoadOlderMessages = oldestLoadedPage < totalPages

  const otherAvatarUrl = otherUser.avatar?.filename
    ? `/api/media/file/${otherUser.avatar.filename}`
    : null

  const connectionDotColor =
    status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : '#ef4444'

  const presenceDotColor =
    isOtherUserOnline === null ? '#f59e0b' : isOtherUserOnline ? '#22c55e' : '#ef4444'

  const isComposerDisabled = status !== 'connected' || !isJoined
  const isSendDisabled = isComposerDisabled || !input.trim()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '94vh',
        maxWidth: 700,
        margin: '0 auto',
        fontFamily: 'sans-serif',
        color: '#f5f7fb',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid #2d3748',
          background: '#121826',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {otherAvatarUrl ? (
          <div
            style={{
              borderRadius: '50%',
              overflow: 'hidden',
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              aspectRatio: '1 / 1',
              border: `2px solid ${connectionDotColor}`,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <Image
              src={otherAvatarUrl}
              alt={otherUser.name || otherUser.email}
              fill
              sizes="40px"
              style={{
                objectFit: 'cover',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              background: '#0070f3',
              border: `2px solid ${connectionDotColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(otherUser.name || otherUser.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 20,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {otherUser.name || otherUser.email}
            </div>
            <span
              aria-label={isOtherUserOnline ? 'Usuario online' : 'Usuario offline'}
              title={isOtherUserOnline ? 'Usuario online' : 'Usuario offline'}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: presenceDotColor,
                flexShrink: 0,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#60a5fa',
              minHeight: 18,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ visibility: isOtherUserTyping ? 'visible' : 'hidden' }}>
              Digitando...
            </span>
          </div>
        </div>
        <a
          href="/chat"
          style={{ marginLeft: 'auto', fontSize: 13, color: '#0070f3', textDecoration: 'none' }}
        >
          ← Voltar
        </a>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '18px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {totalMessages} mensagem{totalMessages === 1 ? '' : 'ens'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              {isLoadingPage ? 'Carregando mensagens antigas...' : 'Historico da conversa'}
            </div>
          </div>
          <button
            onClick={() => {
              if (!canLoadOlderMessages || isLoadingPage) return

              void loadOlderMessages()
            }}
            disabled={!canLoadOlderMessages || isLoadingPage}
            style={{
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #334155',
              background: canLoadOlderMessages && !isLoadingPage ? '#111827' : '#0b1220',
              color: canLoadOlderMessages && !isLoadingPage ? '#e2e8f0' : '#64748b',
              cursor: canLoadOlderMessages && !isLoadingPage ? 'pointer' : 'not-allowed',
            }}
          >
            {canLoadOlderMessages ? 'Carregar mais antigas' : 'Sem mais mensagens antigas'}
          </button>
        </div>
        {pageError && (
          <div
            style={{
              marginBottom: 8,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(248, 113, 113, 0.35)',
              background: 'rgba(127, 29, 29, 0.28)',
              color: '#fecaca',
              fontSize: 13,
            }}
          >
            {pageError}
          </div>
        )}
        {messages.length === 0 && (
          <p style={{ color: '#9aa4b2', textAlign: 'center', marginTop: 40 }}>
            Sem mensagens ainda. Diga olá!
          </p>
        )}
        {messages.map((msg) => {
          const senderId = typeof msg.sender === 'object' ? msg.sender.id : msg.sender
          const isMine = String(senderId) === String(currentUserId)
          const isMenuOpen = activeMenuMessageId === String(msg.id)
          const isDeletedForEveryone = Boolean(msg.deletedForEveryone)
          const isContentObfuscated = enableMessageObfuscation && !isDeletedForEveryone
          const isContentRevealed = revealedMessageId === String(msg.id)
          const readByIds = getReadByIds(msg.readBy)
          const isSeenByOtherParticipant = isMine
            ? readByIds.some((entry) => entry !== String(currentUserId))
            : false
          const visibleReactions =
            msg.reactions?.filter((reaction) => getReactionUserIds(reaction).length > 0) || []

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  maxWidth: '82%',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    maxWidth: '100%',
                    minWidth: 88,
                    flexShrink: 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMine ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      onPointerDown={() =>
                        handleMessagePointerDown(String(msg.id), isContentObfuscated)
                      }
                      onPointerUp={() => handleMessagePointerUp(String(msg.id))}
                      onPointerCancel={() => handleMessagePointerUp(String(msg.id))}
                      onPointerLeave={() => handleMessagePointerUp(String(msg.id))}
                      style={{
                        width: 'fit-content',
                        maxWidth: '100%',
                        padding: '8px 14px',
                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isDeletedForEveryone
                          ? '#2b3342'
                          : isMine
                            ? '#0070f3'
                            : '#1d2636',
                        color: '#f5f7fb',
                        fontSize: 15,
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'normal',
                        fontStyle: isDeletedForEveryone ? 'italic' : 'normal',
                        opacity: isDeletedForEveryone ? 0.82 : 1,
                        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
                        cursor: isContentObfuscated ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      title={
                        isContentObfuscated
                          ? 'Mantenha pressionado para revelar a mensagem'
                          : undefined
                      }
                    >
                      <span
                        style={{
                          filter:
                            isContentObfuscated && !isContentRevealed ? 'blur(8px)' : 'none',
                          transition: 'filter 120ms ease',
                        }}
                      >
                        {isDeletedForEveryone ? 'Mensagem apagada' : msg.content}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          fontSize: 10,
                          marginTop: 4,
                          opacity: 0.7,
                          textAlign: 'right',
                        }}
                      >
                        {msg.editedAt && !isDeletedForEveryone && <span>editada</span>}
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && (
                          <span
                            title={
                              isSeenByOtherParticipant
                                ? 'Mensagem visualizada'
                                : 'Mensagem recebida pelo servidor'
                            }
                            aria-label={
                              isSeenByOtherParticipant
                                ? 'Mensagem visualizada'
                                : 'Mensagem recebida pelo servidor'
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: isSeenByOtherParticipant ? '#bfdbfe' : '#dbeafe',
                            }}
                          >
                            {isSeenByOtherParticipant ? (
                              <CheckCheck size={12} strokeWidth={2.4} />
                            ) : (
                              <Check size={12} strokeWidth={2.4} />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isDeletedForEveryone && visibleReactions.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        {visibleReactions.map((reaction) => {
                          const reactionUserIds = getReactionUserIds(reaction)
                          const hasCurrentUser = reactionUserIds.includes(String(currentUserId))

                          return (
                            <button
                              key={`${msg.id}-${reaction.emoji}`}
                              onClick={() => toggleReaction(String(msg.id), reaction.emoji)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                border: hasCurrentUser ? '1px solid #60a5fa' : '1px solid #2d3748',
                                background: hasCurrentUser ? 'rgba(96, 165, 250, 0.18)' : '#121826',
                                color: '#f5f7fb',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                              title="Alternar reação"
                            >
                              <span>{reaction.emoji}</span>
                              <span>{reactionUserIds.length}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {isMenuOpen && (
                    <div
                      data-chat-menu-root
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: isMine ? 0 : 'auto',
                        left: isMine ? 'auto' : 0,
                        minWidth: 168,
                        background: '#121826',
                        border: '1px solid #2d3748',
                        borderRadius: 10,
                        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
                        padding: 6,
                        zIndex: 20,
                      }}
                    >
                      {!isDeletedForEveryone && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            padding: '6px 8px 10px',
                            borderBottom: '1px solid #1f2937',
                            marginBottom: 4,
                          }}
                        >
                          {reactionOptions.map((emoji) => {
                            const hasCurrentUser = visibleReactions.some(
                              (reaction) =>
                                reaction.emoji === emoji &&
                                getReactionUserIds(reaction).includes(String(currentUserId)),
                            )

                            return (
                              <button
                                key={`${msg.id}-picker-${emoji}`}
                                onClick={() => toggleReaction(String(msg.id), emoji)}
                                style={{
                                  border: hasCurrentUser
                                    ? '1px solid #60a5fa'
                                    : '1px solid #2d3748',
                                  background: hasCurrentUser
                                    ? 'rgba(96, 165, 250, 0.18)'
                                    : '#1d2636',
                                  color: '#f5f7fb',
                                  borderRadius: 999,
                                  minWidth: 38,
                                  height: 32,
                                  cursor: 'pointer',
                                  fontSize: 18,
                                }}
                                title={`Reagir com ${emoji}`}
                              >
                                {emoji}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {isMine && !isDeletedForEveryone && (
                        <button
                          onClick={() => startEditingMessage(msg)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            color: '#f5f7fb',
                            padding: '8px 10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          Editar mensagem
                        </button>
                      )}
                      <button
                        onClick={() => deleteMessage(String(msg.id), 'self')}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          color: '#f5f7fb',
                          padding: '8px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        Apagar para mim
                      </button>
                      {isMine && !isDeletedForEveryone && (
                        <button
                          onClick={() => deleteMessage(String(msg.id), 'everyone')}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            color: '#fda4af',
                            padding: '8px 10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          Apagar para todos
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  data-chat-menu-toggle
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    setActiveMenuMessageId((current) =>
                      current === String(msg.id) ? null : String(msg.id),
                    )
                  }
                  style={{
                    alignSelf: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid #2d3748',
                    background: '#121826',
                    color: '#9aa4b2',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Mais opcoes da mensagem"
                  title="Mais opcoes"
                >
                  ⋯
                </button>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '12px 16px 16px',
          borderTop: '1px solid #2d3748',
          background: '#121826',
        }}
      >
        {editingMessageId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#0f1724',
              border: '1px solid #2d3748',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#cbd5e1' }}>Editando mensagem</span>
            <button
              onClick={cancelEditingMessage}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#60a5fa',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
              }}
            >
              Cancelar
            </button>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative' }}>
            {isEmojiPickerOpen && (
              <div
                data-chat-emoji-root
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0,
                  width: 220,
                  background: '#121826',
                  border: '1px solid #2d3748',
                  borderRadius: 12,
                  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
                  padding: 10,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 8,
                }}
              >
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => appendEmoji(emoji)}
                    style={{
                      border: 'none',
                      background: '#1d2636',
                      borderRadius: 10,
                      height: 36,
                      cursor: 'pointer',
                      fontSize: 20,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              data-chat-emoji-toggle
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setIsEmojiPickerOpen((current) => !current)}
              disabled={isComposerDisabled}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid #2d3748',
                background: '#0f1724',
                color: '#f5f7fb',
                cursor: isComposerDisabled ? 'not-allowed' : 'pointer',
                opacity: isComposerDisabled ? 0.5 : 1,
                fontSize: 20,
                flexShrink: 0,
              }}
              aria-label="Abrir emojis"
              title="Emojis"
            >
              🙂
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => sendTypingState(false)}
            placeholder={
              editingMessageId
                ? 'Edite a mensagem... (Enter para salvar)'
                : 'Digite uma mensagem... (Enter para enviar)'
            }
            rows={1}
            disabled={isComposerDisabled}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              maxHeight: 120,
              padding: '10px 14px',
              fontSize: 13,
              border: '1px solid #2d3748',
              borderRadius: 24,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              background: '#0f1724',
              color: '#f5f7fb',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isSendDisabled}
            style={{
              height: 44,
              minWidth: 92,
              padding: '0 18px',
              background: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: 24,
              fontSize: 15,
              cursor: isSendDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              opacity: isSendDisabled ? 0.5 : 1,
            }}
          >
            {editingMessageId ? 'Salvar' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
