import { useEffect, useState } from 'react'

export default function useReconnect(isConnected: boolean) {
    const [reconnect, setReconnect] = useState(false)

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!isConnected) {
                setReconnect(true)
            }
        }, 3000)

        return () => clearTimeout(timeout)
    }, [isConnected])

    return { reconnect, setReconnect }
}
