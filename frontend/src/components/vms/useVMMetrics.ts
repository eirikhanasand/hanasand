import { useCallback, useEffect, useRef, useState } from 'react'

export default function useVMMetrics(vmName: string, initialMetrics: VMMetrics[]) {
    const [metrics, setMetrics] = useState(initialMetrics)
    const [error, setError] = useState('')
    const refreshRef = useRef<() => void>(() => {})
    const refresh = useCallback(() => refreshRef.current(), [])

    useEffect(() => {
        let disposed = false
        let busy = false
        let denied = false
        let failures = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        let controller: AbortController | undefined
        setMetrics(initialMetrics)
        setError('')

        async function load() {
            if (disposed || denied || busy || document.visibilityState === 'hidden') return
            clearTimeout(timer)
            busy = true
            controller = new AbortController()
            const timeout = setTimeout(() => controller?.abort(), 12_000)
            let delay = 10_000
            let retry = true
            try {
                const response = await fetch(`/api/backend/vm/metrics/${encodeURIComponent(vmName)}`, {
                    cache: 'no-store', signal: controller.signal,
                })
                if ([401, 403, 404].includes(response.status)) {
                    if (!disposed) {
                        setMetrics([])
                        setError(response.status === 401 ? 'Your session has expired. Sign in to view metrics.'
                            : response.status === 403 ? 'You do not have permission to view metrics.' : 'This VM is no longer available.')
                    }
                    retry = false
                    denied = true
                    return
                }
                if (!response.ok) throw new Error('Metrics unavailable')
                const next = await response.json() as VMMetrics[]
                if (!Array.isArray(next) || !next.length || next.some(sample => sample.name !== vmName || !Number.isFinite(Date.parse(sample.created_at)))) throw new Error('Incomplete metrics')
                if (!disposed) {
                    setMetrics(next)
                    setError('')
                }
                failures = 0
            } catch {
                delay = Math.min(10_000, 2_000 * 2 ** Math.min(failures++, 4))
            } finally {
                clearTimeout(timeout)
                busy = false
                if (!disposed && retry) timer = setTimeout(() => void load(), delay)
            }
        }

        const resume = () => { void load() }
        refreshRef.current = resume
        resume()
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
    }, [vmName, initialMetrics])

    return { metrics, error, refresh }
}
