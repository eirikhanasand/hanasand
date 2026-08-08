'use client'

import Link from 'next/link'
import { AlertTriangle, BellRing, CheckCircle2, Loader2, Radar } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DwmProductSnapshot } from '@/utils/dwm/product'

type LoadState = { status: 'loading' } | { status: 'ready', snapshot: DwmProductSnapshot } | { status: 'error', message: string }

export default function DwmOverviewPanel() {
    const [state, setState] = useState<LoadState>({ status: 'loading' })

    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/dwm/product', { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                const body = await response.json().catch(() => null) as DwmProductSnapshot | { error?: { message?: string } } | null
                const errorMessage = body && 'error' in body ? body.error?.message : undefined
                if (!response.ok || !body || !('schemaVersion' in body)) throw new Error(errorMessage || 'Tenant monitoring is unavailable.')
                setState({ status: 'ready', snapshot: body })
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setState({ status: 'error', message: error instanceof Error ? error.message : 'Tenant monitoring is unavailable.' })
            })
        return () => controller.abort()
    }, [])

    if (state.status === 'loading') return <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' aria-label='Organization monitoring'><div className='flex items-center gap-2 text-sm text-ui-muted'><Loader2 className='h-4 w-4 animate-spin text-ui-primary' />Loading organization monitoring…</div></section>
    if (state.status === 'error') return <section className='rounded-lg border border-ui-warning/40 bg-ui-panel p-4 shadow-sm' aria-label='Organization monitoring'><div className='flex items-center gap-2 text-sm font-semibold text-ui-text'><AlertTriangle className='h-4 w-4 text-ui-warning' />Organization monitoring needs review</div><p className='mt-2 text-sm text-ui-muted'>{state.message}</p><Link href='/dashboard/dwm' className='mt-3 inline-flex text-sm font-semibold text-ui-primary hover:underline'>Open DWM</Link></section>

    const { snapshot } = state
    const healthySources = snapshot.sourceCoverage.filter(source => source.health === 'healthy').length
    const hasWatchlist = snapshot.watchlist.length > 0
    const hasAlerts = snapshot.alerts.length > 0
    const readiness = snapshot.readiness.decision === 'production_ready_with_live_sources' ? 'Monitoring ready' : hasWatchlist ? 'Monitoring setup needs review' : 'Add a watchlist to start'
    const readinessTone = snapshot.readiness.decision === 'production_ready_with_live_sources' ? 'text-ui-success' : 'text-ui-warning'

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' aria-label='Organization monitoring'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
                <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary'>Organization monitoring</p>
                <h2 className='mt-1 text-base font-semibold text-ui-text'>Your watchlist and alert state</h2>
                <p className='mt-1 text-sm text-ui-muted'>Tenant-scoped DWM state from the monitoring service, separate from platform traffic telemetry.</p>
            </div>
            <Link href='/dashboard/dwm' className='inline-flex h-9 w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'><Radar className='h-4 w-4 text-ui-primary' />Open DWM</Link>
        </div>
        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
            <Metric icon={<Radar className='h-4 w-4' />} label='Active terms' value={snapshot.watchlist.length} detail={hasWatchlist ? 'shared watchlist terms' : 'none configured'} />
            <Metric icon={<BellRing className='h-4 w-4' />} label='Alerts in scope' value={snapshot.alerts.length} detail={hasAlerts ? 'review in DWM' : 'no retained matches'} />
            <Metric icon={<CheckCircle2 className='h-4 w-4' />} label='Healthy source families' value={`${healthySources}/${snapshot.sourceCoverage.length}`} detail='current source posture' />
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-sm'>
            <span className={`inline-flex items-center gap-2 font-semibold ${readinessTone}`}><span className='h-2 w-2 rounded-full bg-current' />{readiness}</span>
            <span className='text-xs text-ui-muted'>{snapshot.readiness.blockers[0] || snapshot.readiness.nextWorkItem || 'No blocking setup item reported.'}</span>
        </div>
    </section>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode, label: string, value: number | string, detail: string }) {
    return <div className='rounded-md border border-ui-border bg-ui-canvas p-3'><div className='flex items-center justify-between gap-2 text-ui-muted'><span className='text-xs font-semibold uppercase tracking-[0.08em]'>{label}</span>{icon}</div><p className='mt-2 text-2xl font-semibold text-ui-text'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></div>
}
