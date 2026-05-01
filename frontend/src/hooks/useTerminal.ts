import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TerminalProps = {
    share: Share | null
    open: boolean
}

export default function useTerminal({ share, open }: TerminalProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [chunks, setChunks] = useState<string[]>([])
    const wsRef = useRef<WebSocket | null>(null)
    const queuedMessagesRef = useRef<string[]>([])
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastResizeRef = useRef<{ cols: number; rows: number } | null>(null)
    const shareId = share && 'id' in share ? share.id : null
    const shareAlias = share?.alias || null
    const sessionKey = open && shareId && shareAlias ? `${shareId}:${shareAlias}` : null
    const activeSessionRef = useRef<string | null>(sessionKey)

    useEffect(() => {
        activeSessionRef.current = sessionKey
    }, [sessionKey])

    useEffect(() => {
        if (!sessionKey || !shareAlias) {
            return
        }

        queuedMessagesRef.current = []
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

            const session = randomId(6)
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
                            setChunks((prev) => [...prev, msg.content])
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
    }, [sessionKey, shareAlias])

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
    const view = useMemo(() => ({
        isConnected: sessionKey ? isConnected : false,
        participants: sessionKey ? participants : 1,
        chunks: sessionKey ? chunks : [],
    }), [chunks, isConnected, participants, sessionKey])

    return { ...view, sendInput, sendResize }
}
