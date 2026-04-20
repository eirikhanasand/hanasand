import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { useEffect, useRef, useState } from 'react'

type TerminalProps = {
    share: Share | null
}

export default function useTerminal({ share }: TerminalProps) {
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [log, setLog] = useState<Log[]>([])
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!share || !('id' in share)) return

        setLog([])
        setParticipants(1)
        const session = randomId(6)
        const userCookie = getCookie('id')
        const terminalUser = userCookie || 'default'
        const ws = new WebSocket(`${config.url.cdn_wss}/share/${share.alias}/shell/${terminalUser}/${session}`)
        wsRef.current = ws

        ws.onopen = () => {
            setIsConnected(true)
        }

        ws.onclose = () => {
            setIsConnected(false)
            if (wsRef.current === ws) {
                wsRef.current = null
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
                        type: 'stdout'
                    }])
                }

                if (msg.type === 'join') {
                    setParticipants(msg.participants)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            if (wsRef.current === ws) {
                wsRef.current = null
            }
            ws.close()
        }
    }, [share])

    function sendMessage(message: string) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'terminalMessage',
                content: message
            }))
            return { status: true }
        } else {
            console.warn('WebSocket not connected.')
            return { status: false, message: 'Websocket not connected' }
        }
    }

    return { isConnected, participants, log, sendMessage }
}
