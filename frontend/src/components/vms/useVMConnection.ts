import { useCallback, useEffect, useRef, useState } from 'react'

export default function useVMConnection(vmName: string, initialConnection: VMConnectionDetails | null) {
    const [connection, setConnection] = useState(initialConnection)
    const [error, setError] = useState('')
    const refreshRef = useRef<() => void>(() => {})
    const refresh = useCallback(() => refreshRef.current(), [])

    useEffect(() => {
        let disposed = false
        let busy = false
        let failures = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        let controller: AbortController | undefined
        setConnection(initialConnection)
        setError('')

        async function load() {
            if (disposed || busy || document.visibilityState === 'hidden') return
            clearTimeout(timer)
            busy = true
            controller = new AbortController()
            const timeout = setTimeout(() => controller?.abort(), 12_000)
            let delay = 30_000
            let retry = true
            try {
                const response = await fetch(`/api/backend/vm/${encodeURIComponent(vmName)}/connection`, {
                    cache: 'no-store', signal: controller.signal,
                })
                if ([401, 403, 404].includes(response.status)) {
                    if (!disposed) {
                        setConnection(null)
                        setError(response.status === 401 ? 'Your session has expired. Sign in to view access details.'
                            : response.status === 403 ? 'You do not have permission to view access details.' : 'This VM is no longer available.')
                    }
                    retry = false
                    return
                }
                if (!response.ok) throw new Error('Access details unavailable')
                const next = await response.json() as VMConnectionDetails
                if (!next || typeof next.username !== 'string' || typeof next.certificateCount !== 'number') throw new Error('Incomplete access details')
                if (!disposed) {
                    setConnection(next)
                    setError('')
                }
                failures = 0
            } catch {
                delay = Math.min(30_000, 2_000 * 2 ** Math.min(failures++, 4))
            } finally {
                clearTimeout(timeout)
                busy = false
                if (!disposed && retry) timer = setTimeout(() => void load(), delay)
            }
        }

        const resume = () => { void load() }
        refreshRef.current = resume
        if (initialConnection) timer = setTimeout(resume, 30_000)
        else resume()
        window.addEventListener('focus', resume)
        window.addEventListener('online', resume)
        document.addEventListener('visibilitychange', resume)
        return () => {
            disposed = true
            clearTimeout(timer)
            controller?.abort()
            window.removeEventListener('focus', resume)
            window.removeEventListener('online', resume)
            document.removeEventListener('visibilitychange', resume)
        }
    }, [vmName, initialConnection])

    return { connection, error, refresh }
}
