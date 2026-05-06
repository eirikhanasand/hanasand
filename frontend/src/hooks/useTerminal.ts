import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TerminalProps = {
    share: Share | null
    active: boolean
}

export type TerminalCredentials = {
    username: string
    password: string
    sshCommand: string
    domain: string
}

export type TerminalLifecycle = 'closed' | 'connecting' | 'waking' | 'preparing' | 'ready' | 'idle' | 'shutting_down' | 'error'

export default function useTerminal({ share, active }: TerminalProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [chunks, setChunks] = useState<string[]>([])
    const [status, setStatus] = useState('Terminal closed.')
    const [credentials, setCredentials] = useState<TerminalCredentials | null>(null)
    const [lifecycle, setLifecycle] = useState<TerminalLifecycle>('closed')
    const [connectionNonce, setConnectionNonce] = useState(0)
    const wsRef = useRef<WebSocket | null>(null)
    const queuedMessagesRef = useRef<string[]>([])
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastResizeRef = useRef<{ cols: number; rows: number } | null>(null)
    const terminalSessionRef = useRef<string | null>(null)
    const shareId = share && 'id' in share ? share.id : null
    const shareAlias = share?.alias || null
    const sessionKey = active && shareId && shareAlias ? `${shareId}:${shareAlias}` : null
    const activeSessionRef = useRef<string | null>(sessionKey)

    useEffect(() => {
        activeSessionRef.current = sessionKey
    }, [sessionKey])

    useEffect(() => {
        if (!sessionKey || !shareAlias) {
            setStatus('Terminal closed.')
            setLifecycle('closed')
            return
        }

        queuedMessagesRef.current = []
        setCredentials(null)
        terminalSessionRef.current = randomId(6)
        setStatus('Connecting to terminal...')
        setLifecycle('connecting')
        let disposed = false

        function clearReconnect() {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }

        function flushQueue(socket: WebSocket) {
            while (queuedMessagesRef.current.length && socket.readyState === WebSocket.OPEN) {
                const next = queuedMessagesRef.current.shift()
                if (next) {
                    socket.send(next)
                }
            }
        }

        function connect() {
            if (disposed) {
                return
            }

            const session = terminalSessionRef.current || randomId(6)
            terminalSessionRef.current = session
            const userCookie = getCookie('id')
            const terminalUser = userCookie || 'default'
            const ws = new WebSocket(`${config.url.cdn_wss}/share/${shareAlias}/shell/${terminalUser}/${session}`)
            wsRef.current = ws

            ws.onopen = () => {
                clearReconnect()
                if (activeSessionRef.current !== sessionKey) {
                    return
                }
                setChunks([])
                setParticipants(1)
                setIsConnected(true)
                setStatus('Preparing terminal...')
                setLifecycle('preparing')
                flushQueue(ws)
                if (lastResizeRef.current && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'resize',
                        cols: lastResizeRef.current.cols,
                        rows: lastResizeRef.current.rows
                    }))
                }
            }

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null
                }

                if (activeSessionRef.current === sessionKey) {
                    setIsConnected(false)
                    setStatus(disposed ? 'Terminal closed.' : 'Reconnecting terminal...')
                    setLifecycle(disposed ? 'closed' : 'connecting')
                }
                if (!disposed) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect()
                    }, 1000)
                }
            }

            ws.onerror = (error) => {
                console.log('WebSocket error:', error)
                if (activeSessionRef.current === sessionKey) {
                    setIsConnected(false)
                    setStatus('Terminal connection error. Retrying...')
                    setLifecycle('error')
                }
            }

            ws.onmessage = async (event) => {
                try {
                    let data = event.data

                    if (data instanceof Blob) {
                        data = await data.text()
                    }

                    const msg = JSON.parse(data)

                    if (msg.type === 'update') {
                        if (activeSessionRef.current !== sessionKey) {
                            return
                        }
                        setParticipants(msg.participants || 1)
                        if (typeof msg.content === 'string') {
                            const nextStatus = statusFromTerminalUpdate(msg.content)
                            if (nextStatus) {
                                setStatus(nextStatus)
                            }
                            const nextLifecycle = lifecycleFromTerminalUpdate(msg.content)
                            if (nextLifecycle) {
                                setLifecycle(nextLifecycle)
                            }
                            setChunks((prev) => [...prev, msg.content])
                        }
                    }

                    if (msg.type === 'terminal_credentials') {
                        if (activeSessionRef.current !== sessionKey) {
                            return
                        }

                        if (isTerminalCredentials(msg.credentials)) {
                            setCredentials(msg.credentials)
                            setStatus('Terminal ready.')
                            setLifecycle('ready')
                        }
                    }

                    if (msg.type === 'join') {
                        if (activeSessionRef.current !== sessionKey) {
                            return
                        }
                        setParticipants(msg.participants || 1)
                    }
                } catch (error) {
                    console.error(`Invalid message from server: ${error}`)
                }
            }
        }

        connect()

        return () => {
            disposed = true
            clearReconnect()
            queuedMessagesRef.current = []

            if (wsRef.current) {
                const current = wsRef.current
                wsRef.current = null
                current.close()
            }
        }
    }, [connectionNonce, sessionKey, shareAlias])

    const sendInput = useCallback((message: string) => {
        if (!sessionKey) {
            return { status: false, message: 'Terminal is closed' }
        }

        const payload = JSON.stringify({
            type: 'terminalInput',
            content: message
        })

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(payload)
            return { status: true }
        }

        queuedMessagesRef.current.push(payload)
        return { status: true }
    }, [sessionKey])

    const sendResize = useCallback((cols: number, rows: number) => {
        if (!sessionKey) {
            return
        }

        lastResizeRef.current = { cols, rows }
        const payload = JSON.stringify({
            type: 'resize',
            cols,
            rows
        })

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(payload)
            return
        }

        queuedMessagesRef.current.push(payload)
    }, [sessionKey])

    const reconnect = useCallback(() => {
        if (!sessionKey) {
            return
        }

        setStatus('Reconnecting terminal...')
        setLifecycle('connecting')
        queuedMessagesRef.current = []

        if (wsRef.current) {
            wsRef.current.close()
            return
        }

        setConnectionNonce((value) => value + 1)
    }, [sessionKey])

    const restart = useCallback(() => {
        if (!sessionKey) {
            return
        }

        setChunks([])
        setCredentials(null)
        queuedMessagesRef.current = []
        terminalSessionRef.current = randomId(6)
        setStatus('Restarting terminal...')
        setLifecycle('connecting')

        if (wsRef.current) {
            wsRef.current.close()
            return
        }

        setConnectionNonce((value) => value + 1)
    }, [sessionKey])

    const view = useMemo(() => ({
        isConnected: sessionKey ? isConnected : false,
        participants: sessionKey ? participants : 1,
        chunks: sessionKey ? chunks : [],
        status: sessionKey ? status : 'Terminal closed.',
        credentials: sessionKey ? credentials : null,
        lifecycle: sessionKey ? lifecycle : 'closed',
    }), [chunks, credentials, isConnected, lifecycle, participants, sessionKey, status])

    return { ...view, sendInput, sendResize, reconnect, restart }
}

function statusFromTerminalUpdate(raw: string) {
    try {
        const parsed = JSON.parse(raw) as { content?: string, code?: unknown }
        if (parsed.code !== undefined || typeof parsed.content !== 'string') {
            return null
        }

        const cleaned = parsed.content
            .replace(/\r/g, '\n')
            .split('\n')
            .map(line => line.replace(/^\[[+\-✓]\]\s*/, '').trim())
            .filter(Boolean)
            .at(-1)

        return cleaned || null
    } catch {
        const cleaned = raw.trim()
        return cleaned || null
    }
}

function lifecycleFromTerminalUpdate(raw: string): TerminalLifecycle | null {
    const content = terminalContent(raw).toLowerCase()
    if (!content) {
        return null
    }

    if (content.includes('shutting down') || content.includes('shutdown')) {
        return 'shutting_down'
    }

    if (content.includes('idle')) {
        return 'idle'
    }

    if (
        content.includes('vm does not exist')
        || content.includes('starting existing vm')
        || content.includes('waiting for vm agent')
        || content.includes('claiming warm vm')
        || content.includes('opening terminal')
        || content.includes('this may take some time')
    ) {
        return 'waking'
    }

    if (content.includes('preparing ssh access') || content.includes('preparing terminal')) {
        return 'preparing'
    }

    if (content.includes('terminal ready') || content.includes('vm agent is ready')) {
        return 'ready'
    }

    if (content.includes('[!]') || content.includes('error') || content.includes('unable to')) {
        return 'error'
    }

    return null
}

function terminalContent(raw: string) {
    try {
        const parsed = JSON.parse(raw) as { content?: string }
        return typeof parsed.content === 'string' ? parsed.content : ''
    } catch {
        return raw
    }
}

function isTerminalCredentials(value: unknown): value is TerminalCredentials {
    if (!value || typeof value !== 'object') {
        return false
    }

    const candidate = value as Partial<TerminalCredentials>
    return typeof candidate.username === 'string'
        && typeof candidate.password === 'string'
        && typeof candidate.sshCommand === 'string'
        && typeof candidate.domain === 'string'
}
