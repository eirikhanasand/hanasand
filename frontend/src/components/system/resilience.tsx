'use client'

import { useEffect, useState } from 'react'
import { Activity, ArrowRight, CheckCircle2, Database, HardDrive, Server, TriangleAlert } from 'lucide-react'

type Service = { id: string; name: string; activeInstance: string | null; activeSite: string | null; activeEndpoint: string | null; status: string; instances: { id: string; site: string; healthy: boolean }[] }
type Site = { fresh: boolean; compute?: { diskFreeBytes?: number; memoryAvailableBytes?: number; memoryTotalBytes?: number }; database?: { receiverStatus?: string; replayAt?: string } }
type State = { sites?: Record<string, Site>; notificationHealth?: string; dns?: Record<string, { activeSite?: string } | string>;  mode: string; readOnly: boolean; updatedAt?: string; stale?: boolean; services: Service[]; affected?: string[]; database?: { status: string; replica?: boolean; replayAt?: string }; backups?: { status: string; verifiedAt?: string; restoreRequired?: boolean; restoreSlots?: string[] }; notifications?: { title: string; status: string; at: number }[] }

function useResilience() {
    const [state, setState] = useState<State | null>(null)
    useEffect(() => {
        let alive = true
        const controller = new AbortController()
        const refresh = async () => {
            try {
                const response = await fetch('/api/resilience', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) })
                const next = await response.json() as State
                if (alive) setState(next)
            } catch { if (alive) setState({ mode: 'unknown', readOnly: true, services: [] }) }
        }
        void refresh()
        const timer = setInterval(() => { void refresh() }, 15000)
        return () => { alive = false; controller.abort(); clearInterval(timer) }
    }, [])
    return state
}

export function RecoveryBanner() {
    const state = useResilience()
    if (!state || state.mode === 'normal') return null
    const unavailable = state.services.filter(service => service.status === 'unavailable').map(service => service.name)
    return <div role='status' className='border-b border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm'>
        {state.mode === 'unknown' || state.stale ? 'Service status is reconnecting. Some actions may be temporarily unavailable.'
            : state.readOnly ? 'Recovery mode: existing records remain available where replication is healthy. Changes and new processing are paused.'
                : 'Running on a backup server.'}
        {state.services.some(service => service.id === 'intelligence' && service.activeInstance && service.activeInstance !== 'inspur-ti-1') && <span> Threat intelligence is read-only.</span>}
        {unavailable.length > 0 && <span> Currently unavailable: {unavailable.join(', ')}.</span>}
    </div>
}

export default function ResiliencePanel() {
    const state = useResilience()
    const normal = state?.mode === 'normal' && !state.stale
    const card = 'min-w-0 rounded-lg border border-ui-border bg-ui-raised/50 p-3'
    const heading = 'mb-1.5 flex items-center gap-2 text-xs font-semibold text-ui-muted'
    return <section aria-label='Overview' className='min-w-0 space-y-3 rounded-xl border border-ui-border bg-ui-panel p-4 text-ui-text shadow-sm sm:p-5 [overflow-wrap:anywhere]'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='flex items-center gap-2 text-lg font-semibold'><Activity className='h-5 w-5 text-ui-primary' aria-hidden />Overview</h2>
            <div className='flex flex-wrap items-center gap-2 text-xs text-ui-muted' aria-label='Recovery order: Inspur, Inspur Backup, OVHCloud'><span>Inspur</span><ArrowRight className='h-3 w-3' aria-hidden /><span>Inspur Backup</span><ArrowRight className='h-3 w-3' aria-hidden /><span>OVHCloud</span>{state?.updatedAt && <span className='ml-3'>Updated <StatusTime value={state.updatedAt} /></span>}</div>
        </div>
        {!state ? <p>Loading service status…</p> : <>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${normal ? 'border-ui-success/25 bg-ui-success/5 text-ui-success' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'}`} role='status'>
                {normal ? <CheckCircle2 className='h-4 w-4 shrink-0' aria-hidden /> : <TriangleAlert className='h-4 w-4 shrink-0' aria-hidden />}
                <span>{state.mode === 'unknown' || state.stale ? 'Status is reconnecting; availability has not been verified.' : state.readOnly ? 'Database recovery is read-only. Changes are paused.' : normal ? 'Preferred services are available.' : 'Backup services are active.'}</span>
                <span className='ml-auto hidden text-ui-muted sm:inline'>Each service recovers independently</span>
            </div>
            <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden' data-resilience-cards>
                {state.services.map(service => <article key={service.id} className='min-w-0 rounded-lg border border-current/10 p-3'>
                    <h3 className='font-semibold'>{service.name}</h3>
                    <dl className='mt-2 grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm'>
                        <dt className='opacity-70'>Serving from</dt><dd>{service.activeInstance || 'Unavailable'}</dd>
                        <dt className='opacity-70'>Endpoint</dt><dd>{service.activeEndpoint || 'None'}</dd>
                        <dt className='opacity-70'>Instances</dt><dd><InstanceStatus service={service} /></dd>
                    </dl>
                </article>)}
            </div>
            <div className='hidden overflow-x-auto xl:block' data-resilience-table><table className='w-full text-sm text-left'><thead><tr><th className='p-2'>Service</th><th className='p-2'>Serving from</th><th className='p-2'>Endpoint</th><th className='p-2'>Instances</th></tr></thead><tbody>
                {state.services.map(service => <tr key={service.id} className='border-t border-ui-border transition-colors hover:bg-ui-raised/50'><th className='p-2 font-medium'>{service.name}</th><td className='p-2 text-xs font-mono'>{service.activeInstance || 'Unavailable'}</td><td className='p-2 break-all text-xs text-ui-muted'>{service.activeEndpoint || 'None'}</td><td className='p-2'><InstanceStatus service={service} /></td></tr>)}
            </tbody></table></div>
            {state.sites && <div className='grid gap-3 md:grid-cols-2'>{Object.entries(state.sites).map(([name, site]) => <div key={name} className={card}><div className='flex items-center justify-between gap-2'><h3 className={heading}><Server className='h-4 w-4' aria-hidden />{name === 'inspur' ? 'Inspur' : 'OVHCloud'}</h3><span className='text-xs text-ui-muted'>Replication: {site.database?.receiverStatus || 'Not verified'}</span></div>{site.fresh ? <div className='flex flex-wrap gap-x-5 gap-y-1 text-sm'><span><strong className='font-semibold tabular-nums'>{availableGiB(site.compute?.memoryAvailableBytes)}</strong><span className='ml-1 text-xs text-ui-muted'>memory free</span></span><span><strong className='font-semibold tabular-nums'>{availableGiB(site.compute?.diskFreeBytes)}</strong><span className='ml-1 text-xs text-ui-muted'>disk free</span></span></div> : <p className='text-xs text-ui-warning'>Host telemetry is unavailable.</p>}</div>)}</div>}
            <div className='grid gap-3 md:grid-cols-2'>
                <div className={card}><h3 className={heading}><Database className='h-4 w-4' aria-hidden />Database replication</h3><p className={`flex items-center gap-1.5 text-sm ${state.database?.status === 'up' ? 'text-ui-success' : 'text-ui-warning'}`}>{state.database?.status === 'up' ? <CheckCircle2 className='h-4 w-4' aria-hidden /> : <TriangleAlert className='h-4 w-4' aria-hidden />}{state.database?.status || 'Not verified'}{state.database?.replica ? ' · standby' : ''}</p>{state.database?.replayAt && <p className='mt-1 text-xs text-ui-muted'>Last replay: <StatusTime value={state.database.replayAt} /></p>}</div>
                <div className={card}><h3 className={heading}><HardDrive className='h-4 w-4' aria-hidden />Backups and recovery</h3><p className={`flex items-center gap-1.5 text-sm ${state.backups?.status === 'verified' && !state.backups.restoreRequired ? 'text-ui-success' : 'text-ui-warning'}`}>{state.backups?.status === 'verified' && !state.backups.restoreRequired ? <CheckCircle2 className='h-4 w-4' aria-hidden /> : <TriangleAlert className='h-4 w-4' aria-hidden />}{state.backups?.restoreRequired ? `Restore required for ${state.backups.restoreSlots?.map(slot => slot === 'hanasand_ovh_standby' ? 'OVHCloud' : slot === 'hanasand_inspur_standby' ? 'Inspur Backup' : 'Database').join(' and ') || 'the database replica'}.` : state.backups?.status?.replaceAll('_', ' ') || 'Not verified'}</p>{state.backups?.verifiedAt && <p className='mt-1 text-xs text-ui-muted'>Last backup verified: <StatusTime value={state.backups.verifiedAt} /></p>}</div>
            </div>
        </>}
    </section>
}

function InstanceStatus({ service }: { service: Service }) {
    return <div className='flex flex-wrap gap-1.5'>{service.instances.map(instance => <span key={instance.id} title={`${instance.id}: ${instance.healthy ? 'ready' : 'unavailable'}${instance.id === service.activeInstance ? ' · serving' : ''}`} className={`inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${instance.id === service.activeInstance ? 'border-ui-primary/35 bg-ui-primary/10' : 'border-ui-border bg-ui-raised/50'}`}>
        {instance.healthy ? <CheckCircle2 className='h-3.5 w-3.5 shrink-0 text-ui-success' aria-hidden /> : <TriangleAlert className='h-3.5 w-3.5 shrink-0 text-ui-warning' aria-hidden />}
        <span>{instance.id}</span><span className='sr-only'>: {instance.healthy ? 'ready' : 'unavailable'}{instance.id === service.activeInstance ? ', serving' : ''}</span>
    </span>)}</div>
}

function availableGiB(bytes?: number) {
    return typeof bytes === 'number' && Number.isFinite(bytes) ? `${Math.round(bytes / 1024 ** 3)} GB` : 'Unknown'
}

function StatusTime({ value }: { value: string }) {
    const date = new Date(value)
    return <time dateTime={value} title={value}>{Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
}
