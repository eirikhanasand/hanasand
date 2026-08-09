'use client'

import { useEffect, useState } from 'react'
import type { WebScanReport } from '@/utils/monitoring/types'

export default function WebScanPanel({ initialData, refreshAction, runAction }: { initialData: WebScanReport, refreshAction: () => Promise<WebScanReport>, runAction: () => Promise<{ message: string, status: WebScanReport }> }) {
    const [data, setData] = useState(initialData)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    useEffect(() => {
        if (!data.running) return
        const timer = setInterval(() => { void refreshAction().then(setData) }, 2500)
        return () => clearInterval(timer)
    }, [data.running, refreshAction])
    const checks = data.targets.flatMap(target => target.checks)
    const openPorts = data.targets.flatMap(target => target.ports.filter(port => port.open))
    async function run() {
        setBusy(true); setMessage('')
        try { const result = await runAction(); setData(result.status); setMessage(result.message) } catch (error) { setMessage(error instanceof Error ? error.message : 'Scan could not start.') } finally { setBusy(false) }
    }
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase text-ui-primary'>Approved target validation</p><h2 className='mt-1 text-lg font-semibold'>Hanasand safe web scan</h2><p className='mt-1 max-w-2xl text-sm text-ui-muted'>Checks Hanasand-owned HTTPS targets, security controls, and a small approved port set. Requests carry a scanner identifier so Security Monitoring can recognize the activity.</p></div><button type='button' onClick={() => void run()} disabled={busy || data.running} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{data.running ? 'Scanning…' : 'Run safe scan'}</button></div>
        {message && <p className='mt-3 text-xs text-ui-muted'>{message}</p>}
        <div className='mt-4 grid gap-3 sm:grid-cols-3'><Metric label='Targets' value={String(data.targets.length)} /><Metric label='Checks' value={String(checks.length)} /><Metric label='Open ports' value={String(openPorts.length)} /></div>
        {data.targets.map(target => <div key={target.target} className='mt-4 rounded-md border border-ui-border bg-ui-raised p-3'><div className='flex flex-wrap justify-between gap-2 text-sm'><span className='font-semibold'>{target.target}</span><span className='text-ui-muted'>HTTP {target.status}</span></div><div className='mt-2 grid gap-1 text-xs text-ui-muted'>{target.checks.map(check => <div key={check.id} className='flex justify-between gap-3'><span>{check.title}</span><span className={check.status === 'fail' ? 'text-red-300' : check.status === 'pass' ? 'text-emerald-300' : 'text-amber-300'}>{check.status}</span></div>)}</div></div>)}
    </section>
}

function Metric({ label, value }: { label: string, value: string }) { return <div className='rounded-md border border-ui-border bg-ui-raised p-3'><p className='text-xs uppercase text-ui-muted'>{label}</p><p className='mt-1 text-lg font-semibold'>{value}</p></div> }
