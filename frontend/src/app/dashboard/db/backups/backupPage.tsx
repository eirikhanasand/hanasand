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
    const attentionTarget = presentations.find(({ presentation }) => presentation.healthTone === 'bad')
    const nextBackup = backups.find(backup => backup.nextBackup)?.nextBackup
    const lastBackup = backups.find(backup => backup.lastBackup)?.lastBackup
    const firstRestoreReady = presentations.find(({ presentation }) => presentation.restoreReady)
    const hasRestoreTargets = presentations.length > 0
    const primaryTitle = loadBlocker
        ? 'Fix backup configuration first'
        : !backups.length
            ? 'Create the first verified backup'
            : attentionTarget
                ? `Open logs for ${attentionTarget.backup.name}`
                : restoreReadyCount
                    ? 'Restore files are ready'
                    : hasRestoreTargets
                        ? 'Run backup to create a verified restore point'
                        : 'Run backup to create a restore point'
    const primaryDetail = loadBlocker
        ? loadBlocker.safeError
        : !backups.length
            ? 'No backup targets are reporting yet. Start a backup check to establish the first restore point.'
            : attentionTarget
                ? attentionTarget.presentation.safeError || attentionTarget.presentation.summary
                : restoreReadyCount
                    ? `${restoreReadyCount} target${restoreReadyCount === 1 ? '' : 's'} can open restore files. Last backup: ${formatRelative(lastBackup)}.`
                    : 'Backup targets are visible, but no verified restore file is indexed yet. Run a backup first, then return for restore validation.'
    const primaryRestoreHref = firstRestoreReady ? `/dashboard/db/restore?service=${encodeURIComponent(backupServiceSlug(firstRestoreReady.backup))}` : ''

    function handleRun() {
        startTransition(async () => {
            const response = await triggerBackupAction()
            setMessage(typeof response === 'string' ? presentBackupLoadError(response).safeError : response.message)
        })
    }

    return (
        <div className='grid gap-4'>
            <section className={`${dashboardPanelClass} grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`} data-backup-primary-flow>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>Recommended next</span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{healthyCount}/{backups.length || 0} healthy</span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{restoreReadyCount} restore-ready</span>
                    </div>
                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>{primaryTitle}</h2>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{primaryDetail}</p>
                </div>
                {loadBlocker ? (
                    <Link
                        href='/dashboard/logs'
                        className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:bg-ui-primary/90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                        data-backup-primary-action
                    >
                        <ListChecks className='h-4 w-4' />
                        Open logs
                    </Link>
                ) : attentionTarget ? (
                    <Link
                        href='/dashboard/logs'
                        className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:bg-ui-primary/90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                        data-backup-primary-action
                    >
                        <ListChecks className='h-4 w-4' />
                        Open logs
                    </Link>
                ) : primaryRestoreHref ? (
                    <Link
                        href={primaryRestoreHref}
                        className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:bg-ui-primary/90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                        data-backup-primary-action
                    >
                        <RotateCcw className='h-4 w-4' />
                        Open restore files
                    </Link>
                ) : (
                    <button
                        type='button'
                        onClick={handleRun}
                        disabled={isPending}
                        className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
                        data-backup-primary-action
                    >
                        <DatabaseBackup className='h-4 w-4' />
                        {isPending ? 'Running backup...' : 'Run backup now'}
                    </button>
                )}
            </section>

            <details className={`${dashboardPanelClass} overflow-hidden`} data-backup-summary-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Backup counters and schedule</span>
                    <span className='text-xs font-medium text-ui-muted'>Last {formatRelative(lastBackup)}, next {formatSchedule(nextBackup)}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border bg-ui-panel p-3 md:grid-cols-2 xl:grid-cols-4' data-backup-summary-metrics>
                    <SummaryMetric icon={<ShieldCheck className='h-4 w-4' />} label='Backup health' value={loadBlocker ? 'Unavailable' : backups.length ? `${healthyCount}/${backups.length} healthy` : 'Checking targets'} />
                    <SummaryMetric icon={<FileClock className='h-4 w-4' />} label='Last backup' value={formatRelative(lastBackup)} />
                    <SummaryMetric icon={<Clock3 className='h-4 w-4' />} label='Next backup' value={formatSchedule(nextBackup)} />
                    <SummaryMetric icon={<RotateCcw className='h-4 w-4' />} label='Restore lane' value={restoreReadyCount ? `${restoreReadyCount} target${restoreReadyCount === 1 ? '' : 's'} ready` : 'Indexing restore points'} />
                </div>
            </details>

            {loadBlocker && (
                <ConfigurationBlocker safeError={loadBlocker.safeError} rawDetails={loadBlocker.rawDetails} />
            )}

            {message && (
                <p className='rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-text shadow-sm'>{message}</p>
            )}

            <div className='grid gap-4' id='backup-targets' data-backup-targets>
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
                                    disabled={isPending}
                                    title='Run a backup for this target.'
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
                                        Restore
                                    </Link>
                                ) : (
                                    <Link
                                        href={`/dashboard/db/restore?service=${encodeURIComponent(backupServiceSlug(backup))}`}
                                        title={presentation.restoreDisabledReason}
                                        className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary hover:bg-ui-raised'
                                    >
                                        <RotateCcw className='h-4 w-4' />
                                        Open restore index
                                    </Link>
                                )}
                            </div>
                        </div>

                        {presentation.restoreDisabledReason && (
                            <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                                <p>{presentation.restoreDisabledReason}</p>
                                <p className='mt-1'>Use the action above to create or refresh restore points for this target.</p>
                            </div>
                        )}

                        <RestoreProof proof={presentation.restoreProof} />

                        {presentation.safeError && (
                            <ConfigurationBlocker safeError={presentation.safeError} rawDetails={presentation.rawDetails} compact />
                        )}

                        <details className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-backup-target-details>
                            <summary className='flex cursor-pointer list-none flex-col gap-1 px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                <span>Schedule, storage, and file details</span>
                                <span className='text-xs font-medium text-ui-muted'>{formatRelative(backup.lastBackup)} last, {formatSchedule(backup.nextBackup)} next</span>
                            </summary>
                            <div className='grid gap-3 border-t border-ui-border p-3 text-sm text-ui-muted md:grid-cols-2 xl:grid-cols-4'>
                                <InfoCell label='Last backup' value={formatRelative(backup.lastBackup)} />
                                <InfoCell label='Next backup' value={formatSchedule(backup.nextBackup)} />
                                <InfoCell label='Retention' value={presentation.retention} />
                                <InfoCell label='Storage target' value={presentation.storageTarget} />
                                <InfoCell label='Latest file' value={presentation.latestFile} />
                                <InfoCell label='Latest size' value={presentation.latestSize} />
                                <InfoCell label='Duration' value={presentation.duration} />
                                <InfoCell label='Health check' value={presentation.healthCheck} />
                            </div>
                        </details>
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
                                    Restore unlocks when the first verified backup file is indexed. Use Run backup now to create one.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={handleRun}
                                disabled={isPending}
                                title='Try to create the first backup.'
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

function RestoreProof({ proof }: { proof: BackupPresentation['restoreProof'] }) {
    return (
        <div className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3' data-backup-restore-proof={proof.state}>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-semibold text-ui-text'>Restore actions</p>
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${proof.state === 'ready' ? 'border-ui-success bg-ui-success/15 text-ui-success' : 'border-ui-warning bg-ui-warning/15 text-ui-warning'}`}>
                    {proof.state === 'ready' ? 'Ready' : 'Review'}
                </span>
            </div>
            <div className='mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
                {proof.checks.map(check => (
                    <div key={check.id} className='rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs'>
                        <p className='font-semibold uppercase text-ui-muted'>{check.label}</p>
                        <p className='mt-1 wrap-break-word text-ui-text'>{check.value}</p>
                        <p className={`mt-1 font-semibold ${check.state === 'ready' ? 'text-ui-success' : check.state === 'needs_action' ? 'text-ui-warning' : 'text-ui-muted'}`}>{check.state === 'needs_action' ? 'review' : check.state}</p>
                    </div>
                ))}
            </div>
            {proof.blockers.length > 0 && (
                <ul className='mt-3 grid gap-1 text-xs leading-5 text-ui-warning'>
                    {proof.blockers.slice(0, 3).map(blocker => <li key={blocker}>{blocker}</li>)}
                </ul>
            )}
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
