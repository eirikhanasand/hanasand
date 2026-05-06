'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CalendarClock, CheckCircle2, PauseCircle, RefreshCcw, Save, ServerCog, TerminalSquare } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { fetchManagedCronJobs, updateManagedCronJob, type ManagedCronJob } from '@/utils/systemCron/client'

export default function CronJobsClient() {
    const [jobs, setJobs] = useState<ManagedCronJob[]>([])
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const enabledCount = useMemo(() => jobs.filter(job => job.enabled).length, [jobs])

    useEffect(() => {
        void load()
    }, [])

    async function load() {
        setBusy('load')
        try {
            const payload = await fetchManagedCronJobs()
            setJobs(payload.jobs)
            setDrafts(Object.fromEntries(payload.jobs.map(job => [job.id, job.schedule])))
            setMessage('Cron jobs loaded.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load cron jobs.')
        } finally {
            setBusy('')
        }
    }

    async function save(job: ManagedCronJob, patch: { enabled?: boolean } = {}) {
        setBusy(job.id)
        try {
            const payload = await updateManagedCronJob(job.id, {
                schedule: drafts[job.id] || job.schedule,
                ...patch,
            })
            setJobs(payload.jobs)
            setDrafts(Object.fromEntries(payload.jobs.map(item => [item.id, item.schedule])))
            setMessage(`${job.name} saved.`)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to update cron job.')
        } finally {
            setBusy('')
        }
    }

    return (
        <div className='grid gap-3'>
            <DashboardPanel className='grid gap-3 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex flex-wrap gap-2'>
                        <Stat label='Managed' value={`${jobs.length}`} />
                        <Stat label='Enabled' value={`${enabledCount}`} />
                        <Stat label='Host' value={jobs[0]?.host || '—'} />
                    </div>
                    <button onClick={() => void load()} className='inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/6 px-3 text-sm font-semibold text-bright/70 hover:bg-white/10'>
                        <RefreshCcw className='h-4 w-4' />
                        {busy === 'load' ? 'Refreshing' : 'Refresh'}
                    </button>
                </div>
                {message ? <p className='text-sm text-bright/48'>{message}</p> : null}
            </DashboardPanel>

            <div className='grid gap-3 xl:grid-cols-2'>
                {jobs.map(job => (
                    <DashboardPanel key={job.id} className='grid gap-3 p-4'>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <div className='flex items-center gap-2'>
                                    <ServerCog className='h-4 w-4 text-bright/46' />
                                    <h2 className='truncate text-base font-semibold text-bright'>{job.name}</h2>
                                </div>
                                <p className='mt-1 text-sm leading-5 text-bright/46'>{job.description}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${job.enabled ? 'bg-emerald-400/12 text-emerald-100' : 'bg-white/8 text-bright/50'}`}>
                                {job.enabled ? 'Enabled' : 'Paused'}
                            </span>
                        </div>

                        <label className='grid gap-1'>
                            <span className='text-xs font-semibold uppercase text-bright/34'>Schedule</span>
                            <div className='flex gap-2'>
                                <input
                                    value={drafts[job.id] ?? job.schedule}
                                    onChange={event => setDrafts(current => ({ ...current, [job.id]: event.target.value }))}
                                    className='min-h-10 flex-1 rounded-lg border border-white/10 bg-black/24 px-3 font-mono text-sm text-bright outline-none focus:border-white/24'
                                />
                                <button onClick={() => void save(job)} className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/6 text-bright/70 hover:bg-white/10' title='Save schedule'>
                                    <Save className='h-4 w-4' />
                                </button>
                            </div>
                        </label>

                        <div className='grid gap-2 text-sm text-bright/48'>
                            <Info icon={<CalendarClock className='h-4 w-4' />} label='Default' value={job.defaultSchedule} />
                            <Info icon={<TerminalSquare className='h-4 w-4' />} label='Command' value={job.command} mono />
                            <Info icon={job.enabled ? <CheckCircle2 className='h-4 w-4' /> : <PauseCircle className='h-4 w-4' />} label='Log' value={job.lastLogLine || 'No log line found.'} />
                            <Info icon={<CalendarClock className='h-4 w-4' />} label='Updated' value={job.lastLogAt ? new Date(job.lastLogAt).toLocaleString() : 'No log timestamp'} />
                        </div>

                        <div className='flex flex-wrap gap-2'>
                            <button onClick={() => void save(job, { enabled: !job.enabled })} className='inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/6 px-3 text-sm font-semibold text-bright/70 hover:bg-white/10'>
                                {job.enabled ? <PauseCircle className='h-4 w-4' /> : <CheckCircle2 className='h-4 w-4' />}
                                {busy === job.id ? 'Saving' : job.enabled ? 'Pause' : 'Enable'}
                            </button>
                        </div>
                    </DashboardPanel>
                ))}
            </div>
        </div>
    )
}

function Stat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2'>
            <p className='text-[11px] font-semibold uppercase text-bright/34'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-bright/80'>{value}</p>
        </div>
    )
}

function Info({ icon, label, value, mono = false }: { icon: ReactNode, label: string, value: string, mono?: boolean }) {
    return (
        <div className='grid gap-1 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
            <div className='flex items-center gap-2 text-bright/40'>
                {icon}
                <span className='text-xs font-semibold uppercase'>{label}</span>
            </div>
            <p className={`${mono ? 'font-mono text-xs' : 'text-sm'} break-words text-bright/56`}>{value}</p>
        </div>
    )
}
