'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { DatabaseBackup, RotateCcw } from 'lucide-react'
import { triggerBackupAction } from '../actions'
import type { BackupService } from '@/utils/db/internal'
import { dashboardPanelClass } from '@/components/dashboard/ui'

function formatSchedule(value?: string | null) {
    if (!value) return 'Not scheduled'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatRelative(value?: string | null) {
    if (!value) return 'Never'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function DatabaseBackupsPageClient({ backups }: { backups: BackupService[] }) {
    const [message, setMessage] = useState('')
    const [isPending, startTransition] = useTransition()

    function handleRun() {
        startTransition(async () => {
            const response = await triggerBackupAction()
            setMessage(typeof response === 'string' ? response : response.message)
        })
    }

    return (
        <div className='grid gap-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap gap-2'>
                    <button
                        type='button'
                        onClick={handleRun}
                        disabled={isPending}
                        className='inline-flex items-center gap-2 rounded-lg border border-login-100/10 bg-black/18 px-3 py-2 text-sm text-bright/75 transition hover:border-orange-300/35 hover:bg-orange-300/8 disabled:opacity-60'
                    >
                        <DatabaseBackup className='h-4 w-4' />
                        {isPending ? 'Running backup…' : 'Run backup now'}
                    </button>
                    <Link href='/dashboard/db/restore' className='inline-flex items-center gap-2 rounded-lg border border-login-100/10 bg-black/18 px-3 py-2 text-sm text-bright/75 transition hover:border-orange-300/35 hover:bg-orange-300/8'>
                        <RotateCcw className='h-4 w-4' />
                        Restore
                    </Link>
                </div>
                {message && <p className='text-sm text-bright/62'>{message}</p>}
            </div>

            <div className='grid gap-4'>
                {backups.map((backup) => (
                    <article key={backup.id} className={`${dashboardPanelClass} p-5`}>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-bright'>{backup.name}</h2>
                                <p className='mt-1 text-xs uppercase tracking-[0.18em] text-bright/35'>{backup.id}</p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-xs'>
                                <span className={`rounded-full px-3 py-1 ${backup.status.toLowerCase().includes('up') ? 'bg-emerald-500/14 text-emerald-100' : 'bg-red-500/14 text-red-100'}`}>{backup.status}</span>
                                {backup.dbSize && <span className='rounded-full border border-login-100/10 bg-white/5 px-3 py-1 text-bright/62'>{backup.dbSize}</span>}
                                {backup.totalStorage && <span className='rounded-full border border-login-100/10 bg-white/5 px-3 py-1 text-bright/62'>{backup.totalStorage}</span>}
                            </div>
                        </div>
                        {backup.error && (
                            <div className='mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-100'>{backup.error}</div>
                        )}
                        <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm text-bright/65'>
                            <div className='rounded-xl bg-black/18 p-4'>
                                <p className='text-xs uppercase tracking-[0.18em] text-bright/35'>Last backup</p>
                                <p className='mt-2'>{formatRelative(backup.lastBackup)}</p>
                            </div>
                            <div className='rounded-xl bg-black/18 p-4'>
                                <p className='text-xs uppercase tracking-[0.18em] text-bright/35'>Next backup</p>
                                <p className='mt-2'>{formatSchedule(backup.nextBackup)}</p>
                            </div>
                            <Link href={`/dashboard/db/restore?service=${encodeURIComponent(backup.name.replace(/_database$/, ''))}`} className='rounded-xl bg-black/18 p-4 transition hover:bg-black/24'>
                                <p className='text-xs uppercase tracking-[0.18em] text-bright/35'>Restore</p>
                                <p className='mt-2 text-bright/78'>View backup files</p>
                            </Link>
                        </div>
                    </article>
                ))}
                {!backups.length && (
                    <article className={`${dashboardPanelClass} p-5 text-sm text-bright/55`}>
                        No backup services were returned by the internal API.
                    </article>
                )}
            </div>
        </div>
    )
}
