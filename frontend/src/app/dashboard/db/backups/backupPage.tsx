'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock3, DatabaseBackup, FileClock, ListChecks, RotateCcw, ShieldCheck } from 'lucide-react'
import { triggerBackupAction } from '../actions'
import type { BackupService } from '@/utils/db/internal'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import { presentBackup, presentBackupLoadError, type BackupPresentation } from './backupPresentation'

type BackupPageProps = {
    backups: BackupService[]
    loadError?: string
}

function formatSchedule(value?: string | null) {
    if (!value) return 'No schedule configured'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatRelative(value?: string | null) {
    if (!value) return 'Never'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function healthClasses(tone: BackupPresentation['healthTone']) {
    if (tone === 'ok') return 'border-ui-success bg-ui-success/15 text-ui-success'
    if (tone === 'warn') return 'border-ui-warning bg-ui-warning/15 text-ui-warning'
    return 'border-ui-danger bg-ui-danger/15 text-ui-danger'
}

function backupServiceSlug(backup: BackupService) {
    return (backup.id || backup.name).replace(/_database$/, '')
}

export default function BackupPage({ backups, loadError = '' }: BackupPageProps) {
    const [message, setMessage] = useState('')
    const [isPending, startTransition] = useTransition()
    const loadBlocker = loadError ? presentBackupLoadError(loadError) : null
    const presentations = backups.map((backup) => ({ backup, presentation: presentBackup(backup) }))
    const healthyCount = presentations.filter(({ presentation }) => presentation.healthTone === 'ok').length
    const restoreReadyCount = presentations.filter(({ presentation }) => presentation.restoreReady).length
    const nextBackup = backups.find(backup => backup.nextBackup)?.nextBackup
    const lastBackup = backups.find(backup => backup.lastBackup)?.lastBackup

    function handleRun() {
        startTransition(async () => {
            const response = await triggerBackupAction()
            setMessage(typeof response === 'string' ? presentBackupLoadError(response).safeError : response.message)
        })
    }

    return (
        <div className='grid gap-4'>
            <section className={`${dashboardPanelClass} p-4`}>
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                    <SummaryMetric icon={<ShieldCheck className='h-4 w-4' />} label='Backup health' value={loadBlocker ? 'Unavailable' : backups.length ? `${healthyCount}/${backups.length} healthy` : 'Checking targets'} />
                    <SummaryMetric icon={<FileClock className='h-4 w-4' />} label='Last backup' value={formatRelative(lastBackup)} />
                    <SummaryMetric icon={<Clock3 className='h-4 w-4' />} label='Next backup' value={formatSchedule(nextBackup)} />
                    <SummaryMetric icon={<RotateCcw className='h-4 w-4' />} label='Restore lane' value={restoreReadyCount ? `${restoreReadyCount} target${restoreReadyCount === 1 ? '' : 's'} ready` : 'Indexing restore points'} />
                </div>
            </section>

            {loadBlocker && (
                <ConfigurationBlocker safeError={loadBlocker.safeError} rawDetails={loadBlocker.rawDetails} />
            )}

            {message && (
                <p className='rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-text shadow-sm'>{message}</p>
            )}

            <div className='grid gap-4'>
                {presentations.map(({ backup, presentation }) => (
                    <article key={backup.id} className={`${dashboardPanelClass} p-5`}>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h2 className='text-lg font-semibold text-ui-text'>{backup.name}</h2>
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthClasses(presentation.healthTone)}`}>
                                        {presentation.healthLabel}
                                    </span>
                                </div>
                                <p className='mt-1 text-xs font-semibold uppercase text-ui-muted'>{backup.id}</p>
                                <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>{presentation.summary}</p>
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <button
                                    type='button'
                                    onClick={handleRun}
                                    disabled={isPending || Boolean(presentation.safeError)}
                                    title={presentation.safeError ? 'Fix the backup configuration blocker before running a new backup.' : 'Run a backup for this target.'}
                                    className='inline-flex items-center gap-2 rounded-lg border border-ui-primary bg-ui-primary/15 px-3 py-2 text-sm font-semibold text-ui-primary transition hover:bg-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    <DatabaseBackup className='h-4 w-4' />
                                    {isPending ? 'Running backup...' : 'Run backup now'}
                                </button>
                                {presentation.restoreReady ? (
                                    <Link
                                        href={`/dashboard/db/restore?service=${encodeURIComponent(backupServiceSlug(backup))}`}
                                        className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary hover:bg-ui-raised'
                                    >
                                        <RotateCcw className='h-4 w-4' />
                                        View restore files
                                    </Link>
                                ) : (
                                    <button
                                        type='button'
                                        disabled
                                        title={presentation.restoreDisabledReason}
                                        className='inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted'
                                    >
                                        <RotateCcw className='h-4 w-4' />
                                        View restore files
                                    </button>
                                )}
                            </div>
                        </div>

                        {presentation.restoreDisabledReason && (
                            <p className='mt-3 text-sm text-ui-muted'>{presentation.restoreDisabledReason}</p>
                        )}

                        {presentation.safeError && (
                            <ConfigurationBlocker safeError={presentation.safeError} rawDetails={presentation.rawDetails} compact />
                        )}

                        <div className='mt-4 grid gap-3 text-sm text-ui-muted md:grid-cols-2 xl:grid-cols-4'>
                            <InfoCell label='Last backup' value={formatRelative(backup.lastBackup)} />
                            <InfoCell label='Next backup' value={formatSchedule(backup.nextBackup)} />
                            <InfoCell label='Retention' value={presentation.retention} />
                            <InfoCell label='Storage target' value={presentation.storageTarget} />
                            <InfoCell label='Latest file' value={presentation.latestFile} />
                            <InfoCell label='Latest size' value={presentation.latestSize} />
                            <InfoCell label='Duration' value={presentation.duration} />
                            <InfoCell label='Health check' value={presentation.healthCheck} />
                        </div>
                    </article>
                ))}

                {!backups.length && (
                    <article className={`${dashboardPanelClass} p-5`}>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <h2 className='text-lg font-semibold text-ui-text'>Checking backup targets</h2>
                                <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>
                                    Backup targets stay on watch while the service connection is checked.
                                </p>
                                <p className='mt-3 text-sm text-ui-muted'>
                                    Restore unlocks when the first verified backup file is indexed.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={handleRun}
                                disabled={isPending || Boolean(loadBlocker)}
                                title={loadBlocker ? 'Fix the backup configuration blocker before running a new backup.' : 'Try to create the first backup.'}
                                className='inline-flex items-center gap-2 rounded-lg border border-ui-primary bg-ui-primary/15 px-3 py-2 text-sm font-semibold text-ui-primary transition hover:bg-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <DatabaseBackup className='h-4 w-4' />
                                {isPending ? 'Running backup...' : 'Run backup now'}
                            </button>
                        </div>
                    </article>
                )}
            </div>
        </div>
    )
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className='flex items-start gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <span className='mt-0.5 text-ui-primary'>{icon}</span>
            <span>
                <span className='block text-xs font-semibold uppercase text-ui-muted'>{label}</span>
                <span className='mt-1 block font-medium text-ui-text'>{value}</span>
            </span>
        </div>
    )
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-2 wrap-break-word font-medium text-ui-text'>{value}</p>
        </div>
    )
}

function ConfigurationBlocker({ safeError, rawDetails, compact = false }: { safeError: string; rawDetails?: string; compact?: boolean }) {
    return (
        <section className={`${compact ? 'mt-4' : ''} rounded-lg border border-ui-warning bg-ui-warning/15 p-4`}>
            <div className='flex items-start gap-3'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-ui-warning' />
                <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold text-ui-warning'>Configuration needs attention</p>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{safeError}</p>
                    <div className='mt-3 flex flex-wrap items-center gap-3 text-sm'>
                        <Link href='/dashboard/logs' className='inline-flex items-center gap-2 font-semibold text-ui-primary hover:underline'>
                            <ListChecks className='h-4 w-4' />
                            Open logs
                        </Link>
                        {rawDetails && (
                            <details className='text-ui-muted'>
                                <summary className='cursor-pointer font-semibold text-ui-text'>Technical details</summary>
                                <code className='mt-2 block whitespace-pre-wrap wrap-break-word rounded-md border border-ui-warning bg-ui-panel px-3 py-2 text-xs text-ui-text'>
                                    {rawDetails}
                                </code>
                            </details>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
