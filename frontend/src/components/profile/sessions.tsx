'use client'

import { AuthSession, fetchSessions, revokeOtherSessions, revokeSession } from '@/utils/auth/sessions'
import { DashboardPanel } from '@/components/dashboard/ui'
import { Laptop, LogOut, Server, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function deviceLabel(userAgent: string) {
    if (/hanasand[-_\s]?desktop|desktop[-_\s]?app|tauri|electron/i.test(userAgent)) {
        return 'Desktop app'
    }

    if (/hanasand[-_\s]?mobile|mobile[-_\s]?app|reactnative|expo|okhttp|cfnetwork|darwin/i.test(userAgent)) {
        return 'Mobile app'
    }

    if (/mobile|iphone|android/i.test(userAgent)) {
        return 'Mobile browser'
    }

    if (/curl|node|monitor|playwright/i.test(userAgent)) {
        return 'Automation or API client'
    }

    return 'Desktop browser'
}

function deviceIcon(userAgent: string) {
    const label = deviceLabel(userAgent)

    if (label === 'Mobile app' || label === 'Mobile browser') return Smartphone
    if (label === 'Automation or API client') return Server
    return Laptop
}

export default function SessionsPanel({ isSelf }: { isSelf: boolean }) {
    const [sessions, setSessions] = useState<AuthSession[]>([])
    const [loading, setLoading] = useState(false)

    async function refresh() {
        setLoading(true)
        setSessions(await fetchSessions())
        setLoading(false)
    }

    async function revoke(tokenId: number) {
        await revokeSession(tokenId)
        await refresh()
    }

    async function revokeOthers() {
        await revokeOtherSessions()
        await refresh()
    }

    useEffect(() => {
        if (isSelf) {
            void refresh()
        }
    }, [isSelf])

    if (!isSelf) {
        return null
    }

    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-bright'>Devices</h2>
                    <p className='mt-1 text-sm text-bright/40'>{sessions.length || (loading ? 'Loading' : 'No')} active session{sessions.length === 1 ? '' : 's'}</p>
                </div>
                <button onClick={revokeOthers} className='h-9 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-bright/70 hover:bg-white/10'>
                    Log out others
                </button>
            </div>

            <div className='mt-4 grid gap-2'>
                {sessions.map(session => {
                    const isRevoked = Boolean(session.revoked_at)
                    const label = deviceLabel(session.user_agent)
                    const Icon = deviceIcon(session.user_agent)
                    return (
                        <div key={session.token_id} className='grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'>
                            <Icon className='h-4 w-4 text-bright/38' />
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h3 className='text-sm font-semibold text-bright/88'>{label}</h3>
                                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${isRevoked ? 'bg-red-500/10 text-red-200/80' : 'bg-emerald-500/10 text-emerald-200/80'}`}>
                                        {isRevoked ? 'Revoked' : 'Active'}
                                    </span>
                                </div>
                                <p className='mt-1 truncate text-xs text-bright/32'>{session.user_agent || 'Unknown client'}</p>
                                <p className='mt-1 text-xs text-bright/32'>IP {session.ip} · {formatDate(session.last_seen_at)}</p>
                            </div>
                            {!isRevoked && (
                                <button onClick={() => revoke(session.token_id)} className='h-8 cursor-pointer rounded-lg bg-red-500/10 px-3 text-xs font-semibold text-red-100/80 hover:bg-red-500/18'>
                                    <LogOut className='mr-2 inline h-4 w-4' />
                                    Revoke
                                </button>
                            )}
                        </div>
                    )
                })}
                {!sessions.length && <div className='rounded-lg border border-dashed border-white/10 p-4 text-sm text-bright/40'>
                    {loading ? 'Loading sessions...' : 'No active sessions found.'}
                </div>}
            </div>
        </DashboardPanel>
    )
}
