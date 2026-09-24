'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'

export default function DatabaseConnection() {
    const [status, setStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking')
    const [checked, setChecked] = useState<number | null>(null)
    const [now, setNow] = useState(0)
    useEffect(() => {
        let pending = false
        const controller = new AbortController()
        async function check() {
            if (pending) return
            pending = true
            try {
                const response = await fetch('/api/db/health', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4500)]) })
                const result = await response.json()
                if (!controller.signal.aborted) { setStatus(response.ok && result.ok ? 'connected' : 'unavailable'); setChecked(Date.now()); setNow(Date.now()) }
            } catch { if (!controller.signal.aborted) setStatus('unavailable') } finally { pending = false }
        }
        void check()
        const polling = setInterval(() => void check(), 5000)
        const clock = setInterval(() => setNow(Date.now()), 1000)
        return () => { controller.abort(); clearInterval(polling); clearInterval(clock) }
    }, [])
    const age = checked ? Math.max(0, now - checked) : 0
    return <div className='flex flex-wrap items-center gap-2 text-xs' aria-label='Database connection'>
        <span role='status' className={`inline-flex items-center gap-1.5 ${status === 'connected' && age <= 10000 ? 'text-ui-success' : status === 'checking' ? 'text-ui-muted' : 'text-ui-warning'}`}><Activity aria-hidden className='h-3.5 w-3.5' />{status === 'checking' ? 'Checking…' : status === 'connected' && age <= 10000 ? 'Connected' : 'Unavailable'}</span>
        {checked && age > 5000 && <span className='text-ui-muted'>Checked {Math.floor(age / 1000)}s ago</span>}
    </div>
}
