'use client'

import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import TestContent from './testContent'
import ErrorNotice from '../error/errorNotice'

type ContentProps = {
    test: Test
    setTest: Dispatch<SetStateAction<Test>>
    setParticipants: Dispatch<SetStateAction<number>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    showLogs: boolean
    showErrors: boolean
    setRerun: Dispatch<SetStateAction<boolean>>
}

export default function Content({
    test,
    setTest,
    setParticipants,
    setIsConnected,
    showLogs,
    showErrors,
    setRerun
}: ContentProps) {
    const [reconnect, setReconnect] = useState(false)
    const id = test.id
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_wss}/test/${id}`)

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
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
                            summary: msg.data.summary || prev.summary,
                            duration: msg.data.durationMs ? { milliseconds: msg.data.durationMs } : prev.duration,
                        }))
                    }
                } else {
                    console.log('Unhandled msg.type:', msg.type)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, setTest, reconnect, setIsConnected, setParticipants, setRerun, setError])

    return (
        <div className='min-h-[30rem] min-w-0 max-w-full space-y-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] p-3 md:h-full'>
            <TestContent test={test} showLogs={showLogs} showErrors={showErrors} />
            <ErrorNotice compact message={error as string | null} />
        </div>
    )
}
