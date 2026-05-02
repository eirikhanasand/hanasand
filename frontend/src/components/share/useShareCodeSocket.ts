import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'

type UseShareCodeSocketProps = {
    id: string
    share: Share | null
    editingContent: string
    setEditingContent: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    setParticipants: Dispatch<SetStateAction<number>>
    setShare: Dispatch<SetStateAction<Share | null>>
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
    enabled = true,
}: UseShareCodeSocketProps) {
    const [reconnect, setReconnect] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const latestContentRef = useRef(editingContent)
    const pendingEditRef = useRef<string | null>(null)
    const shareId = share?.id

    useEffect(() => {
        latestContentRef.current = editingContent
    }, [editingContent])

    useEffect(() => {
        if (!enabled) {
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
    }, [enabled, id, setEditingContent, setError, setShare])

    useEffect(() => {
        if (!enabled || !shareId) {
            return
        }

        const ws = new WebSocket(`${config.url.cdn_wss}/share/${shareId}`)
        wsRef.current = ws

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)

            if (pendingEditRef.current !== null) {
                ws.send(JSON.stringify({
                    type: 'edit',
                    id: shareId,
                    content: pendingEditRef.current,
                }))
                pendingEditRef.current = null
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
                    latestContentRef.current = message.content
                    setEditingContent(message.content)
                    setShare((prev) => prev ? { ...prev, timestamp: message.timestamp } : prev)
                }

                if (message.type === 'join') {
                    setParticipants(message.participants)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [enabled, reconnect, setEditingContent, setIsConnected, setParticipants, setShare, shareId])

    function sendEdit(content: string) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            pendingEditRef.current = content
            setReconnect(true)
            return
        }

        wsRef.current.send(JSON.stringify({
            type: 'edit',
            id: shareId,
            content,
        }))
        pendingEditRef.current = null
    }

    return { sendEdit }
}
