'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Pause, Play, Plus, RefreshCw, Trash2, WandSparkles } from 'lucide-react'
import {
    createAutomation,
    deleteAutomation,
    fetchAutomation,
    fetchAutomations,
    runAutomationNow,
    updateAutomation,
    type AgentAutomation,
    type AgentAutomationRun,
    type AutomationPayload,
} from '@/utils/automations/client'
import ErrorNotice from '@/components/error/errorNotice'

const defaultRunAt = () => new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)
const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const maxActiveAutomations = 10

export default function AutomationsClient() {
    const [automations, setAutomations] = useState<AgentAutomation[]>([])
    const [runs, setRuns] = useState<AgentAutomationRun[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [busy, setBusy] = useState('')
    const [status, setStatus] = useState('')
    const [draft, setDraft] = useState<AutomationPayload>({
        name: 'Check in later',
        prompt: 'Review the current task and summarize what changed since the last check.',
        scheduleKind: 'interval',
        intervalMinutes: 30,
        runAt: defaultRunAt(),
        status: 'active',
        actionType: 'agent_prompt',
        timezone: defaultTimezone(),
        modelName: null,
        notifyOn: 'failure',
    })

    const selected = useMemo(() => automations.find(item => item.id === selectedId) || null, [automations, selectedId])
    const activeAutomationCount = useMemo(() => automations.filter(item => item.status === 'active').length, [automations])

    useEffect(() => {
        void load()
    }, [])

    async function load(selectId = selectedId) {
        setBusy('load')
        try {
            const payload = await fetchAutomations()
            setAutomations(payload.automations)
            const nextSelected = selectId || payload.automations[0]?.id || ''
            setSelectedId(nextSelected)
            if (nextSelected) {
                const details = await fetchAutomation(nextSelected)
                setRuns(details.runs)
            } else {
                setRuns([])
            }
            setStatus('Loaded automations.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to load automations.')
        } finally {
            setBusy('')
        }
    }

    async function selectAutomation(automation: AgentAutomation) {
        setSelectedId(automation.id)
        setDraft(toDraft(automation))
        setBusy(`select-${automation.id}`)
        try {
            const details = await fetchAutomation(automation.id)
            setRuns(details.runs)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to load runs.')
        } finally {
            setBusy('')
        }
    }

    async function saveAutomation() {
        setBusy('save')
        try {
            const payload = selected
                ? await updateAutomation(selected.id, draft)
                : await createAutomation(draft)
            setSelectedId(payload.automation.id)
            setDraft(toDraft(payload.automation))
            await load(payload.automation.id)
            setStatus(selected ? 'Automation updated.' : 'Automation created.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to save automation.')
        } finally {
            setBusy('')
        }
    }

    async function removeAutomation(id: string) {
        setBusy(`delete-${id}`)
        try {
            await deleteAutomation(id)
            setSelectedId('')
            setDraft({
                ...draft,
                name: 'Check in later',
                prompt: '',
            })
            await load('')
            setStatus('Automation removed.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to remove automation.')
        } finally {
            setBusy('')
        }
    }

    async function runNow(id: string) {
        setBusy(`run-${id}`)
        try {
            await runAutomationNow(id)
            await load(id)
            setStatus('Run queued. Refresh in a moment to see the result.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to queue run.')
        } finally {
            setBusy('')
        }
    }

    function newAutomation() {
        setSelectedId('')
        setRuns([])
        setDraft({
            name: 'Check in later',
            prompt: '',
            scheduleKind: 'interval',
            intervalMinutes: 30,
            runAt: defaultRunAt(),
            status: 'active',
            actionType: 'agent_prompt',
            timezone: defaultTimezone(),
            modelName: null,
            notifyOn: 'failure',
        })
    }

    return (
        <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]'>
            <section className='rounded-xl border border-bright/10 bg-background/82 p-2 backdrop-blur-md'>
                <div className='mb-2 flex items-center justify-between gap-2 px-2 py-1'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-bright/32'>Scheduled</p>
                        <h2 className='text-sm font-semibold text-bright/86'>{activeAutomationCount}/{maxActiveAutomations} active</h2>
                    </div>
                    <button className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-bright/72 hover:bg-white/10' onClick={newAutomation} title='New automation'>
                        <Plus className='h-4 w-4' />
                    </button>
                </div>
                <div className='grid gap-2'>
                    {automations.map(automation => (
                        <button
                            key={automation.id}
                            className={`rounded-lg border p-3 text-left transition ${automation.id === selectedId ? 'border-white/18 bg-white/10' : 'border-white/8 bg-white/4 hover:bg-white/7'}`}
                            onClick={() => void selectAutomation(automation)}
                        >
                            <div className='flex items-center justify-between gap-2'>
                                <span className='truncate text-sm font-semibold text-bright'>{automation.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${automation.status === 'active' ? 'bg-emerald-400/12 text-emerald-100' : 'bg-white/8 text-bright/52'}`}>{automation.status}</span>
                            </div>
                            <p className='mt-2 line-clamp-2 text-xs leading-5 text-bright/48'>{automation.prompt}</p>
                            <p className='mt-2 text-[11px] text-bright/36'>{formatSchedule(automation)}</p>
                        </button>
                    ))}
                    {!automations.length && <p className='p-3 text-sm text-bright/48'>No automations yet.</p>}
                </div>
            </section>

            <section className='rounded-xl border border-bright/10 bg-background/82 p-4 backdrop-blur-md'>
                <div className='grid gap-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase tracking-[0.24em] text-bright/32'>Editor</p>
                            <h2 className='text-lg font-semibold text-bright'>{selected ? selected.name : 'New automation'}</h2>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <IconButton label='Refresh' icon={<RefreshCw className='h-4 w-4' />} onClick={() => void load()} />
                            {selected && <IconButton label='Run now' icon={<Play className='h-4 w-4' />} onClick={() => void runNow(selected.id)} disabled={busy.startsWith('run-')} />}
                            {selected && <IconButton label='Delete' icon={<Trash2 className='h-4 w-4' />} tone='danger' onClick={() => void removeAutomation(selected.id)} disabled={busy.startsWith('delete-')} />}
                        </div>
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Name</span>
                            <input className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Task type</span>
                            <select className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.actionType} onChange={event => setDraft({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}>
                                <option value='agent_prompt'>Agent prompt</option>
                                <option value='echo'>Echo test</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Model preference</span>
                            <input className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.modelName || ''} placeholder='Auto' onChange={event => setDraft({ ...draft, modelName: event.target.value.trim() || null })} />
                        </label>
                    </div>

                    <label className='grid gap-1.5'>
                        <span className='text-xs font-medium text-bright/56'>Prompt</span>
                        <textarea className='min-h-32 rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm leading-6 text-bright outline-none focus:border-white/24' value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} />
                    </label>

                    <div className='grid gap-3 md:grid-cols-5'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Schedule</span>
                            <select className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.scheduleKind} onChange={event => setDraft({ ...draft, scheduleKind: event.target.value as AutomationPayload['scheduleKind'] })}>
                                <option value='interval'>Recurring</option>
                                <option value='once'>Once</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Every minutes</span>
                            <input className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24 disabled:opacity-45' type='number' min={1} disabled={draft.scheduleKind !== 'interval'} value={draft.intervalMinutes || 30} onChange={event => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Run at</span>
                            <input className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24 disabled:opacity-45' type='datetime-local' disabled={draft.scheduleKind !== 'once'} value={draft.runAt || defaultRunAt()} onChange={event => setDraft({ ...draft, runAt: event.target.value })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Status</span>
                            <select className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AutomationPayload['status'] })}>
                                <option value='active'>Active</option>
                                <option value='paused'>Paused</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Timezone</span>
                            <input className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.timezone || 'UTC'} onChange={event => setDraft({ ...draft, timezone: event.target.value })} />
                        </label>
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-bright/56'>Notify</span>
                            <select className='rounded-lg border border-white/10 bg-black/24 px-3 py-2 text-sm text-bright outline-none focus:border-white/24' value={draft.notifyOn || 'failure'} onChange={event => setDraft({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}>
                                <option value='failure'>Failures</option>
                                <option value='always'>Every run</option>
                                <option value='never'>Never</option>
                            </select>
                        </label>
                        {selected?.pausedReason && (
                            <div className='rounded-lg border border-amber-300/18 bg-amber-400/8 p-3 text-sm leading-6 text-amber-100/82'>
                                {selected.pausedReason}
                            </div>
                        )}
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                        <button className='inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/10 px-3 py-2 text-sm font-semibold text-bright hover:bg-white/14 disabled:opacity-50' onClick={() => void saveAutomation()} disabled={busy === 'save'}>
                            <WandSparkles className='h-4 w-4' />
                            {selected ? 'Save changes' : 'Create automation'}
                        </button>
                        {status && <span className='text-sm text-bright/48'>{status}</span>}
                    </div>

                    {selected && (
                        <div className='grid gap-3 border-t border-white/8 pt-4'>
                            <div className='grid gap-2 sm:grid-cols-3'>
                                <InfoCard icon={<CalendarClock className='h-4 w-4' />} label='Next run' value={formatDate(selected.nextRunAt)} />
                                <InfoCard icon={<Pause className='h-4 w-4' />} label='Last status' value={`${selected.lastStatus || 'No runs'}${selected.consecutiveFailures ? ` · ${selected.consecutiveFailures} failures` : ''}`} />
                                <InfoCard icon={<Play className='h-4 w-4' />} label='Runs' value={`${selected.runCount}`} />
                            </div>
                            <div className='grid gap-2'>
                                {runs.map(run => (
                                    <div key={run.id} className='rounded-lg border border-white/8 bg-white/4 p-3'>
                                        <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-bright/42'>
                                            <span>{formatDate(run.startedAt)}</span>
                                            <span>{run.status}{run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}</span>
                                        </div>
                                        {run.status === 'failed'
                                            ? <ErrorNotice compact className='mt-2' message={run.error || run.result || 'Run failed.'} />
                                            : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-bright/72'>{run.result || 'Running...'}</p>}
                                    </div>
                                ))}
                                {!runs.length && <p className='text-sm text-bright/48'>No run history yet.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

function IconButton({ label, icon, onClick, tone = 'default', disabled = false }: { label: string, icon: React.ReactNode, onClick: () => void, tone?: 'default' | 'danger', disabled?: boolean }) {
    return (
        <button title={label} disabled={disabled} onClick={onClick} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50 ${tone === 'danger' ? 'border-red-300/20 bg-red-400/10 text-red-100' : 'border-white/10 bg-white/6 text-bright/72 hover:bg-white/10'}`}>
            {icon}
            {label}
        </button>
    )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-lg border border-white/8 bg-white/4 p-3'>
            <div className='mb-2 text-bright/44'>{icon}</div>
            <p className='text-[11px] uppercase tracking-[0.18em] text-bright/32'>{label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-bright/76'>{value}</p>
        </div>
    )
}

function toDraft(automation: AgentAutomation): AutomationPayload {
    return {
        name: automation.name,
        prompt: automation.prompt,
        scheduleKind: automation.scheduleKind,
        intervalMinutes: automation.intervalMinutes || 30,
        runAt: automation.runAt ? new Date(automation.runAt).toISOString().slice(0, 16) : defaultRunAt(),
        status: automation.status === 'paused' ? 'paused' : 'active',
        actionType: automation.actionType,
        timezone: automation.timezone || defaultTimezone(),
        modelName: automation.modelName || null,
        notifyOn: automation.notifyOn || 'failure',
    }
}

function formatDate(value?: string | null) {
    if (!value) return 'Not scheduled'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatSchedule(automation: AgentAutomation) {
    if (automation.scheduleKind === 'once') return `Once · ${formatDate(automation.runAt)}`
    return `Every ${automation.intervalMinutes || 0} min · next ${formatDate(automation.nextRunAt)} · ${automation.timezone || 'UTC'}`
}
