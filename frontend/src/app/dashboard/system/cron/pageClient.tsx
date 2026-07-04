'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, CalendarClock, ChevronDown, Clock3, Cpu, FileText, PauseCircle, PlayCircle, RefreshCcw, Save, ServerCog, TerminalSquare, Zap } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { fetchManagedCronJobs, updateManagedCronJob, type ManagedCronJob } from '@/utils/systemCron/client'

const categories: ManagedCronJob['category'][] = ['TI / Exposure', 'Alerts', 'Mail', 'Backup/Database', 'Forgejo', 'Other/System']

export default function CronJobsClient() {
    const [jobs, setJobs] = useState<ManagedCronJob[]>([])
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')

    const summary = useMemo(() => {
        const enabled = jobs.filter(job => job.enabled).length
        const running = jobs.filter(job => job.running || job.status === 'running').length
        const failed = jobs.filter(job => job.status === 'failed' || job.status === 'blocked' || job.failureCount > 0).length
        const hourly = sumMoney(jobs.map(job => job.costEstimate.hourlyUsd))
        const daily = sumMoney(jobs.map(job => job.costEstimate.dailyUsd))
        return { total: jobs.length, enabled, running, failed, hourly, daily }
    }, [jobs])
    const attentionJobs = useMemo(() => jobs.filter(needsAttention), [jobs])
    const runnableJobs = useMemo(() => jobs.filter(job => job.controls.includes('run_now') && !needsAttention(job)).slice(0, 3), [jobs])

    useEffect(() => {
        void load()
    }, [])

    async function load() {
        setBusy('load')
        try {
            const payload = await fetchManagedCronJobs()
            setJobs(payload.jobs)
            setDrafts(Object.fromEntries(payload.jobs.map(job => [job.id, job.schedule])))
            setMessage('Background jobs streaming.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load background jobs.')
        } finally {
            setBusy('')
        }
    }

    async function save(job: ManagedCronJob, patch: { enabled?: boolean, action?: 'run_now' } = {}) {
        setBusy(job.id)
        try {
            const payload = await updateManagedCronJob(job.id, {
                ...(job.controls.includes('edit_schedule') ? { schedule: drafts[job.id] || job.schedule } : {}),
                ...patch,
            })
            setJobs(payload.jobs)
            setDrafts(Object.fromEntries(payload.jobs.map(item => [item.id, item.schedule])))
            setMessage(patch.action === 'run_now' ? `${job.name} started.` : `${job.name} saved.`)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to update background job.')
        } finally {
            setBusy('')
        }
    }

    return (
        <div className='grid gap-3'>
            <DashboardPanel className='grid gap-4 p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase tracking-normal text-ui-muted'>Scheduled operations</p>
                        <h2 className='mt-1 text-lg font-semibold text-ui-text'>{primaryHeadline(summary)}</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{summary.total ? `${summary.enabled}/${summary.total} enabled · ${summary.running} running · ${money(summary.daily)}/day estimate` : 'Waiting for the cron inventory.'}</p>
                    </div>
                    <button onClick={() => void load()} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel'>
                        <RefreshCcw className='h-4 w-4' />
                        {busy === 'load' ? 'Refreshing' : 'Refresh'}
                    </button>
                </div>

                <div className='grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]'>
                    <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3' aria-labelledby='cron-attention-heading'>
                        <div className='flex items-center gap-2'>
                            <AlertTriangle className={`h-4 w-4 ${attentionJobs.length ? 'text-ui-danger' : 'text-ui-success'}`} />
                            <h3 id='cron-attention-heading' className='text-sm font-semibold text-ui-text'>Needs attention</h3>
                            <span className='ml-auto text-xs font-semibold text-ui-muted'>{attentionJobs.length}</span>
                        </div>
                        {attentionJobs.length ? (
                            <div className='grid gap-2'>
                                {attentionJobs.slice(0, 3).map(job => (
                                    <a key={job.id} href={`#job-${job.id}`} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text transition hover:border-ui-primary'>
                                        <span className='font-semibold'>{job.name}</span>
                                        <span className='mt-1 block text-xs text-ui-muted'>{job.lastError || `${operationalStateLabel(job.status)} · ${job.category}`}</span>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className='text-sm text-ui-muted'>No blocked or failing jobs in the current inventory.</p>
                        )}
                    </section>

                    <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3' aria-labelledby='cron-next-action-heading'>
                        <div className='flex items-center gap-2'>
                            <PlayCircle className='h-4 w-4 text-ui-primary' />
                            <h3 id='cron-next-action-heading' className='text-sm font-semibold text-ui-text'>Next safe action</h3>
                        </div>
                        {runnableJobs[0] ? (
                            <div className='grid gap-2'>
                                <p className='text-sm text-ui-muted'>{runnableJobs[0].name} can be run manually without changing the schedule.</p>
                                <button onClick={() => void save(runnableJobs[0], { action: 'run_now' })} disabled={busy === runnableJobs[0].id} className='inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                                    <PlayCircle className='h-4 w-4' />
                                    {busy === runnableJobs[0].id ? 'Starting' : 'Run selected job'}
                                </button>
                            </div>
                        ) : (
                            <p className='text-sm text-ui-muted'>No manual run action is available from this snapshot.</p>
                        )}
                    </section>
                </div>

                {message ? <p className='text-sm text-ui-muted'>{message}</p> : null}
            </DashboardPanel>

            {categories.map(category => {
                const rows = jobs.filter(job => job.category === category)
                if (!rows.length) return null
                return (
                    <section key={category} className='grid gap-2'>
                        <div className='flex items-center justify-between gap-3 px-1'>
                            <h2 className='text-sm font-semibold uppercase tracking-normal text-ui-muted'>{category}</h2>
                            <span className='text-xs text-ui-muted'>{rows.length} job{rows.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className='grid gap-2'>
                            {rows.map(job => (
                                <DashboardPanel key={job.id} id={`job-${job.id}`} className='grid gap-3 p-4'>
                                    <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <ServerCog className='h-4 w-4 text-ui-muted' />
                                                <h3 className='text-base font-semibold text-ui-text'>{job.name}</h3>
                                                <StatusPill job={job} />
                                            </div>
                                            <p className='mt-1 text-sm leading-5 text-ui-muted'>{job.description}</p>
                                            <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                                                <Info icon={<CalendarClock className='h-4 w-4' />} label='Schedule' value={job.schedule} />
                                                <Info icon={<Clock3 className='h-4 w-4' />} label='Next run' value={timeLabel(job.nextRunAt)} />
                                                <Info icon={<AlertTriangle className='h-4 w-4' />} label='Health' value={job.failureCount ? `${job.failureCount}: ${job.lastError || 'See logs'}` : 'Clear'} />
                                            </div>
                                        </div>
                                        <div className='flex flex-wrap gap-2 lg:justify-end'>
                                            {(job.controls.includes('pause') || job.controls.includes('resume')) && (
                                                <button onClick={() => void save(job, { enabled: !job.enabled })} disabled={busy === job.id} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-50'>
                                                    {job.enabled ? <PauseCircle className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}
                                                    {busy === job.id ? 'Saving' : job.enabled ? 'Pause' : 'Resume'}
                                                </button>
                                            )}
                                            {job.controls.includes('run_now') && (
                                                <button onClick={() => void save(job, { action: 'run_now' })} disabled={busy === job.id} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-50'>
                                                    <PlayCircle className='h-4 w-4' />
                                                    {busy === job.id ? 'Starting' : 'Run now'}
                                                </button>
                                            )}
                                            {!job.controls.length && (
                                                <span className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted'>
                                                    Observable only
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {job.controls.includes('edit_schedule') ? (
                                        <label className='grid gap-1'>
                                            <span className='text-xs font-semibold uppercase text-ui-muted'>Schedule</span>
                                            <div className='flex gap-2'>
                                                <input
                                                    value={drafts[job.id] ?? job.schedule}
                                                    onChange={event => setDrafts(current => ({ ...current, [job.id]: event.target.value }))}
                                                    className='min-h-10 flex-1 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm text-ui-text outline-none focus:border-ui-primary'
                                                />
                                                <button onClick={() => void save(job)} className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary hover:bg-ui-panel' title='Save schedule' aria-label={`Save ${job.name} schedule`}>
                                                    <Save className='h-4 w-4' />
                                                </button>
                                            </div>
                                        </label>
                                    ) : null}

                                    <details className='group rounded-lg border border-ui-border bg-ui-raised'>
                                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary'>
                                            <span>Runtime, cost, and log details</span>
                                            <ChevronDown className='h-4 w-4 text-ui-muted transition group-open:rotate-180' />
                                        </summary>
                                        <div className='grid gap-2 border-t border-ui-border p-3 md:grid-cols-2'>
                                            <Info icon={<Clock3 className='h-4 w-4' />} label='Last run' value={timeLabel(job.lastRunAt)} />
                                            <Info icon={<Activity className='h-4 w-4' />} label='Runtime' value={`${duration(job.currentRunDurationMs) || 'not running'} current; ${duration(job.averageRuntimeMs) || 'measuring'} avg`} />
                                            <Info icon={<Cpu className='h-4 w-4' />} label='Resources' value={resourceLabel(job)} />
                                            <Info icon={<Zap className='h-4 w-4' />} label='Cost' value={`${money(job.costEstimate.hourlyUsd)}/hr · ${money(job.costEstimate.dailyUsd)}/day`} />
                                            <Info icon={<FileText className='h-4 w-4' />} label='Control' value={controlLabel(job)} />
                                            <Info icon={<TerminalSquare className='h-4 w-4' />} label='Log' value={job.logExcerpt || 'Log stream live; no recent line.'} mono />
                                        </div>
                                    </details>
                                </DashboardPanel>
                            ))}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}

function primaryHeadline(summary: { failed: number, running: number, total: number }) {
    if (!summary.total) return 'Loading scheduled work'
    if (summary.failed === 1) return '1 job needs review'
    if (summary.failed) return `${summary.failed} jobs need review`
    if (summary.running) return `${summary.running} job${summary.running === 1 ? '' : 's'} running now`
    return 'All scheduled jobs are quiet'
}

function needsAttention(job: ManagedCronJob) {
    return job.status === 'failed' || job.status === 'blocked' || job.failureCount > 0
}

function StatusPill({ job }: { job: ManagedCronJob }) {
    const tone = job.status === 'failed' || job.status === 'blocked'
        ? 'border-ui-danger bg-ui-danger/15 text-ui-danger'
        : job.status === 'running'
            ? 'border-ui-primary bg-ui-primary/15 text-ui-primary'
            : job.enabled
                ? 'border-ui-success bg-ui-success/15 text-ui-success'
                : 'border-ui-border bg-ui-raised text-ui-muted'
    return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>{operationalStateLabel(job.status)}</span>
}

function Info({ icon, label, value, mono = false }: { icon: ReactNode, label: string, value: string, mono?: boolean }) {
    return (
        <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <span className='text-xs font-semibold uppercase'>{label}</span>
            </div>
            <p className={`${mono ? 'font-mono text-xs' : 'text-sm'} break-words text-ui-text`}>{value}</p>
        </div>
    )
}

function controlLabel(job: ManagedCronJob) {
    if (job.controlMode === 'observable_only') return 'Observable only'
    if (job.controlMode === 'run_only') return 'Run now supported'
    if (job.controlMode === 'editable') return 'Pause/resume and schedule edit'
    return job.controls.includes('run_now') ? 'Safe pause/resume and run now' : 'Safe pause/resume'
}

function resourceLabel(job: ManagedCronJob) {
    const parts = [
        job.resourceUsage.memoryRssMb !== null ? `${job.resourceUsage.memoryRssMb} MB RSS` : '',
        job.resourceUsage.memoryUsedMb !== null ? `${job.resourceUsage.memoryUsedMb} MB heap` : '',
        job.resourceUsage.queueDepth !== null ? `${job.resourceUsage.queueDepth} queued` : '',
    ].filter(Boolean)
    return parts.length ? `${parts.join(' · ')} (${job.resourceUsage.scope})` : job.resourceUsage.note
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'blocked'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'action_required') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function timeLabel(value: string | null) {
    if (!value) return 'watching'
    return new Date(value).toLocaleString()
}

function duration(value: number | null) {
    if (!value) return ''
    if (value < 1000) return `${value}ms`
    const seconds = Math.round(value / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    return `${minutes}m`
}

function sumMoney(values: Array<number | null>) {
    const available = values.filter((value): value is number => typeof value === 'number')
    if (!available.length) return null
    return Math.round(available.reduce((sum, value) => sum + value, 0) * 10000) / 10000
}

function money(value: number | null) {
    return typeof value === 'number' ? `$${value.toFixed(value < 0.01 ? 4 : 2)}` : 'metering'
}
