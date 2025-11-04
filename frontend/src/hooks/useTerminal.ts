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

    console.log("is inside")

    useEffect(() => {
        console.log("before", share, share?.id)
        if (!share || !('id' in share)) return

        console.log("after", share, share.id)
        console.log('attempting to get shell')
        const session = randomId(6)
        const ws = new WebSocket(`${config.url.cdn_ws}/share/ws/${share.id}/shell/${session}`)

        ws.onopen = () => {
            console.log("connection opened")
            setReconnect(false)
            setIsConnected(true)
        }

        ws.onclose = () => {
            console.log("connection closed")
            setIsConnected(false)
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

                console.log('Raw message:', data)
                const msg = JSON.parse(data)

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
