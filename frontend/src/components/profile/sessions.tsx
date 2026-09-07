'use client'

import { AuthSession, fetchSessions, revokeOtherSessions, revokeSession } from '@/utils/auth/sessions'
import { sessionDevice } from '@/utils/auth/sessionDevice'
import { DashboardPanel } from '@/components/dashboard/ui'
import { Laptop, LogOut, Server, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function SessionsPanel({ isSelf }: { isSelf: boolean }) {
    const [sessions, setSessions] = useState<AuthSession[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function refresh() {
        setLoading(true)
        try {
            setSessions(await fetchSessions())
            setError('')
        } catch {
            setError('Unable to load sessions. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    async function revoke(tokenId?: number) {
        setBusy(true)
        try {
            const success = tokenId === undefined ? await revokeOtherSessions() : await revokeSession(tokenId)
            if (!success) {
                setError('Unable to log out the selected sessions. Please try again.')
                return
            }
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        if (isSelf) void refresh()
    }, [isSelf])

    if (!isSelf) return null

    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Login sessions</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{loading ? 'Loading sessions…' : error ? 'Session count unavailable' : `${sessions.length} active session${sessions.length === 1 ? '' : 's'}`}</p>
                </div>
                <button disabled={loading || busy || !sessions.some(session => !session.current)} onClick={() => revoke()} className='h-9 cursor-pointer rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised disabled:cursor-default disabled:opacity-50'>
                    Log out others
                </button>
            </div>
            <p className='mt-2 text-xs text-ui-muted'>Each session is a sign-in. Multiple sessions can belong to the same device.</p>
            {error && <p role='alert' className='mt-3 text-sm text-ui-danger'>{error} <button onClick={refresh} className='cursor-pointer underline'>Retry</button></p>}
            <div className='mt-4 grid gap-2'>
                {sessions.map(session => {
                    const device = sessionDevice(session.user_agent, Boolean(session.ip))
                    const Icon = device.kind === 'mobile' ? Smartphone : device.kind === 'api' ? Server : Laptop
                    const location = [...new Set([session.network?.city, session.network?.region, session.network?.country].filter(Boolean))].join(', ')
                    return (
                        <div key={session.token_id} className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'>
                            <Icon className='h-4 w-4 text-ui-muted' />
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h3 className='text-sm font-semibold text-ui-text'>{device.label}</h3>
                                    <span className='rounded-md bg-ui-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-ui-success'>{session.current ? 'This session' : 'Active'}</span>
                                </div>
                                <p className='mt-1 break-words text-xs text-ui-muted'>{session.ip ? `Public IP ${session.ip}` : 'Public IP was not captured for this login'}</p>
                                <p className='mt-1 text-xs text-ui-muted'>ISP / network: {session.network?.provider || 'Unavailable'}</p>
                                <p className='mt-1 text-xs text-ui-muted'>Approximate location: {location || 'Unavailable'}</p>
                                <p className='mt-1 text-xs text-ui-muted'>Signed in {formatDate(session.created_at)} · Last active {formatDate(session.last_seen_at)}</p>
                            </div>
                            <button disabled={busy} onClick={() => revoke(session.token_id)} aria-label={`Revoke ${device.label} session`} className='h-8 cursor-pointer rounded-lg border border-ui-danger/40 bg-ui-danger/10 px-3 text-xs font-semibold text-ui-danger hover:bg-ui-danger/15 disabled:opacity-50'>
                                <LogOut className='mr-2 inline h-4 w-4' />Revoke
                            </button>
                        </div>
                    )
                })}
                {!loading && !error && !sessions.length && <p className='text-sm text-ui-muted'>No active sessions.</p>}
            </div>
            <p className='mt-3 text-xs text-ui-muted'>IP locations are approximate and may reflect a VPN or your provider’s network. <a href='https://db-ip.com' target='_blank' rel='noreferrer' className='underline'>IP Geolocation by DB-IP</a></p>
        </DashboardPanel>
    )
}
