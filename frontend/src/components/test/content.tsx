'use client'

import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import TestContent from './testContent'
import Notify from '../notify/notify'

type ContentProps = { 
    test: Test
    setTest: Dispatch<SetStateAction<Test>>
    setParticipants: Dispatch<SetStateAction<number>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    showLogs: boolean
    showErrors: boolean
    rerun: boolean
    setRerun: Dispatch<SetStateAction<boolean>>
}

export default function Content({ 
    test, 
    setTest, 
    setParticipants, 
    setIsConnected, 
    showLogs, 
    showErrors, 
    rerun, 
    setRerun 
}: ContentProps) {
    const [reconnect, setReconnect] = useState(false)
    const id = test.id
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_ws}/test/${id}`)

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
            if (rerun) {
                ws.send(JSON.stringify({ type: 'rerun', id }))
            }
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            setError('Connection error')
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.type === 'join') {
                    setParticipants(msg.participants)
                } else if (msg.type === 'update') {
                    if (msg.data.type === 'log') {
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
                        setRerun(false)
                        setTest((prev: Test) => ({
                            ...prev,
                            status: 'done',
                            exit_code: msg.data.code,
                        }))
                    }
                } else {
                    console.log("Unhandled msg.type:", msg.type)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, setTest, reconnect, setIsConnected, setParticipants, rerun, setRerun, setError])

    return (
        <div className="p-2 flex-1 rounded-lg outline-1 outline-dark max-w-full overflow-hidden space-y-4">
            <TestContent test={test} showLogs={showLogs} showErrors={showErrors} />
            <Notify message={error} />
        </div>
    )
}
