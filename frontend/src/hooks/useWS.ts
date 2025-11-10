import config from '@/config'
import randomId from '@/utils/random/randomId'
import { useEffect, useState } from 'react'

type WSProps<T> = {
    path: string
    initialState: T
    id?: string | null | undefined
    replace?: boolean
}

export default function useWS<T>({ path, initialState, id, replace = false }: WSProps<T>) {
    const [data, setData] = useState(initialState || [] as T)
    const [connected, setConnected] = useState(false)
    const [reconnect, setReconnect] = useState(false)
    const [participants, setParticipants] = useState(1)

    useEffect(() => {
        if (id === null) return

        const pathWithId = path.replaceAll(/{id}/g, randomId()).replaceAll(/:id/g, randomId())
        const ws = new WebSocket(`${config.url.cdn_ws}${pathWithId}`)

        ws.onopen = () => {
            setConnected(true)
            if (data && id) {
                ws.send(JSON.stringify({ data }))
            }
        }

        ws.onclose = () => {
            setConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
        }

        ws.onmessage = async (event) => {
            try {
                let data = event.data

                if (data instanceof Blob) {
                    data = await data.text()
                }

                const msg: { type: string, participants: number, data: T } = JSON.parse(data)

                if (msg.type === 'update') {
                    setParticipants(msg.participants)
                    if (Array.isArray(msg.data) && !replace) {
                        // @ts-expect-error Typescript cant guarantee that prev has a iterator
                        setData((prev: T) => [...prev, ...msg.data])
                    } else {
                        setData(msg.data)
                    }
                }

                if (msg.type === 'join') {
                    setParticipants(msg.participants)
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, reconnect])

    return {
        data,
        setData,
        connected,
        setConnected,
        reconnect,
        setReconnect,
        participants,
        setParticipants
    }
}
