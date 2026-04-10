'use client'

import { AuthSession, fetchSessions, revokeOtherSessions, revokeSession } from '@/utils/auth/sessions'
import { Laptop, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function deviceLabel(userAgent: string) {
    if (/mobile|iphone|android/i.test(userAgent)) {
        return 'Mobile browser'
    }

    if (/curl|node|monitor|playwright/i.test(userAgent)) {
        return 'Automation or API client'
    }

    return 'Desktop browser'
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
        <section className='glass-panel rounded-3xl p-5'>
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <p className='text-xs uppercase tracking-[0.3em] text-orange-200/70'>Security</p>
                    <h2 className='mt-2 text-xl font-semibold text-bright'>Logged in devices</h2>
                    <p className='mt-1 text-sm text-bright/45'>Review recent logins and revoke access without changing your password.</p>
                </div>
                <button onClick={revokeOthers} className='cursor-pointer rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-bright/80 hover:bg-white/10'>
                    Logout other devices
                </button>
            </div>

            <div className='mt-5 grid gap-3'>
                {sessions.map(session => {
                    const isRevoked = Boolean(session.revoked_at)
                    const Icon = /mobile|iphone|android/i.test(session.user_agent) ? Smartphone : Laptop
                    return (
                        <div key={session.token_id} className='grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'>
                            <div className='icon-tile bg-emerald-500/12 text-emerald-300'>
                                <Icon className='h-4 w-4' />
                            </div>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h3 className='font-semibold text-bright'>{deviceLabel(session.user_agent)}</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-xs ${isRevoked ? 'bg-red-500/12 text-red-200' : 'bg-emerald-500/12 text-emerald-200'}`}>
                                        {isRevoked ? 'Revoked' : 'Active'}
                                    </span>
                                </div>
                                <p className='mt-1 truncate text-sm text-bright/45'>{session.user_agent || 'Unknown client'}</p>
                                <p className='mt-1 text-xs text-bright/35'>IP {session.ip} · Login {formatDate(session.created_at)} · Last seen {formatDate(session.last_seen_at)}</p>
                            </div>
                            {!isRevoked && (
                                <button onClick={() => revoke(session.token_id)} className='cursor-pointer rounded-2xl bg-red-500/12 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20'>
                                    <LogOut className='mr-2 inline h-4 w-4' />
                                    Revoke
                                </button>
                            )}
                        </div>
                    )
                })}
                {!sessions.length && <div className='rounded-2xl border border-dashed border-white/10 p-5 text-sm text-bright/45'>
                    {loading ? 'Loading sessions...' : 'No active sessions found.'}
                </div>}
            </div>

            <div className='mt-4 flex items-center gap-2 text-xs text-bright/35'>
                <ShieldCheck className='h-4 w-4 text-emerald-300' />
                Token revocation is immediate for API and dashboard requests.
            </div>
        </section>
    )
}
