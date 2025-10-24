'use client'

import config from '@/config'
import ClearStateAfter from '@/hooks/clearStateAfter'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import TestContent from './testContent'

type ContentProps = { 
    test: Test
    setTest: Dispatch<SetStateAction<Test>>
    setParticipants: Dispatch<SetStateAction<number>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    showLogs: boolean
    showErrors: boolean
}

export default function Content({ test, setTest, setParticipants, setIsConnected, showLogs, showErrors }: ContentProps) {
    const [error, setError] = useState<string | null>(null)
    const [reconnect, setReconnect] = useState(false)
    ClearStateAfter({ condition: error, set: setError })

    useEffect(() => {
        if (!test.id) return

        const ws = new WebSocket(`${config.url.api_ws}/test/ws/${test.id}`)

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
                } else if (msg.type === 'update') {
                    if (msg.data.type === 'log') {
                        console.log("inside", test)
                        setTest((prev: Test) => ({
                            ...prev,
                            logs: [...(prev.logs || []), msg.data.message],
                        }))
                    } else if (msg.data.type === 'error') {
                        setTest((prev: Test) => ({
                            ...prev,
                            errors: [...(prev.errors || []), msg.data.message],
                        }))
                    } else if (msg.data.type === 'done') {
                        setTest((prev: Test) => ({
                            ...prev,
                            status: 'done',
                            exit_code: msg.data.code,
                        }))
                    }
                } else {
                    console.log("Unhandled msg.type:", msg.type)
                }
            } catch (err) {
                console.error('Invalid message from server:', err)
            }
        }

        return () => {
            ws.close()
        }
    }, [test, setTest, reconnect, setIsConnected, setParticipants])

    return (
        <div className="p-2 flex-1 rounded-lg outline-1 outline-dark max-w-full overflow-hidden space-y-4">
            <TestContent test={test} showLogs={showLogs} showErrors={showErrors} />
        </div>
    )
}
