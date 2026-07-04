import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'

export type SharePresenceUser = {
    clientId: string
    userId: string
    displayName: string
    color: string
    cursorLine: number | null
    cursorColumn: number | null
    selectionLength: number
    editing: boolean
    updatedAt: string
}

export type ShareConflict = {
    remoteContent: string
    localContent: string
    author: SharePresenceUser | null
    timestamp: string
}

type UseShareCodeSocketProps = {
    id: string
    share: Share | null
    editingContent: string
    setEditingContent: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    setParticipants: Dispatch<SetStateAction<number>>
    setShare: Dispatch<SetStateAction<Share | null>>
    setPresenceUsers: Dispatch<SetStateAction<SharePresenceUser[]>>
    setSelfClientId: Dispatch<SetStateAction<string | null>>
    setRemoteNotice: Dispatch<SetStateAction<string | null>>
    setConflict: Dispatch<SetStateAction<ShareConflict | null>>
    onSaveStateChange?: (state: 'saved' | 'saving' | 'queued') => void
    saveState: 'saved' | 'saving' | 'queued'
    enabled?: boolean
}

export function useShareCodeSocket({
    id,
    share,
    editingContent,
    setEditingContent,
    setError,
    setIsConnected,
    setParticipants,
    setShare,
    setPresenceUsers,
    setSelfClientId,
    setRemoteNotice,
    setConflict,
    onSaveStateChange,
    saveState,
    enabled = true,
}: UseShareCodeSocketProps) {
    const [reconnect, setReconnect] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const latestContentRef = useRef(editingContent)
    const saveStateRef = useRef(saveState)
    const presenceUsersRef = useRef<SharePresenceUser[]>([])
    const pendingEditRef = useRef<string | null>(null)
    const selfClientIdRef = useRef<string | null>(null)
    const shareId = share?.id

    useEffect(() => {
        latestContentRef.current = editingContent
    }, [editingContent])

    useEffect(() => {
        saveStateRef.current = saveState
    }, [saveState])

    useEffect(() => {
        if (!enabled) {
            return
        }

        if (share) {
            setError(null)
            return
        }

        async function fetchShareState() {
            try {
                const userId = getCookie('id') ?? undefined
                const token = getCookie('access_token') ?? undefined
                const data = await getShare({ id, token, userId })
                if (typeof data === 'string') {
                    setError(data)
                    return
                }

                setError(null)
                setShare(data)
                setEditingContent(data.content)
            } catch (error) {
                console.error(`Error fetching share: ${error}`)
                setError('Failed to load share')
            }
        }

        fetchShareState()
    }, [enabled, id, setEditingContent, setError, setShare, share])

    useEffect(() => {
        if (!enabled || !shareId) {
            return
        }

        const ws = new WebSocket(`${config.url.cdn_wss}/share/${shareId}`)
        wsRef.current = ws

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
            const clientId = getClientId()
            selfClientIdRef.current = clientId
            setSelfClientId(clientId)
            const userId = getCookie('id') || 'guest'
            ws.send(JSON.stringify({
                type: 'hello',
                clientId,
                userId,
                displayName: displayNameFor(userId),
            }))

            if (pendingEditRef.current !== null) {
                ws.send(JSON.stringify({
                    type: 'edit',
                    id: shareId,
                    content: pendingEditRef.current,
                }))
                pendingEditRef.current = null
                onSaveStateChange?.('saved')
            }
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            setIsConnected(false)
        }

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                if (message.type === 'update' && message.content !== latestContentRef.current) {
                    setParticipants(message.participants)
                    const author = findPresenceUser(message.clientId)
                    if (saveStateRef.current !== 'saved') {
                        setConflict({
                            remoteContent: message.content,
                            localContent: latestContentRef.current,
                            author,
                            timestamp: message.timestamp || new Date().toISOString(),
                        })
                        setRemoteNotice(`${author?.displayName || 'Someone'} changed this file while your edit is unsaved.`)
                        return
                    }

                    latestContentRef.current = message.content
                    setEditingContent(message.content)
                    setShare((prev) => prev ? { ...prev, timestamp: message.timestamp } : prev)
                    setRemoteNotice(`${author?.displayName || 'Someone'} updated this file.`)
                }

                if (message.type === 'join') {
                    setParticipants(message.participants)
                    const users = normalizePresenceUsers(message.users)
                    presenceUsersRef.current = users
                    setPresenceUsers(users)
                }

                if (message.type === 'presence' && message.user) {
                    setPresenceUsers(prev => {
                        const users = mergePresence(prev, normalizePresenceUser(message.user))
                        presenceUsersRef.current = users
                        return users
                    })
                }

                if (message.type === 'ack') {
                    onSaveStateChange?.('saved')
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [enabled, onSaveStateChange, reconnect, setConflict, setEditingContent, setIsConnected, setParticipants, setPresenceUsers, setRemoteNotice, setSelfClientId, setShare, shareId])

    function sendEdit(content: string) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            pendingEditRef.current = content
            setReconnect(true)
            onSaveStateChange?.('queued')
            return 'queued'
        }

        wsRef.current.send(JSON.stringify({
            type: 'edit',
            id: shareId,
            content,
        }))
        pendingEditRef.current = null
        return 'sent'
    }

    function sendCursor(selectionStart: number, selectionEnd: number, content: string) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return
        }

        const { line, column } = getCursorPosition(content, selectionStart)
        wsRef.current.send(JSON.stringify({
            type: 'cursor',
            line,
            column,
            selectionLength: Math.max(selectionEnd - selectionStart, 0),
            editing: true,
        }))
    }

    function sendEditing(editing: boolean) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return
        }

        wsRef.current.send(JSON.stringify({ type: 'editing', editing }))
    }

    function findPresenceUser(clientId: string | null | undefined) {
        return presenceUsersRef.current.find(user => user.clientId === clientId) || null
    }

    return { sendEdit, sendCursor, sendEditing, selfClientId: selfClientIdRef.current }
}

function getClientId() {
    const key = 'hanasand.share.clientId'
    let clientId = window.sessionStorage.getItem(key)
    if (!clientId) {
        clientId = crypto.randomUUID()
        window.sessionStorage.setItem(key, clientId)
    }

    return clientId
}

function displayNameFor(userId: string) {
    if (!userId || userId === 'guest') return 'Guest'
    return userId.split(/[-_.\s]+/).filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ')
}

function normalizePresenceUsers(users: unknown): SharePresenceUser[] {
    if (!Array.isArray(users)) return []
    return users.map(normalizePresenceUser).filter(Boolean) as SharePresenceUser[]
}

function normalizePresenceUser(user: unknown): SharePresenceUser | null {
    if (!user || typeof user !== 'object') return null
    const entry = user as Partial<SharePresenceUser>
    if (!entry.clientId) return null
    return {
        clientId: entry.clientId,
        userId: entry.userId || 'guest',
        displayName: entry.displayName || entry.userId || 'Guest',
        color: entry.color || 'var(--ui-primary)',
        cursorLine: typeof entry.cursorLine === 'number' ? entry.cursorLine : null,
        cursorColumn: typeof entry.cursorColumn === 'number' ? entry.cursorColumn : null,
        selectionLength: typeof entry.selectionLength === 'number' ? entry.selectionLength : 0,
        editing: Boolean(entry.editing),
        updatedAt: entry.updatedAt || new Date().toISOString(),
    }
}

function mergePresence(users: SharePresenceUser[], next: SharePresenceUser | null) {
    if (!next) return users
    const existing = users.filter(user => user.clientId !== next.clientId)
    return [...existing, next]
}

function getCursorPosition(content: string, offset: number) {
    const before = content.slice(0, offset)
    const lines = before.split(/\r?\n/)
    return {
        line: lines.length,
        column: lines[lines.length - 1]?.length + 1 || 1,
    }
}
