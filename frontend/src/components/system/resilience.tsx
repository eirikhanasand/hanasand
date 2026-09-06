'use client'

import { useEffect, useState } from 'react'

type Service = { id: string; name: string; activeInstance: string | null; activeSite: string | null; activeEndpoint: string | null; status: string; instances: { id: string; site: string; healthy: boolean }[] }
type State = { mode: string; readOnly: boolean; updatedAt?: string; stale?: boolean; services: Service[]; affected?: string[]; database?: { status: string; replica?: boolean; replayAt?: string }; backups?: { status: string; verifiedAt?: string; restoreRequired?: boolean }; notifications?: { title: string; status: string; at: number }[] }

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
                : 'A backup service is handling requests while the preferred service recovers.'}
        {unavailable.length > 0 && <span> Currently unavailable: {unavailable.join(', ')}.</span>}
    </div>
}

export default function ResiliencePanel() {
    const state = useResilience()
    return <section aria-label='Service resilience' className='rounded-xl border border-current/10 p-5 space-y-4'>
        <div><h2 className='text-lg font-semibold'>Service resilience</h2><p className='text-sm opacity-70'>Inspur preferred → Inspur alternate → OVHcloud. Each service recovers independently.</p></div>
        {!state ? <p>Loading service status…</p> : <>
            <p role='status'>{state.mode === 'normal' ? 'Preferred services are available.' : state.mode === 'unknown' || state.stale ? 'Status is reconnecting; availability has not been verified.' : state.readOnly ? 'Database recovery is read-only. Changes are paused.' : 'Backup services are active.'}</p>
            <div className='overflow-x-auto'><table className='w-full text-sm text-left'><thead><tr><th className='p-2'>Service</th><th className='p-2'>Serving from</th><th className='p-2'>Endpoint</th><th className='p-2'>Instances</th></tr></thead><tbody>
                {state.services.map(service => <tr key={service.id} className='border-t border-current/10'><th className='p-2 font-medium'>{service.name}</th><td className='p-2'>{service.activeInstance || 'Unavailable'}</td><td className='p-2 break-all'>{service.activeEndpoint || 'None'}</td><td className='p-2'>{service.instances.map(instance => `${instance.id}: ${instance.healthy ? 'ready' : 'unavailable'}`).join(' · ')}</td></tr>)}
            </tbody></table></div>
            <div className='grid gap-4 md:grid-cols-3'>
                <div><h3 className='font-medium'>Database replication</h3><p className='text-sm'>{state.database?.status || 'Not verified'}{state.database?.replica ? ' · standby' : ''}</p>{state.database?.replayAt && <p className='text-xs opacity-70'>Last replay: {state.database.replayAt}</p>}</div>
                <div><h3 className='font-medium'>Backups and recovery</h3><p className='text-sm'>{state.backups?.restoreRequired ? 'A database restore is required.' : state.backups?.status?.replaceAll('_', ' ') || 'Not verified'}</p>{state.backups?.verifiedAt && <p className='text-xs opacity-70'>Verified: {state.backups.verifiedAt}</p>}</div>
                <div><h3 className='font-medium'>Security and capacity</h3><p className='text-sm'>One writable database. Promotion requires fencing the old primary. OVHcloud reserves capacity for core services; heavy AI processing stays on Inspur.</p></div>
            </div>
            <div><h3 className='font-medium'>Recent recovery notifications</h3>{state.notifications?.length ? <ul className='text-sm'>{state.notifications.slice(-5).reverse().map((notification, index) => <li key={index}>{notification.title} — {notification.status}</li>)}</ul> : <p className='text-sm opacity-70'>No delivery has been recorded yet.</p>}</div>
            {state.updatedAt && <p className='text-xs opacity-60'>Updated {state.updatedAt}</p>}
        </>}
    </section>
}
