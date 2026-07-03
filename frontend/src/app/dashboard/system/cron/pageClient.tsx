'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Clock3, Cpu, FileText, PauseCircle, PlayCircle, RefreshCcw, Save, ServerCog, TerminalSquare, Zap } from 'lucide-react'
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
            <DashboardPanel className='grid gap-3 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='grid gap-2 sm:grid-cols-3 xl:grid-cols-6'>
                        <Stat label='Total jobs' value={String(summary.total)} icon={<ServerCog className='h-4 w-4' />} />
                        <Stat label='Enabled' value={String(summary.enabled)} icon={<CheckCircle2 className='h-4 w-4' />} />
                        <Stat label='Running' value={String(summary.running)} icon={<Activity className='h-4 w-4' />} />
                        <Stat label='Issues' value={String(summary.failed)} icon={<AlertTriangle className='h-4 w-4' />} tone={summary.failed ? 'bad' : 'ok'} />
                        <Stat label='Hourly cost' value={money(summary.hourly)} icon={<Zap className='h-4 w-4' />} />
                        <Stat label='Daily cost' value={money(summary.daily)} icon={<Zap className='h-4 w-4' />} />
                    </div>
                    <button onClick={() => void load()} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary hover:bg-ui-panel'>
                        <RefreshCcw className='h-4 w-4' />
                        {busy === 'load' ? 'Refreshing' : 'Refresh'}
                    </button>
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
                        <div className='grid gap-3 xl:grid-cols-2'>
                            {rows.map(job => (
                                <DashboardPanel key={job.id} className='grid gap-3 p-4'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <ServerCog className='h-4 w-4 text-ui-muted' />
                                                <h3 className='text-base font-semibold text-ui-text'>{job.name}</h3>
                                                <StatusPill job={job} />
                                            </div>
                                            <p className='mt-1 text-sm leading-5 text-ui-muted'>{job.description}</p>
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
                                    ) : (
                                        <Info icon={<CalendarClock className='h-4 w-4' />} label='Schedule' value={job.schedule} />
                                    )}

                                    <div className='grid gap-2 md:grid-cols-2'>
                                        <Info icon={<Clock3 className='h-4 w-4' />} label='Last / next' value={`${timeLabel(job.lastRunAt)} / ${timeLabel(job.nextRunAt)}`} />
                                        <Info icon={<Activity className='h-4 w-4' />} label='Runtime' value={`${duration(job.currentRunDurationMs) || 'not running'} current; ${duration(job.averageRuntimeMs) || 'measuring'} avg`} />
                                        <Info icon={<AlertTriangle className='h-4 w-4' />} label='Failures' value={job.failureCount ? `${job.failureCount}: ${job.lastError || 'See logs'}` : 'Failure monitor clear'} />
                                        <Info icon={<Cpu className='h-4 w-4' />} label='Resources' value={resourceLabel(job)} />
                                        <Info icon={<Zap className='h-4 w-4' />} label='Cost' value={`${money(job.costEstimate.hourlyUsd)}/hr · ${money(job.costEstimate.dailyUsd)}/day`} />
                                        <Info icon={<FileText className='h-4 w-4' />} label='Control' value={controlLabel(job)} />
                                    </div>

                                    <Info icon={<TerminalSquare className='h-4 w-4' />} label='Log' value={job.logExcerpt || 'Log stream live; no recent line.'} mono />

                                    <div className='flex flex-wrap gap-2'>
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
                                </DashboardPanel>
                            ))}
                        </div>
                    </section>
                )
            })}
        </div>
    )
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

function Stat({ label, value, icon, tone }: { label: string, value: string, icon: ReactNode, tone?: 'ok' | 'bad' }) {
    const color = tone === 'bad' ? 'text-ui-danger' : tone === 'ok' ? 'text-ui-success' : 'text-ui-text'
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <p className='text-[11px] font-semibold uppercase'>{label}</p>
            </div>
            <p className={`mt-1 text-sm font-semibold ${color}`}>{value}</p>
        </div>
    )
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
