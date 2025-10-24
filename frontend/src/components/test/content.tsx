'use client'

import config from '@/config'
import ClearStateAfter from '@/hooks/clearStateAfter'
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import TestContent from './testContent'

type ContentProps = { 
    test: Test
    setParticipants: Dispatch<SetStateAction<number>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    showLogs: boolean
    showErrors: boolean
}

export default function Content({ test, setParticipants, setIsConnected, showLogs, showErrors }: ContentProps) {
    const [error, setError] = useState<string | null>(null)
    const [reconnect, setReconnect] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    ClearStateAfter({ condition: error, set: setError })

    useEffect(() => {
        if (!test.id) return

        const ws = new WebSocket(`${config.url.api_ws}/test/ws/${test.id}`)
        wsRef.current = ws

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
            setError('Connection error')
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
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
    }, [test.id, reconnect, setIsConnected, setParticipants])

    return (
        <div className="p-2 flex-1 rounded-lg outline-1 outline-dark max-w-full space-y-4">
            <TestContent test={test} showLogs={showLogs} showErrors={showErrors} />
        </div>
    )
}
