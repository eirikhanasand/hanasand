'use client'

import { useMemo, useState, useTransition } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { restoreBackupAction, triggerBackupAction } from '../actions'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { BackupFile } from '@/utils/db/internal'

type GroupedBackup = BackupFile & { locations: string[] }

function formatDate(value?: string | null) {
    if (!value) return 'Timestamp syncing'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function RestoreClient({ backups, loadError = '' }: { backups: BackupFile[], loadError?: string }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [serviceFilter, setServiceFilter] = useState(searchParams.get('service') || '')
    const [dateFilter, setDateFilter] = useState(searchParams.get('date') || '')
    const [message, setMessage] = useState('')
    const [restoring, setRestoring] = useState('')
    const [isPending, startTransition] = useTransition()

    const groupedBackups = useMemo(() => {
        const groups: Record<string, GroupedBackup> = {}
        backups.forEach((backup) => {
            const key = `${backup.service}-${backup.file}`
            if (!groups[key]) {
                groups[key] = { ...backup, locations: backup.location ? [backup.location] : [] }
                return
            }
            if (backup.location && !groups[key].locations.includes(backup.location)) {
                groups[key].locations.push(backup.location)
            }
        })
        return Object.values(groups)
    }, [backups])
    const serviceCount = useMemo(() => new Set(groupedBackups.map(backup => backup.service)).size, [groupedBackups])
    const newestBackup = useMemo(() => groupedBackups.reduce<GroupedBackup | null>((newest, backup) => {
        if (!newest) return backup
        const newestTime = new Date(newest.mtime || '').getTime()
        const backupTime = new Date(backup.mtime || '').getTime()
        const safeNewestTime = Number.isFinite(newestTime) ? newestTime : -Infinity
        return Number.isFinite(backupTime) && backupTime > safeNewestTime ? backup : newest
    }, null), [groupedBackups])
    const activeFilterCount = Number(Boolean(serviceFilter)) + Number(Boolean(dateFilter))
    const primaryTitle = loadError
        ? 'Restore index unavailable'
        : groupedBackups.length
            ? 'Select a restore point'
            : activeFilterCount
                ? 'No restore points match the filters'
                : 'Restore index is empty'
    const primaryDetail = loadError
        ? loadError.replace(/^Error:\s*/i, '')
        : groupedBackups.length
            ? `${groupedBackups.length} restore point${groupedBackups.length === 1 ? '' : 's'} across ${serviceCount} service${serviceCount === 1 ? '' : 's'}. Newest file: ${newestBackup?.file || 'syncing'}.`
            : activeFilterCount
                ? 'Clear filters or adjust the service/date search to widen the restore set.'
                : 'No indexed restore file exists yet. Run backup now to create one.'
    const primaryHref = groupedBackups.length ? '#restore-points' : activeFilterCount ? '#restore-filters' : '/dashboard/db/backups'
    const primaryActionLabel = groupedBackups.length ? 'Review restore points' : activeFilterCount ? 'Adjust filters' : 'Run backup now'

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value) params.set(key, value)
        else params.delete(key)
        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname)
    }

    function clearFilters() {
        setServiceFilter('')
        setDateFilter('')
        router.push(pathname)
    }

    function handleRestore(backup: GroupedBackup) {
        const key = `${backup.service}-${backup.file}`
        setRestoring(key)
        startTransition(async () => {
            const response = await restoreBackupAction(backup.service, backup.file)
            setMessage(typeof response === 'string' ? response : response.message)
            setRestoring('')
        })
    }

    function handleRunBackup() {
        startTransition(async () => {
            const response = await triggerBackupAction()
            setMessage(typeof response === 'string' ? response.replace(/^Error:\s*/i, '') : response.message)
            router.refresh()
        })
    }

    return (
        <div className='grid gap-4'>
            <section className={`${dashboardPanelClass} grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`} data-restore-primary-flow>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>Recommended next</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{groupedBackups.length} restore points</span>
                        {activeFilterCount > 0 && <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{activeFilterCount} active filters</span>}
                    </div>
                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>{primaryTitle}</h2>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{primaryDetail}</p>
                </div>
                {groupedBackups.length || activeFilterCount ? (
                    <a
                        href={primaryHref}
                        className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                        data-restore-primary-action
                    >
                        {primaryActionLabel}
                    </a>
                ) : (
                    <button
                        type='button'
                        onClick={handleRunBackup}
                        disabled={isPending}
                        className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:w-auto'
                        data-restore-primary-action
                    >
                        {isPending ? 'Running backup...' : primaryActionLabel}
                    </button>
                )}
            </section>

            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel' open={activeFilterCount > 0} id='restore-filters' data-restore-filters-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span className='inline-flex items-center gap-2'>
                        <Search className='h-4 w-4 text-ui-primary' />
                        Filter restore points
                    </span>
                    <span className='text-xs font-medium text-ui-muted'>{activeFilterCount ? `${activeFilterCount} active` : 'All indexed files'}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end'>
                    <label className='grid gap-1.5 text-sm'>
                        <span className='text-xs font-semibold uppercase text-ui-muted'>Service</span>
                        <input
                            value={serviceFilter}
                            onChange={(event) => {
                                const value = event.target.value
                                setServiceFilter(value)
                                updateParam('service', value)
                            }}
                            placeholder='Filter by service'
                            className='min-h-10 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary'
                            data-restore-service-filter
                        />
                    </label>
                    <label className='grid gap-1.5 text-sm'>
                        <span className='text-xs font-semibold uppercase text-ui-muted'>Date</span>
                        <input
                            type='date'
                            value={dateFilter}
                            onChange={(event) => {
                                const value = event.target.value
                                setDateFilter(value)
                                updateParam('date', value)
                            }}
                            className='min-h-10 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary'
                            data-restore-date-filter
                        />
                    </label>
                    <button
                        type='button'
                        onClick={clearFilters}
                        disabled={!activeFilterCount}
                        className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 disabled:cursor-not-allowed disabled:opacity-50'
                        data-restore-clear-filters
                    >
                        <X className='h-4 w-4' />
                        Clear
                    </button>
                </div>
            </details>

            {message && <p className='rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-muted'>{message}</p>}

            <div className='grid gap-4' id='restore-points' data-restore-points>
                {groupedBackups.map((backup) => {
                    const key = `${backup.service}-${backup.file}`
                    return (
                        <article key={key} className={`${dashboardPanelClass} p-5`}>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div>
                                    <h2 className='text-lg font-semibold text-ui-text'>{backup.service}</h2>
                                    <p className='mt-1 text-sm text-ui-muted'>{backup.file}</p>
                                </div>
                                <button
                                    type='button'
                                    onClick={() => handleRestore(backup)}
                                    disabled={isPending}
                                    className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 py-2 text-sm font-semibold text-ui-primary transition hover:bg-ui-primary/15 disabled:opacity-60'
                                >
                                    <RotateCcw className='h-4 w-4' />
                                    {restoring === key ? 'Restoring…' : 'Restore'}
                                </button>
                            </div>
                            <div className='mt-4 grid gap-3 text-sm text-ui-muted md:grid-cols-3'>
                                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                                    <p className='text-xs font-semibold uppercase text-ui-muted'>Locations</p>
                                    <p className='mt-2 font-medium text-ui-text'>{backup.locations.join(', ') || 'Storage location syncing'}</p>
                                </div>
                                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                                    <p className='text-xs font-semibold uppercase text-ui-muted'>Modified</p>
                                    <p className='mt-2 font-medium text-ui-text'>{formatDate(backup.mtime)}</p>
                                </div>
                                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                                    <p className='text-xs font-semibold uppercase text-ui-muted'>Size</p>
                                    <p className='mt-2 font-medium text-ui-text'>{backup.size || 'Measuring size'}</p>
                                </div>
                            </div>
                        </article>
                    )
                })}
                {!groupedBackups.length && (
                    <article className={`${dashboardPanelClass} p-5`} data-restore-empty-state>
                        <h2 className='text-lg font-semibold text-ui-text'>No restore files yet</h2>
                        <p className='mt-2 text-sm text-ui-muted'>No restore files are indexed for this filter set.</p>
                        {activeFilterCount > 0 ? (
                            <p className='mt-1 text-sm text-ui-muted'>No matches found. Clear filters or return to Backup to create a verified restore point.</p>
                        ) : (
                            <p className='mt-1 text-sm text-ui-muted'>No verified files are available. Run backup now to create and index one.</p>
                        )}

                        {activeFilterCount > 0 ? (
                            <button
                                type='button'
                                onClick={clearFilters}
                                className='mt-3 inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10'
                            >
                                <X className='h-4 w-4' />
                                Clear filters
                            </button>
                        ) : (
                            <button
                                type='button'
                                onClick={handleRunBackup}
                                disabled={isPending}
                                className='mt-3 inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 disabled:opacity-60'
                            >
                                {isPending ? 'Running backup...' : 'Run backup now'}
                            </button>
                        )}
                    </article>
                )}
            </div>
        </div>
    )
}
