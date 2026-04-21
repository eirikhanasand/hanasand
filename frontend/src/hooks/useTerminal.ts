import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { useEffect, useRef, useState } from 'react'

type TerminalProps = {
    share: Share | null
    open: boolean
}

export default function useTerminal({ share, open }: TerminalProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [log, setLog] = useState<Log[]>([])
    const wsRef = useRef<WebSocket | null>(null)
    const queuedMessagesRef = useRef<string[]>([])
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!open || !share || !('id' in share) || !share.alias) {
            setIsConnected(false)
            return
        }

        setLog([])
        setParticipants(1)
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

            const shareAlias = share?.alias
            if (!shareAlias) {
                setIsConnected(false)
                return
            }

            const session = randomId(6)
            const userCookie = getCookie('id')
            const terminalUser = userCookie || 'default'
            const ws = new WebSocket(`${config.url.cdn_wss}/share/${shareAlias}/shell/${terminalUser}/${session}`)
            wsRef.current = ws

            ws.onopen = () => {
                clearReconnect()
                setIsConnected(true)
                flushQueue(ws)
            }

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null
                }

                setIsConnected(false)
                if (!disposed) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect()
                    }, 1000)
                }
            }

            ws.onerror = (error) => {
                console.log('WebSocket error:', error)
                setIsConnected(false)
            }

            ws.onmessage = async (event) => {
                try {
                    let data = event.data

                    if (data instanceof Blob) {
                        data = await data.text()
                    }

                    const msg = JSON.parse(data)

                    if (msg.type === 'update') {
                        setParticipants(msg.participants || 1)
                        setLog((prev) => [...prev, {
                            content: msg.content,
                            timestamp: msg.timestamp || new Date().toISOString(),
                            type: msg.content?.includes('"type":"stderr"') ? 'stderr' : 'stdout'
                        }])
                    }

                    if (msg.type === 'join') {
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
            setIsConnected(false)
            queuedMessagesRef.current = []

            if (wsRef.current) {
                const current = wsRef.current
                wsRef.current = null
                current.close()
            }
        }
    }, [open, share?.alias, share?.id])

    function sendMessage(message: string) {
        if (!open || !share || !('id' in share)) {
            return { status: false, message: 'Terminal is closed' }
        }

        const payload = JSON.stringify({
            type: 'terminalMessage',
            content: message
        })

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(payload)
            return { status: true }
        }

        queuedMessagesRef.current.push(payload)
        return { status: true }
    }

    return { isConnected, participants, log, sendMessage }
}
