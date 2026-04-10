import { useEffect, useState } from 'react'
import normalizeClient from './normalizeClient'
import useReconnect from './useReconnect'
import config from '@/config'

export default function useGptSocket(
    socketRef: React.RefObject<WebSocket | null>,
    onMessage: (message: GptSocketMessage) => void
) {
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const reconnectState = useReconnect(isConnected)

    useEffect(() => {
        const ws = new WebSocket(`${config.url.api_client_wss}/client/ws/gpt`)
        socketRef.current = ws
        ws.onopen = () => { reconnectState.setReconnect(false); setIsConnected(true) }
        ws.onclose = () => { setIsConnected(false); socketRef.current = null }
        ws.onerror = (error) => { console.log('WebSocket error:', error); setIsConnected(false) }
        ws.onmessage = (event) => handleSocketMessage(event.data, onMessage, setClients, setParticipants)
        return () => ws.close()
    }, [onMessage, reconnectState.reconnect, socketRef])

    return { clients, isConnected, participants, socketRef }
}

function handleSocketMessage(
    rawData: string,
    onMessage: (message: GptSocketMessage) => void,
    setClients: React.Dispatch<React.SetStateAction<GPT_Client[]>>,
    setParticipants: React.Dispatch<React.SetStateAction<number>>
) {
    try {
        const msg = JSON.parse(rawData) as GptSocketMessage
        onMessage(msg)
        if (msg.type === 'join') return setParticipants(msg.participants || 0)
        if (msg.type !== 'update' || !msg.client) return
        const normalizedClient = normalizeClient(msg.client)
        setParticipants(msg.participants || 0)
        setClients((prev) => {
            const existing = prev.find(client => client.name === normalizedClient.name)
            return existing
                ? prev.map(client => client.name === normalizedClient.name
                    ? { ...client, ...normalizedClient, model: normalizedClient.model }
                    : client)
                : [...prev, normalizedClient]
        })
    } catch (error) {
        console.error('Invalid message from server:', error)
    }
}
