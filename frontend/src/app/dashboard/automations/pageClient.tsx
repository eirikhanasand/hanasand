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
const dwmWebhookDraftKey = 'hanasand:dwm-webhook-subscription'
const draftSelectionId = '__new_alert_draft__'
const inputClass = 'rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
const newAutomationDraft = (prompt = ''): AutomationPayload => ({
    name: 'Company exposure watch',
    prompt,
    scheduleKind: 'interval',
    intervalMinutes: 30,
    runAt: defaultRunAt(),
    status: 'active',
    actionType: 'agent_prompt',
    timezone: defaultTimezone(),
    modelName: null,
    notifyOn: 'failure',
})

type DwmWebhookDraft = {
    id: string
    endpoint: string
    terms: string[]
    createdAt?: string
    payload?: unknown
}

export default function AutomationsClient() {
    const [automations, setAutomations] = useState<AgentAutomation[]>([])
    const [runs, setRuns] = useState<AgentAutomationRun[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [busy, setBusy] = useState('')
    const [status, setStatus] = useState('')
    const [webhookDraft, setWebhookDraft] = useState<DwmWebhookDraft | null>(null)
    const [draft, setDraft] = useState<AutomationPayload>(newAutomationDraft('Check the watchlist for new company, domain, vendor, or actor mentions and summarize any alert-worthy matches.'))

    const selected = useMemo(() => automations.find(item => item.id === selectedId) || null, [automations, selectedId])
    const activeAutomationCount = useMemo(() => automations.filter(item => item.status === 'active').length, [automations])

    useEffect(() => {
        const nextWebhookDraft = readWebhookDraft()
        if (nextWebhookDraft) {
            setWebhookDraft(nextWebhookDraft)
            setDraft(draftFromWebhook(nextWebhookDraft))
            setSelectedId('')
            setRuns([])
            setStatus('Webhook alert is ready. Review the schedule and create it to start monitoring.')
        }
        void load(nextWebhookDraft ? draftSelectionId : undefined)
    }, [])

    async function load(selectId: string | undefined = selectedId) {
        setBusy('load')
        try {
            const payload = await fetchAutomations()
            const nextAutomations = Array.isArray(payload.automations) ? payload.automations : []
            setAutomations(nextAutomations)
            const nextSelected = selectId === draftSelectionId ? '' : selectId || nextAutomations[0]?.id || ''
            setSelectedId(nextSelected)
            if (nextSelected) {
                const details = await fetchAutomation(nextSelected)
                setRuns(Array.isArray(details.runs) ? details.runs : [])
            } else {
                setRuns([])
            }
            setStatus('Loaded alert schedules.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to load alert schedules.')
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
            if (!selected && webhookDraft) {
                if (typeof window !== 'undefined') window.localStorage.removeItem(dwmWebhookDraftKey)
                setWebhookDraft(null)
            }
            setSelectedId(payload.automation.id)
            setDraft(toDraft(payload.automation))
            await load(payload.automation.id)
            setStatus(selected ? 'Alert schedule updated.' : 'Alert schedule created.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to save alert schedule.')
        } finally {
            setBusy('')
        }
    }

    async function removeAutomation(id: string) {
        setBusy(`delete-${id}`)
        try {
            await deleteAutomation(id)
            setAutomations(current => current.filter(item => item.id !== id))
            setSelectedId('')
            setRuns([])
            setDraft(newAutomationDraft())
            await load('')
            setStatus('Alert schedule removed.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to remove alert schedule.')
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
        setDraft(newAutomationDraft())
        setStatus('Draft ready.')
    }

    function useWebhookDraft() {
        if (!webhookDraft) return
        setSelectedId('')
        setRuns([])
        setDraft(draftFromWebhook(webhookDraft))
        setStatus('Webhook alert is ready. Review the schedule and create it to start monitoring.')
    }

    function clearWebhookDraft() {
        if (typeof window !== 'undefined') window.localStorage.removeItem(dwmWebhookDraftKey)
        setWebhookDraft(null)
        setStatus('Saved webhook setup cleared.')
    }

    function cancelDraft() {
        if (selected) {
            setDraft(toDraft(selected))
            setStatus('Changes discarded.')
            return
        }

        setDraft(newAutomationDraft())
        setStatus('Draft reset.')
    }

    return (
        <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]'>
            <section className='rounded-lg border border-[#dfe5ee] bg-white p-2 shadow-sm'>
                <div className='mb-2 flex items-center justify-between gap-2 px-2 py-1'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Scheduled</p>
                        <h2 className='text-sm font-semibold text-[#171a21]'>{activeAutomationCount}/{maxActiveAutomations} active alerts</h2>
                    </div>
                    <button type='button' className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dee9] bg-[#f8fafc] text-[#3056d3] hover:bg-[#eef3ff]' onClick={newAutomation} title='New alert' aria-label='New alert'>
                        <Plus className='h-4 w-4' />
                    </button>
                </div>
                <div className='grid gap-2'>
                    {automations.map(automation => (
                        <button
                            key={automation.id}
                            className={`rounded-lg border p-3 text-left transition ${automation.id === selectedId ? 'border-[#b8c5ff] bg-[#f4f7ff]' : 'border-[#e0e5ed] bg-[#fbfcfe] hover:bg-[#f4f7ff]'}`}
                            onClick={() => void selectAutomation(automation)}
                        >
                            <div className='flex items-center justify-between gap-2'>
                                <span className='truncate text-sm font-semibold text-[#171a21]'>{automation.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${automation.status === 'active' ? 'bg-[#e9f8ef] text-[#147a3b]' : 'bg-[#eef1f5] text-[#596170]'}`}>{automation.status}</span>
                            </div>
                            <p className='mt-2 line-clamp-2 text-xs leading-5 text-[#596170]'>{automation.prompt}</p>
                            <p className='mt-2 text-[11px] text-[#8c95a5]'>{formatSchedule(automation)}</p>
                        </button>
                    ))}
                    {!automations.length && <p className='p-3 text-sm text-[#596170]'>No alert schedules yet.</p>}
                </div>
            </section>

            <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                <div className='grid gap-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Editor</p>
                            <h2 className='text-lg font-semibold text-[#171a21]'>{selected ? selected.name : 'New alert schedule'}</h2>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <IconButton label='Refresh' icon={<RefreshCw className='h-4 w-4' />} onClick={() => void load()} />
                            {selected && <IconButton label='Run now' icon={<Play className='h-4 w-4' />} onClick={() => void runNow(selected.id)} disabled={busy.startsWith('run-')} />}
                            {selected && <IconButton label='Delete' icon={<Trash2 className='h-4 w-4' />} tone='danger' onClick={() => void removeAutomation(selected.id)} disabled={busy.startsWith('delete-')} />}
                        </div>
                    </div>

                    {webhookDraft && (
                        <div className='rounded-lg border border-[#b8c5ff] bg-[#f4f7ff] p-4'>
                            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Dark web monitoring</p>
                                    <h3 className='mt-1 text-sm font-semibold text-[#171a21]'>Webhook alert ready to create</h3>
                                    <p className='mt-1 text-sm leading-6 text-[#3d4656]'>
                                        Watch {formatTerms(webhookDraft.terms)} and send matching company exposure alerts to {redactWebhookEndpoint(webhookDraft.endpoint)}.
                                    </p>
                                </div>
                                <div className='flex shrink-0 flex-wrap gap-2'>
                                    <button type='button' onClick={useWebhookDraft} className='rounded-lg bg-[#171a21] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                                        Apply setup
                                    </button>
                                    <button type='button' onClick={clearWebhookDraft} className='rounded-lg border border-[#ccd6ea] bg-white px-3 py-2 text-sm font-semibold text-[#596170] hover:border-[#aebbd1] hover:text-[#171a21]'>
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className='grid gap-3 md:grid-cols-2'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Name</span>
                            <input className={inputClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Check type</span>
                            <select className={inputClass} value={draft.actionType} onChange={event => setDraft({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}>
                                <option value='agent_prompt'>Monitoring check</option>
                                <option value='echo'>Delivery test</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Routing preference</span>
                            <input className={inputClass} value={draft.modelName || ''} placeholder='Auto' onChange={event => setDraft({ ...draft, modelName: event.target.value.trim() || null })} />
                        </label>
                    </div>

                    <label className='grid gap-1.5'>
                        <span className='text-xs font-medium text-[#596170]'>Alert instructions</span>
                        <textarea className={`${inputClass} min-h-32 leading-6`} value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} />
                    </label>

                    <div className='grid gap-3 md:grid-cols-5'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Schedule</span>
                            <select className={inputClass} value={draft.scheduleKind} onChange={event => setDraft({ ...draft, scheduleKind: event.target.value as AutomationPayload['scheduleKind'] })}>
                                <option value='interval'>Recurring</option>
                                <option value='once'>Once</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Every minutes</span>
                            <input className={`${inputClass} disabled:opacity-45`} type='number' min={1} disabled={draft.scheduleKind !== 'interval'} value={draft.intervalMinutes || 30} onChange={event => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Run at</span>
                            <input className={`${inputClass} disabled:opacity-45`} type='datetime-local' disabled={draft.scheduleKind !== 'once'} value={draft.runAt || defaultRunAt()} onChange={event => setDraft({ ...draft, runAt: event.target.value })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Status</span>
                            <select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AutomationPayload['status'] })}>
                                <option value='active'>Active</option>
                                <option value='paused'>Paused</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Timezone</span>
                            <input className={inputClass} value={draft.timezone || 'UTC'} onChange={event => setDraft({ ...draft, timezone: event.target.value })} />
                        </label>
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Notify</span>
                            <select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => setDraft({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}>
                                <option value='failure'>Failures</option>
                                <option value='always'>Every run</option>
                                <option value='never'>Never</option>
                            </select>
                        </label>
                        {selected?.pausedReason && (
                            <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900'>
                                {selected.pausedReason}
                            </div>
                        )}
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                        <button type='button' className='inline-flex items-center gap-2 rounded-lg bg-[#171a21] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2b2f39] disabled:opacity-50' onClick={() => void saveAutomation()} disabled={busy === 'save'}>
                            <WandSparkles className='h-4 w-4' />
                            {selected ? 'Save changes' : 'Create alert'}
                        </button>
                        <button type='button' className='rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#596170] hover:border-[#bdc7d5] hover:text-[#171a21]' onClick={cancelDraft} disabled={busy === 'save'}>
                            Cancel
                        </button>
                        {status && <span className='text-sm text-[#596170]'>{status}</span>}
                    </div>

                    {selected && (
                        <div className='grid gap-3 border-t border-[#eef1f5] pt-4'>
                            <div className='grid gap-2 sm:grid-cols-3'>
                                <InfoCard icon={<CalendarClock className='h-4 w-4' />} label='Next run' value={formatDate(selected.nextRunAt)} />
                                <InfoCard icon={<Pause className='h-4 w-4' />} label='Last status' value={`${selected.lastStatus || 'No runs'}${selected.consecutiveFailures ? ` · ${selected.consecutiveFailures} failures` : ''}`} />
                                <InfoCard icon={<Play className='h-4 w-4' />} label='Runs' value={`${selected.runCount}`} />
                            </div>
                            <div className='grid gap-2'>
                                {runs.map(run => (
                                    <div key={run.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                        <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]'>
                                            <span>{formatDate(run.startedAt)}</span>
                                            <span>{run.status}{run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}</span>
                                        </div>
                                        {run.status === 'failed'
                                            ? <ErrorNotice compact className='mt-2' message={run.error || run.result || 'Run failed.'} />
                                            : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d4656]'>{run.result || 'Running...'}</p>}
                                    </div>
                                ))}
                                {!runs.length && <p className='text-sm text-[#596170]'>No delivery history yet.</p>}
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
        <button type='button' title={label} disabled={disabled} onClick={onClick} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-[#d8dee9] bg-white text-[#596170] hover:border-[#bdc7d5] hover:text-[#171a21]'}`}>
            {icon}
            {label}
        </button>
    )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <div className='mb-2 text-[#3056d3]'>{icon}</div>
            <p className='text-[11px] uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-[#171a21]'>{value}</p>
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

function readWebhookDraft(): DwmWebhookDraft | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(dwmWebhookDraftKey)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<DwmWebhookDraft>
        if (!parsed.id || !parsed.endpoint || !Array.isArray(parsed.terms) || !parsed.terms.length) return null
        return {
            id: parsed.id,
            endpoint: parsed.endpoint,
            terms: parsed.terms.map(term => String(term).trim()).filter(Boolean),
            createdAt: parsed.createdAt,
            payload: parsed.payload,
        }
    } catch {
        return null
    }
}

function draftFromWebhook(subscription: DwmWebhookDraft): AutomationPayload {
    const terms = subscription.terms.map(term => term.trim()).filter(Boolean)
    return {
        ...newAutomationDraft([
            `Watch these companies, domains, vendors, and products for new ransomware or extortion mentions: ${terms.join(', ')}.`,
            `Send matching alerts to this HTTPS webhook endpoint: ${subscription.endpoint}.`,
            'Include actor, company, matchedTerm, claimSummary, claimedAt, sourceName, sourceUrl, confidence, recommendedAction, and pivots.',
            'Only send new or materially updated matches that need review.',
        ].join('\n')),
        name: 'Dark web monitoring webhook',
        intervalMinutes: 15,
        modelName: 'webhook',
        notifyOn: 'always',
    }
}

function redactWebhookEndpoint(endpoint: string) {
    try {
        const url = new URL(endpoint)
        const path = url.pathname.length > 28 ? `${url.pathname.slice(0, 24)}...` : url.pathname
        return `${url.origin}${path}`
    } catch {
        return 'saved HTTPS endpoint'
    }
}

function formatTerms(terms: string[]) {
    const cleaned = terms.map(term => term.trim()).filter(Boolean)
    if (cleaned.length <= 3) return cleaned.join(', ')
    return `${cleaned.slice(0, 3).join(', ')} and ${cleaned.length - 3} more`
}

function formatDate(value?: string | null) {
    if (!value) return 'Not scheduled'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatSchedule(automation: AgentAutomation) {
    if (automation.scheduleKind === 'once') return `Once · ${formatDate(automation.runAt)}`
    return `Every ${automation.intervalMinutes || 0} min · next ${formatDate(automation.nextRunAt)} · ${automation.timezone || 'UTC'}`
}
