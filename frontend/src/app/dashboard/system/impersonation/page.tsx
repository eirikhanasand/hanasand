import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import config from '@/config'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

type ImpersonationEvent = {
    id: number
    session_id: string | null
    actor_id: string
    actor_name?: string | null
    target_id: string
    target_name?: string | null
    method: string
    path: string
    ip: string
    user_agent: string
    created_at: string
}

function formatTime(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime())
        ? date.toLocaleString()
        : value
}

export default async function ImpersonationAuditPage() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/impersonation%26expired=true')
    }

    const response = await fetch(`${config.url.api}/impersonation/events`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
        },
        cache: 'no-store',
    }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const events = Array.isArray(payload?.events) ? payload.events as ImpersonationEvent[] : []

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Security'
                title='Impersonation audit'
                description='Recent admin support sessions, route access, and return events.'
            />
            <DashboardPanel className='overflow-hidden'>
                <div className='grid gap-0 divide-y divide-white/8'>
                    {!events.length ? (
                        <p className='p-4 text-sm text-bright/45'>No impersonation activity has been recorded yet.</p>
                    ) : events.map((event) => (
                        <article key={event.id} className='grid gap-2 p-4 md:grid-cols-[1fr_auto] md:items-center'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2 text-sm text-bright/88'>
                                    <strong>{event.actor_name || event.actor_id}</strong>
                                    <span className='text-bright/34'>viewed as</span>
                                    <strong>{event.target_name || event.target_id}</strong>
                                </div>
                                <div className='mt-1 flex flex-wrap gap-2 text-xs text-bright/42'>
                                    <span className='rounded-md bg-white/6 px-2 py-1 font-mono'>{event.method || 'GET'}</span>
                                    <span className='min-w-0 break-all rounded-md bg-white/6 px-2 py-1 font-mono'>{event.path}</span>
                                    {event.session_id ? <span className='rounded-md bg-[#f07d33]/10 px-2 py-1 text-[#f07d33]'>session {event.session_id.slice(0, 8)}</span> : null}
                                </div>
                            </div>
                            <div className='text-left text-xs text-bright/42 md:text-right'>
                                <div>{formatTime(event.created_at)}</div>
                                <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                            </div>
                        </article>
                    ))}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}
