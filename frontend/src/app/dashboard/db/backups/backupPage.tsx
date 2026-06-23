'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { DatabaseBackup, RotateCcw } from 'lucide-react'
import { triggerBackupAction } from '../actions'
import type { BackupService } from '@/utils/db/internal'
import { DashboardHeader, dashboardPanelClass } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'

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

export default function BackupPage({ backups }: { backups: BackupService[] }) {
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
            <DashboardHeader
                eyebrow='Operations'
                title='Database backups'
                description='Review backup availability and restore points for the production workspace.'
            />
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap gap-2'>
                    <button
                        type='button'
                        onClick={handleRun}
                        disabled={isPending}
                        className='inline-flex items-center gap-2 rounded-lg border border-[#b8c5ff] bg-[#eef3ff] px-3 py-2 text-sm font-semibold text-[#3056d3] transition hover:bg-[#e4ebff] disabled:opacity-60'
                    >
                        <DatabaseBackup className='h-4 w-4' />
                        {isPending ? 'Running backup…' : 'Run backup now'}
                    </button>
                    <Link href='/dashboard/db/restore' className='inline-flex items-center gap-2 rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 text-sm font-semibold text-[#3d4758] shadow-sm transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
                        <RotateCcw className='h-4 w-4' />
                        Restore
                    </Link>
                </div>
                {message && <p className='text-sm text-[#596170]'>{message}</p>}
            </div>

            <div className='grid gap-4'>
                {backups.map((backup) => (
                    <article key={backup.id} className={`${dashboardPanelClass} p-5`}>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>{backup.name}</h2>
                                <p className='mt-1 text-xs font-semibold uppercase text-[#667085]'>{backup.id}</p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-xs'>
                                <span className={`rounded-full border px-3 py-1 font-semibold ${backup.status.toLowerCase().includes('up') ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f]' : 'border-[#fecdca] bg-[#fff1f0] text-[#912018]'}`}>
                                    {backup.status}
                                </span>
                                {backup.dbSize && <span className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1 font-semibold text-[#3d4758]'>
                                    {backup.dbSize}
                                </span>}
                                {backup.totalStorage && <span className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1 font-semibold text-[#3d4758]'>
                                    {backup.totalStorage}
                                </span>}
                            </div>
                        </div>
                        {backup.error && <ErrorNotice compact className='mt-4' message={backup.error} />}
                        <div className='mt-4 grid gap-3 text-sm text-[#596170] md:grid-cols-2 xl:grid-cols-3'>
                            <div className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4'>
                                <p className='text-xs font-semibold uppercase text-[#667085]'>Last backup</p>
                                <p className='mt-2 font-medium text-[#171a21]'>{formatRelative(backup.lastBackup)}</p>
                            </div>
                            <div className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4'>
                                <p className='text-xs font-semibold uppercase text-[#667085]'>Next backup</p>
                                <p className='mt-2 font-medium text-[#171a21]'>{formatSchedule(backup.nextBackup)}</p>
                            </div>
                            <Link
                                href={`/dashboard/db/restore?service=${encodeURIComponent(backup.name.replace(/_database$/, ''))}`}
                                className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'
                            >
                                <p className='text-xs font-semibold uppercase text-[#667085]'>Restore</p>
                                <p className='mt-2 font-medium text-[#171a21]'>View backup files</p>
                            </Link>
                        </div>
                    </article>
                ))}
                {!backups.length && (
                    <article className={`${dashboardPanelClass} p-5 text-sm text-[#596170]`}>
                        No backup services are available for this workspace yet.
                    </article>
                )}
            </div>
        </div>
    )
}
