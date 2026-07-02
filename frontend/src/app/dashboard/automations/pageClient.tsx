'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Play, Plus, RefreshCw, Send, Trash2, WandSparkles } from 'lucide-react'
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
    runAt: '',
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

export default function AutomationsClient({ setup }: { setup?: 'dwm' }) {
    const initialSetup = setup === 'dwm' || readSetupIntent() === 'dwm'
    const [automations, setAutomations] = useState<AgentAutomation[]>([])
    const [runs, setRuns] = useState<AgentAutomationRun[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [busy, setBusy] = useState('')
    const [status, setStatus] = useState('')
    const [webhookDraft, setWebhookDraft] = useState<DwmWebhookDraft | null>(null)
    const [draft, setDraft] = useState<AutomationPayload>(() => initialSetup
        ? dwmFallbackDraft()
        : newAutomationDraft('Check the watchlist for new company, domain, vendor, or actor mentions and summarize any alert-worthy matches.'))

    const selected = useMemo(() => automations.find(item => item.id === selectedId) || null, [automations, selectedId])
    const activeAutomationCount = useMemo(() => automations.filter(item => item.status === 'active').length, [automations])
    const selectedHealth = selected ? routeHealthFor(selected) : routeHealthForDraft(draft)
    const routeIssueCount = automations.reduce((count, item) => count + (item.consecutiveFailures ? 1 : 0), 0)
    const lastRun = runs[0]

    useEffect(() => {
        const nextWebhookDraft = readWebhookDraft()
        const setupIntent = setup || readSetupIntent()
        if (nextWebhookDraft) {
            setWebhookDraft(nextWebhookDraft)
            setDraft(draftFromWebhook(nextWebhookDraft))
            setSelectedId('')
            setRuns([])
            setStatus('Webhook route loaded. Review cadence, detection terms, and delivery channel.')
        } else if (setupIntent === 'dwm') {
            setDraft(dwmFallbackDraft())
            setSelectedId('')
            setRuns([])
            setStatus('DWM delivery draft loaded. Add the endpoint and create the route.')
        }
        void load(nextWebhookDraft ? draftSelectionId : undefined)
    }, [setup])

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
            setStatus('Loaded alert settings.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to load alert settings.')
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
            const payloadToSave = {
                ...draft,
                runAt: draft.runAt || defaultRunAt(),
            }
            const payload = selected
                ? await updateAutomation(selected.id, payloadToSave)
                : await createAutomation(payloadToSave)
            if (!selected && webhookDraft) {
                clearStoredWebhookDraft()
                setWebhookDraft(null)
            }
            setSelectedId(payload.automation.id)
            setDraft(toDraft(payload.automation))
            await load(payload.automation.id)
            setStatus(selected ? 'Alert updated.' : 'Alert created.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to save alert settings.')
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
            setStatus('Alert removed.')
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to remove alert.')
        } finally {
            setBusy('')
        }
    }

    async function runNow(id: string) {
        setBusy(`run-${id}`)
        try {
            await runAutomationNow(id)
            await load(id)
            setStatus('Delivery check queued. Refresh in a moment to see the result.')
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
        setStatus('Webhook route loaded. Review cadence, detection terms, and delivery channel.')
    }

    function clearWebhookDraft() {
        clearStoredWebhookDraft()
        setWebhookDraft(null)
        setStatus('Saved webhook route cleared.')
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
                        <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Delivery routes</p>
                        <h2 className='text-sm font-semibold text-[#171a21]'>{activeAutomationCount}/{maxActiveAutomations} active</h2>
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
                            <div className='mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#667085]'>
                                <QueueFact label='Next' value={shortDate(automation.nextRunAt || automation.runAt)} />
                                <QueueFact label='Last' value={automation.lastStatus || 'none'} tone={automation.consecutiveFailures ? 'bad' : automation.lastStatus === 'completed' ? 'ok' : 'neutral'} />
                                <QueueFact label='Cadence' value={scheduleShort(automation)} />
                                <QueueFact label='Issues' value={String(automation.consecutiveFailures || 0)} tone={automation.consecutiveFailures ? 'bad' : 'ok'} />
                            </div>
                            <p className='mt-2 truncate text-[11px] text-[#8c95a5]'>{deliveryTargetLabel(automation.modelName, automation.actionType)}</p>
                        </button>
                    ))}
                    {!automations.length && <p className='p-3 text-sm leading-6 text-[#596170]'>No delivery routes yet. Create one to send watchlist matches to a webhook or review queue.</p>}
                </div>
            </section>

            <section className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                <div className='grid gap-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Delivery control</p>
                            <h2 className='text-lg font-semibold text-[#171a21]'>{selected ? selected.name : 'New delivery route'}</h2>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <IconButton label='Refresh' icon={<RefreshCw className='h-4 w-4' />} onClick={() => void load()} />
                            {selected && <IconButton label='Check now' icon={<Play className='h-4 w-4' />} onClick={() => void runNow(selected.id)} disabled={busy.startsWith('run-')} />}
                            {selected && <IconButton label='Delete' icon={<Trash2 className='h-4 w-4' />} tone='danger' onClick={() => void removeAutomation(selected.id)} disabled={busy.startsWith('delete-')} />}
                        </div>
                    </div>

                    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                        <RouteMetric label='Route health' value={selectedHealth.label} detail={selectedHealth.detail} tone={selectedHealth.tone} icon={<DeliveryIcon status={selected?.lastStatus} failures={selected?.consecutiveFailures || 0} />} />
                        <RouteMetric label='Destination' value={draft.modelName || 'auto'} detail={draft.actionType === 'echo' ? 'delivery test' : 'monitoring check'} tone={draft.modelName ? 'ok' : 'neutral'} icon={<Send className='h-4 w-4' />} />
                        <RouteMetric label='Next check' value={selected ? shortDate(selected.nextRunAt || selected.runAt) : 'After save'} detail={scheduleShort(selected || draft)} tone='neutral' icon={<CalendarClock className='h-4 w-4' />} />
                        <RouteMetric label='Open issues' value={String(selected?.consecutiveFailures || routeIssueCount)} detail={lastRun?.error || selected?.pausedReason || 'delivery failures and paused routes'} tone={selected?.consecutiveFailures || routeIssueCount ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                    </div>

                    {webhookDraft && (
                        <div className='rounded-lg border border-[#b8c5ff] bg-[#f4f7ff] p-4'>
                            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Dark web monitoring</p>
                                    <h3 className='mt-1 text-sm font-semibold text-[#171a21]'>Webhook route ready to create</h3>
                                    <p className='mt-1 text-sm leading-6 text-[#3d4656]'>Watch {formatTerms(webhookDraft.terms)} and send matched exposure alerts to {redactWebhookEndpoint(webhookDraft.endpoint)}.</p>
                                </div>
                                <div className='flex shrink-0 flex-wrap gap-2'>
                                    <button type='button' onClick={useWebhookDraft} className='rounded-lg bg-[#171a21] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                                        Use route
                                    </button>
                                    <button type='button' onClick={clearWebhookDraft} className='rounded-lg border border-[#ccd6ea] bg-white px-3 py-2 text-sm font-semibold text-[#596170] hover:border-[#aebbd1] hover:text-[#171a21]'>
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!webhookDraft && initialSetup && (
                        <div className='rounded-lg border border-[#b8c5ff] bg-[#f4f7ff] p-4'>
                            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase text-[#3056d3]'>Dark web monitoring</p>
                                    <h3 className='mt-1 text-sm font-semibold text-[#171a21]'>Webhook route ready to create</h3>
                                    <p className='mt-1 text-sm leading-6 text-[#3d4656]'>The route is prefilled for company, domain, vendor, and product monitoring. Add the delivery endpoint, then create it.</p>
                                </div>
                                <button type='button' onClick={() => setStatus('Review the route and create it to start delivery.')} className='shrink-0 rounded-lg bg-[#171a21] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                                    Use route
                                </button>
                            </div>
                        </div>
                    )}

                    <section className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                        <div className='mb-3 flex items-center justify-between gap-3'>
                            <div>
                                <h3 className='text-sm font-semibold text-[#171a21]'>Route settings</h3>
                                <p className='mt-0.5 text-xs text-[#667085]'>Destination, route type, cadence, status, and notification policy.</p>
                            </div>
                            <span className={draft.status === 'active' ? 'rounded-full bg-[#e9f8ef] px-2 py-1 text-xs font-semibold text-[#147a3b]' : 'rounded-full bg-[#eef1f5] px-2 py-1 text-xs font-semibold text-[#596170]'}>
                                {draft.status}
                            </span>
                        </div>
                        <div className='grid gap-3 md:grid-cols-3'>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-[#596170]'>Route name</span>
                                <input className={inputClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-[#596170]'>Route type</span>
                                <select className={inputClass} value={draft.actionType} onChange={event => setDraft({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}>
                                    <option value='agent_prompt'>Monitoring check</option>
                                    <option value='echo'>Delivery test</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-[#596170]'>Destination</span>
                                <input className={inputClass} value={draft.modelName || ''} placeholder='Webhook, email, or review queue' onChange={event => setDraft({ ...draft, modelName: event.target.value.trim() || null })} />
                            </label>
                        </div>
                    </section>

                    <div className='grid gap-3 md:grid-cols-2 2xl:grid-cols-5'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Cadence</span>
                            <select className={inputClass} value={draft.scheduleKind} onChange={event => setDraft({ ...draft, scheduleKind: event.target.value as AutomationPayload['scheduleKind'] })}>
                                <option value='interval'>Recurring</option>
                                <option value='once'>Once</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Check every</span>
                            <input className={`${inputClass} disabled:opacity-45`} type='number' min={1} disabled={draft.scheduleKind !== 'interval'} value={draft.intervalMinutes || 30} onChange={event => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>First check</span>
                            <input className={`${inputClass} disabled:opacity-45`} type='datetime-local' disabled={draft.scheduleKind !== 'once'} value={draft.runAt || ''} onChange={event => setDraft({ ...draft, runAt: event.target.value })} />
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Status</span>
                            <select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AutomationPayload['status'] })}>
                                <option value='active'>Active</option>
                                <option value='paused'>Paused</option>
                            </select>
                        </label>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Notify</span>
                            <select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => setDraft({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}>
                                <option value='failure'>Delivery issues</option>
                                <option value='always'>Every check</option>
                                <option value='never'>Never</option>
                            </select>
                        </label>
                    </div>

                    <section className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-white p-3 lg:grid-cols-[1fr_0.55fr]'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Matching rules</span>
                            <textarea className={`${inputClass} min-h-28 leading-6`} value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} />
                        </label>
                        <div className='grid content-start gap-2 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 text-xs text-[#596170]'>
                            <RouteRule label='Terms' value={extractRuleTerms(draft.prompt)} />
                            <RouteRule label='Payload' value={draft.prompt.toLowerCase().includes('actor') && draft.prompt.toLowerCase().includes('matchedterm') ? 'actor + match fields' : 'custom fields'} />
                            <RouteRule label='Filter' value={draft.prompt.toLowerCase().includes('only send') ? 'new or updated matches' : 'all matches'} />
                            <RouteRule label='Destination' value={draft.modelName || 'auto'} />
                        </div>
                    </section>

                    <div className='grid gap-3 md:grid-cols-2'>
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-medium text-[#596170]'>Timezone</span>
                            <input className={inputClass} value={draft.timezone || 'UTC'} onChange={event => setDraft({ ...draft, timezone: event.target.value })} />
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
                            {selected ? 'Save route' : 'Create route'}
                        </button>
                        <button type='button' className='rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#596170] hover:border-[#bdc7d5] hover:text-[#171a21]' onClick={cancelDraft} disabled={busy === 'save'}>
                            Cancel
                        </button>
                        {status && <span className='text-sm text-[#596170]'>{status}</span>}
                    </div>

                    {selected && (
                        <div className='grid gap-3 border-t border-[#eef1f5] pt-4'>
                            <div className='grid gap-2 sm:grid-cols-4'>
                                <InfoCard icon={<CalendarClock className='h-4 w-4' />} label='Next check' value={formatDate(selected.nextRunAt)} />
                                <InfoCard icon={<DeliveryIcon status={selected.lastStatus} failures={selected.consecutiveFailures || 0} />} label='Latest result' value={`${selected.lastStatus || 'No checks'}${selected.consecutiveFailures ? ` · ${selected.consecutiveFailures} issues` : ''}`} />
                                <InfoCard icon={<Play className='h-4 w-4' />} label='Checks' value={`${selected.runCount}`} />
                                <InfoCard icon={<Clock3 className='h-4 w-4' />} label='Cadence' value={scheduleShort(selected)} />
                            </div>
                            <div className='grid gap-2'>
                                {runs.map(run => (
                                    <div key={run.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                        <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]'>
                                            <span>{formatDate(run.startedAt)}</span>
                                            <span className={run.status === 'failed' ? 'font-semibold text-[#9a3412]' : run.status === 'completed' ? 'font-semibold text-[#147a3b]' : 'font-semibold text-[#3056d3]'}>{run.status}{run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}</span>
                                        </div>
                                        {run.status === 'failed'
                                            ? <ErrorNotice compact className='mt-2' message={run.error || run.result || 'Run failed.'} />
                                            : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d4656]'>{run.result || 'Running...'}</p>}
                                    </div>
                                ))}
                                {!runs.length && <p className='text-sm leading-6 text-[#596170]'>No delivery history yet. Run the alert once or wait for the next check.</p>}
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

function RouteMetric({ icon, label, value, detail, tone }: { icon: React.ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'bad'
        ? 'border-[#ffd7c2] bg-[#fff7f3] text-[#9a3412]'
        : tone === 'ok'
            ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]'
            : 'border-[#e0e5ed] bg-[#fbfcfe] text-[#3056d3]'
    return (
        <div className={`rounded-lg border p-3 ${toneClass}`}>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-[10px] font-semibold uppercase opacity-80'>{label}</p>
                {icon}
            </div>
            <p className='mt-2 truncate text-lg font-semibold text-[#171a21]'>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#596170]'>{detail}</p>
        </div>
    )
}

function RouteRule({ label, value }: { label: string, value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-[#e0e5ed] bg-white px-3 py-2'>
            <span className='font-semibold text-[#667085]'>{label}</span>
            <span className='truncate text-right font-semibold text-[#171a21]' title={value}>{value}</span>
        </div>
    )
}

function QueueFact({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'ok' | 'bad' }) {
    const toneClass = tone === 'bad' ? 'text-[#9a3412]' : tone === 'ok' ? 'text-[#147a3b]' : 'text-[#344054]'
    return (
        <div className='rounded-md border border-[#e0e5ed] bg-white px-2 py-1'>
            <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>{label}</p>
            <p className={`mt-0.5 truncate font-semibold ${toneClass}`}>{value}</p>
        </div>
    )
}

function DeliveryIcon({ status, failures }: { status?: string | null, failures: number }) {
    if (failures || status === 'failed') return <AlertTriangle className='h-4 w-4 text-[#9a3412]' />
    if (status === 'completed' || status === 'success') return <CheckCircle2 className='h-4 w-4 text-[#147a3b]' />
    return <Send className='h-4 w-4' />
}

function routeHealthFor(automation: AgentAutomation): { label: string, detail: string, tone: 'ok' | 'bad' | 'neutral' } {
    if (automation.status === 'paused') {
        return { label: 'Paused', detail: automation.pausedReason || 'Route is not checking right now.', tone: 'neutral' }
    }
    if (automation.consecutiveFailures) {
        return { label: 'Needs attention', detail: `${automation.consecutiveFailures} failed check${automation.consecutiveFailures === 1 ? '' : 's'} in a row.`, tone: 'bad' }
    }
    if (automation.lastStatus === 'completed' || automation.lastStatus === 'success') {
        return { label: 'Healthy', detail: 'Last check completed.', tone: 'ok' }
    }
    return { label: 'Waiting', detail: 'No completed check recorded yet.', tone: 'neutral' }
}

function routeHealthForDraft(draft: AutomationPayload): { label: string, detail: string, tone: 'ok' | 'bad' | 'neutral' } {
    if (draft.status === 'paused') return { label: 'Paused', detail: 'Route will not check until reactivated.', tone: 'neutral' }
    if (!draft.modelName) return { label: 'Needs destination', detail: 'Add webhook, email, or review queue before relying on delivery.', tone: 'bad' }
    return { label: 'Configured', detail: 'Route has a destination and active schedule.', tone: 'ok' }
}

function deliveryTargetLabel(modelName: string | null | undefined, actionType: AgentAutomation['actionType']) {
    if (modelName) return modelName
    return actionType === 'echo' ? 'delivery test' : 'monitoring check'
}

function extractRuleTerms(prompt: string) {
    const first = prompt.split('\n').find(line => line.toLowerCase().includes('watch '))
    if (!first) return 'custom terms'
    const afterColon = first.split(':').slice(1).join(':').trim()
    if (!afterColon) return 'company/domain/vendor/product'
    const terms = afterColon.split(',').map(term => term.trim()).filter(Boolean)
    if (terms.length <= 2) return terms.join(', ')
    return `${terms.slice(0, 2).join(', ')} +${terms.length - 2}`
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
        const raw = window.localStorage.getItem(dwmWebhookDraftKey) || window.sessionStorage.getItem(dwmWebhookDraftKey)
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

function clearStoredWebhookDraft() {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(dwmWebhookDraftKey)
    } catch {
        // Storage may be disabled; nothing else to clear.
    }
    try {
        window.sessionStorage.removeItem(dwmWebhookDraftKey)
    } catch {
        // Storage may be disabled; nothing else to clear.
    }
}

function readSetupIntent() {
    if (typeof window === 'undefined') return ''
    try {
        return new URLSearchParams(window.location.search).get('setup') || ''
    } catch {
        return ''
    }
}

function draftFromWebhook(subscription: DwmWebhookDraft): AutomationPayload {
    const terms = subscription.terms.map(term => term.trim()).filter(Boolean)
    const deliveryTarget = redactWebhookEndpoint(subscription.endpoint)
    return {
        ...newAutomationDraft([
            `Watch these companies, domains, vendors, and products for new ransomware or extortion mentions: ${terms.join(', ')}.`,
            `Send matching alerts to the configured HTTPS webhook endpoint: ${deliveryTarget}.`,
            'Include actor, company, matchedTerm, claimSummary, claimedAt, sourceName, sourceUrl, sourceCount, reviewState, recommendedAction, and pivots.',
            'Only send new or materially updated matches that need review.',
        ].join('\n')),
        name: 'Dark web monitoring webhook',
        intervalMinutes: 15,
        modelName: 'webhook',
        notifyOn: 'always',
    }
}

function dwmFallbackDraft(): AutomationPayload {
    return {
        ...newAutomationDraft([
            'Watch these companies, domains, vendors, and products for new ransomware or extortion mentions.',
            'Send matching alerts to the configured HTTPS webhook endpoint.',
            'Include actor, company, matchedTerm, claimSummary, claimedAt, sourceName, sourceUrl, sourceCount, reviewState, recommendedAction, and pivots.',
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
        return `${url.origin}/...`
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
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Oslo' }).format(new Date(value))
}

function shortDate(value?: string | null) {
    if (!value) return 'none'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'unknown'
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(date)
}

function scheduleShort(automation: Pick<AutomationPayload, 'scheduleKind' | 'intervalMinutes' | 'runAt'>) {
    if (automation.scheduleKind === 'once') return 'once'
    return `${automation.intervalMinutes || 0}m`
}
