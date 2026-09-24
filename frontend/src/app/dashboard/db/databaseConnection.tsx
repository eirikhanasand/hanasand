'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

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
    return <DashboardPanel className='min-w-0 p-4'>
        <div className='flex items-center gap-2 text-sm text-ui-muted'><Activity aria-hidden className='h-4 w-4 text-ui-primary' />Connection</div>
        <p role='status' className={`mt-3 text-xl font-semibold ${status === 'connected' && age <= 10000 ? 'text-ui-success' : status === 'checking' ? 'text-ui-muted' : 'text-ui-warning'}`}>{status === 'checking' ? 'Checking…' : status === 'connected' && age <= 10000 ? 'Connected' : 'Unavailable'}</p>
        {checked && age > 5000 && <p className='mt-2 text-xs text-ui-muted'>Checked {Math.floor(age / 1000)}s ago</p>}
    </DashboardPanel>
}
