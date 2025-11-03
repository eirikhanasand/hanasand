import config from '@/config'
import randomId from '@/utils/random/randomId'
import { useEffect, useRef, useState } from 'react'

type TerminalProps = {
    share: Share | null
}

export default function useTerminal({ share }: TerminalProps) {
    const [reconnect, setReconnect] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [log, setLog] = useState<Log[]>([])
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!share || share.id) return

        const session = randomId(6)
        const ws = new WebSocket(`${config.url.internal_wss}/share/ws/${share.id}/terminal/${session}`)

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
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
                const msg = JSON.parse(event.data)
                if (msg.type === 'update') {
                    setParticipants(msg.participants)
                    setLog((prev) => [...prev, msg])
                }

                if (msg.type === 'join') {
                    setParticipants(msg.participants)
                }
            } catch (err) {
                console.error('Invalid message from server:', err)
            }
        }

        return () => {
            ws.close()
        }
    }, [share, reconnect])

    function sendMessage(message: string) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message))
            return { status: true }
        } else {
            console.warn('WebSocket not connected.')
            return { status: false, message: 'Websocket not connected' }
        }
    }

    return { isConnected, participants, log, sendMessage }
}
