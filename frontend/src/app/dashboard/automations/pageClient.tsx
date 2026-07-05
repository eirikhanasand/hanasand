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
const inputClass = 'rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const disclosureClass = 'rounded-lg border border-ui-border bg-ui-raised'
const disclosureSummaryClass = 'flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20'
const newAutomationDraft = (prompt = ''): AutomationPayload => ({
    name: 'General system alert',
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

const newMailAlertDraft = (): AutomationPayload => ({
    ...newAutomationDraft([
        'Check the Hanasand Mail dashboard path and mail service health.',
        'Send a Discord alert when mailbox overview, DNS, SMTP, TLS, queue, or JMAP checks are warning or failing.',
        'Include the failing check name, status, and operator action.',
    ].join('\n')),
    name: 'Mail path health alert',
    actionType: 'mail_health_check',
    intervalMinutes: 5,
    status: 'paused',
    modelName: null,
    notifyOn: 'failure',
})

const newSystemDiscordDraft = (): AutomationPayload => ({
    ...newAutomationDraft('Hanasand alert portal smoke: Mail path alert integration is configured with Discord webhook-file delivery.'),
    name: 'Discord system alert',
    actionType: 'system_alert',
    scheduleKind: 'once',
    intervalMinutes: null,
    runAt: defaultRunAt(),
    status: 'paused',
    modelName: null,
    notifyOn: 'always',
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
    const failingAutomationCount = useMemo(() => automations.filter(item => item.consecutiveFailures || item.lastStatus === 'failed').length, [automations])
    const selectedHealth = selected ? routeHealthFor(selected) : routeHealthForDraft(draft)
    const saveBlocker = activeRouteSaveBlocker(draft)

    useEffect(() => {
        const nextWebhookDraft = readWebhookDraft()
        const setupIntent = setup || readSetupIntent()
        if (nextWebhookDraft) {
            setWebhookDraft(nextWebhookDraft)
            setDraft(draftFromWebhook(nextWebhookDraft))
            setSelectedId('')
            setRuns([])
            setStatus('Webhook route ready. Create or run it to send delivery checks.')
        } else if (setupIntent === 'dwm') {
            setDraft(dwmFallbackDraft())
            setSelectedId('')
            setRuns([])
            setStatus('DWM delivery route is staged. Add the endpoint and start the check.')
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
                setDraft(toDraft(details.automation))
                setRuns(Array.isArray(details.runs) ? details.runs : [])
            } else {
                setRuns([])
            }
            setStatus('Alert routes streaming.')
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
        const blocker = activeRouteSaveBlocker(draft)
        if (blocker) {
            setStatus(blocker)
            return
        }
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

    function useMailAlertTemplate() {
        setSelectedId('')
        setRuns([])
        setDraft(newMailAlertDraft())
        setStatus('Mail alert draft ready.')
    }

    function useSystemAlertTemplate() {
        setSelectedId('')
        setRuns([])
        setDraft(newSystemDiscordDraft())
        setStatus('Discord alert draft ready.')
    }

    function useWebhookDraft() {
        if (!webhookDraft) return
        setSelectedId('')
        setRuns([])
        setDraft(draftFromWebhook(webhookDraft))
        setStatus('Webhook route ready. Create or run it to send delivery checks.')
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
        <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]'>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm'>
                <div className='mb-2 flex items-center justify-between gap-2 px-2 py-1'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase text-ui-primary'>Route queue</p>
                        <h2 className='text-sm font-semibold text-ui-text'>{routeQueueHeadline(automations.length, failingAutomationCount)}</h2>
                        <p className='mt-0.5 text-xs text-ui-muted'>{activeAutomationCount}/{maxActiveAutomations} active routes</p>
                    </div>
                    <button type='button' className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary hover:bg-ui-panel' onClick={newAutomation} title='New alert' aria-label='New alert'>
                        <Plus className='h-4 w-4' />
                    </button>
                </div>
                <details className='mb-2 rounded-lg border border-ui-border bg-ui-raised'>
                    <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-xs font-semibold text-ui-text outline-none hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                        <span>Templates</span>
                        <span className='text-ui-muted'>Mail, Discord</span>
                    </summary>
                    <div className='grid grid-cols-2 gap-2 border-t border-ui-border p-2'>
                        <button type='button' className='rounded-lg border border-ui-border bg-ui-raised px-2 py-2 text-left text-xs font-semibold text-ui-text hover:border-ui-primary/40 hover:bg-ui-panel' onClick={useMailAlertTemplate}>
                            Mail health
                        </button>
                        <button type='button' className='rounded-lg border border-ui-border bg-ui-raised px-2 py-2 text-left text-xs font-semibold text-ui-text hover:border-ui-primary/40 hover:bg-ui-panel' onClick={useSystemAlertTemplate}>
                            Discord alert
                        </button>
                    </div>
                </details>
                <div className='grid gap-2'>
                    {automations.map(automation => (
                        <button
                            key={automation.id}
                            className={`rounded-lg border p-3 text-left transition ${automation.id === selectedId ? 'border-ui-primary/40 bg-ui-panel' : 'border-ui-border bg-ui-raised hover:bg-ui-panel'}`}
                            onClick={() => void selectAutomation(automation)}
                        >
                            <div className='flex items-center justify-between gap-2'>
                                <span className='truncate text-sm font-semibold text-ui-text'>{automation.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${automation.status === 'active' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{automation.status}</span>
                            </div>
                            <div className='mt-3 grid grid-cols-2 gap-2 text-[11px] text-ui-muted'>
                                <QueueFact label='Next' value={shortDate(automation.nextRunAt || automation.runAt)} />
                                <QueueFact label='Last' value={automation.lastStatus || 'checking'} tone={automation.consecutiveFailures ? 'bad' : automation.lastStatus === 'completed' ? 'ok' : 'neutral'} />
                            </div>
                            <div className='mt-2 flex items-center justify-between gap-2'>
                                <p className='truncate text-[11px] text-ui-muted'>{alertCategoryLabel(automation.actionType)}</p>
                                <p className='truncate text-right text-[11px] font-semibold text-ui-muted'>{deliveryTargetLabel(automation.modelName, automation.actionType)}</p>
                            </div>
                        </button>
                    ))}
                    {!automations.length && <p className='p-3 text-sm leading-6 text-ui-muted'>Alert routing is ready. Create a monitoring, mail, system, or delivery-test route to start checks.</p>}
                </div>
            </section>

            <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                <div className='grid gap-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase text-ui-primary'>Alert control</p>
                            <h2 className='text-lg font-semibold text-ui-text'>{selected ? selected.name : 'New alert'}</h2>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <IconButton label='Refresh' icon={<RefreshCw className='h-4 w-4' />} onClick={() => void load()} />
                            {selected && <IconButton label='Check now' icon={<Play className='h-4 w-4' />} onClick={() => void runNow(selected.id)} disabled={busy.startsWith('run-')} />}
                        </div>
                    </div>

                    <section className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${routeHealthToneClass(selectedHealth.tone)}`}>
                                        <DeliveryIcon status={selected?.lastStatus} failures={selected?.consecutiveFailures || 0} />
                                        {selectedHealth.label}
                                    </span>
                                    <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-text'>
                                        {alertCategoryLabel(draft.actionType)}
                                    </span>
                                    <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-text'>
                                        {deliveryTargetLabel(draft.modelName, draft.actionType)}
                                    </span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-ui-muted'>{selectedHealth.detail}</p>
                            </div>
                            <div className='grid min-w-40 gap-1 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm'>
                                <span className='text-[10px] font-semibold uppercase text-ui-muted'>Next check</span>
                                <span className='font-semibold text-ui-text'>{selected ? shortDate(selected.nextRunAt || selected.runAt) : 'After create'}</span>
                                <span className='text-xs text-ui-muted'>{scheduleShort(selected || draft)}</span>
                            </div>
                        </div>
                    </section>

                    {webhookDraft && (
                        <div className='rounded-lg border border-ui-primary/40 bg-ui-panel p-4'>
                            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Dark web monitoring</p>
                                    <h3 className='mt-1 text-sm font-semibold text-ui-text'>Webhook route ready to create</h3>
                                    <p className='mt-1 text-sm leading-6 text-ui-muted'>Watch {formatTerms(webhookDraft.terms)} and send matched exposure alerts to {redactWebhookEndpoint(webhookDraft.endpoint)}.</p>
                                </div>
                                <div className='flex shrink-0 flex-wrap gap-2'>
                                    <button type='button' onClick={useWebhookDraft} className='rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas hover:opacity-90'>
                                        Use route
                                    </button>
                                    <button type='button' onClick={clearWebhookDraft} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted hover:border-ui-primary/40 hover:text-ui-text'>
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!webhookDraft && initialSetup && (
                        <div className='rounded-lg border border-ui-primary/40 bg-ui-panel p-4'>
                            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Dark web monitoring</p>
                                    <h3 className='mt-1 text-sm font-semibold text-ui-text'>Webhook route ready to create</h3>
                                    <p className='mt-1 text-sm leading-6 text-ui-muted'>The route is prefilled for company, domain, vendor, and product monitoring. Add the delivery endpoint, then create it.</p>
                                </div>
                                <button type='button' onClick={() => setStatus('Review the route and create it to start delivery.')} className='shrink-0 rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas hover:opacity-90'>
                                    Use route
                                </button>
                            </div>
                        </div>
                    )}

                    <section className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                        <div className='mb-3 flex items-center justify-between gap-3'>
                            <div>
                                <h3 className='text-sm font-semibold text-ui-text'>Alert settings</h3>
                                <p className='mt-0.5 text-xs text-ui-muted'>Start with the route name, alert type, and where notifications should go.</p>
                            </div>
                            <span className={draft.status === 'active' ? 'rounded-full bg-ui-success/10 px-2 py-1 text-xs font-semibold text-ui-success' : 'rounded-full bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted'}>
                                {draft.status}
                            </span>
                        </div>
                        <div className='grid gap-3 md:grid-cols-3'>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Alert name</span>
                                <input className={inputClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Alert type</span>
                                <select className={inputClass} value={draft.actionType} onChange={event => setDraft({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}>
                                    <option value='agent_prompt'>Monitoring check</option>
                                    <option value='mail_health_check'>Mail health alert</option>
                                    <option value='system_alert'>System alert</option>
                                    <option value='echo'>Delivery test</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Destination</span>
                                <input className={inputClass} value={draft.modelName || ''} placeholder='discord-webhook-file:/secure/path/to/webhook-url' onChange={event => setDraft({ ...draft, modelName: event.target.value.trim() || null })} />
                            </label>
                        </div>
                    </section>

                    <details data-testid='automation-schedule-settings' className={disclosureClass}>
                        <summary className={disclosureSummaryClass}>
                            <span>Advanced schedule and notification policy</span>
                            <span className='text-xs font-medium text-ui-muted'>{scheduleShort(draft)} · {draft.notifyOn || 'failure'}</span>
                        </summary>
                        <div className='grid gap-3 border-t border-ui-border p-3 md:grid-cols-2 2xl:grid-cols-5'>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Cadence</span>
                                <select className={inputClass} value={draft.scheduleKind} onChange={event => setDraft({ ...draft, scheduleKind: event.target.value as AutomationPayload['scheduleKind'] })}>
                                    <option value='interval'>Recurring</option>
                                    <option value='once'>Once</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Check every</span>
                                <input className={`${inputClass} disabled:opacity-45`} type='number' min={1} disabled={draft.scheduleKind !== 'interval'} value={draft.intervalMinutes || 30} onChange={event => setDraft({ ...draft, intervalMinutes: Number(event.target.value) })} />
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>First check</span>
                                <input className={`${inputClass} disabled:opacity-45`} type='datetime-local' disabled={draft.scheduleKind !== 'once'} value={draft.runAt || ''} onChange={event => setDraft({ ...draft, runAt: event.target.value })} />
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Status</span>
                                <select className={inputClass} value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as AutomationPayload['status'] })}>
                                    <option value='active'>Active</option>
                                    <option value='paused'>Paused</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Notify</span>
                                <select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => setDraft({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}>
                                    <option value='failure'>Delivery issues</option>
                                    <option value='always'>Every check</option>
                                    <option value='never'>Do not notify</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5 2xl:col-span-2'>
                                <span className='text-xs font-medium text-ui-muted'>Timezone</span>
                                <input className={inputClass} value={draft.timezone || 'UTC'} onChange={event => setDraft({ ...draft, timezone: event.target.value })} />
                            </label>
                        </div>
                    </details>

                    <details data-testid='automation-matching-rules' className={disclosureClass}>
                        <summary className={disclosureSummaryClass}>
                            <span>Advanced matching rules</span>
                            <span className='min-w-0 truncate text-right text-xs font-medium text-ui-muted'>{extractRuleTerms(draft.prompt)}</span>
                        </summary>
                        <div className='grid gap-3 border-t border-ui-border p-3 lg:grid-cols-[1fr_0.55fr]'>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-medium text-ui-muted'>Prompt and match policy</span>
                                <textarea className={`${inputClass} min-h-28 leading-6`} value={draft.prompt} onChange={event => setDraft({ ...draft, prompt: event.target.value })} />
                            </label>
                            <div className='grid content-start gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs text-ui-muted'>
                                <RouteRule label='Terms' value={extractRuleTerms(draft.prompt)} />
                                <RouteRule label='Payload' value={draft.prompt.toLowerCase().includes('actor') && draft.prompt.toLowerCase().includes('matchedterm') ? 'actor + match fields' : 'custom fields'} />
                                <RouteRule label='Filter' value={draft.prompt.toLowerCase().includes('only send') ? 'new or updated matches' : 'all matches'} />
                                <RouteRule label='Category' value={alertCategoryLabel(draft.actionType)} />
                                <RouteRule label='Destination' value={deliveryTargetLabel(draft.modelName, draft.actionType)} />
                            </div>
                        </div>
                    </details>

                    {selected?.pausedReason && (
                        <div className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-sm leading-6 text-ui-warning'>
                            {selected.pausedReason}
                        </div>
                    )}

                    <div className='flex flex-wrap items-center gap-2'>
                        <button type='button' className='inline-flex items-center gap-2 rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted' onClick={() => void saveAutomation()} disabled={busy === 'save' || Boolean(saveBlocker)} title={saveBlocker || undefined}>
                            <WandSparkles className='h-4 w-4' />
                            {selected ? 'Save alert' : 'Create alert'}
                        </button>
                        <button type='button' className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-muted hover:border-ui-primary/40 hover:text-ui-text' onClick={cancelDraft} disabled={busy === 'save'}>
                            Cancel
                        </button>
                        {status && <span className='text-sm text-ui-muted'>{status}</span>}
                    </div>

                    {selected && (
                        <details className={disclosureClass}>
                            <summary className={disclosureSummaryClass}>
                                <span>Route controls</span>
                                <span className='text-xs font-medium text-ui-muted'>Optional</span>
                            </summary>
                            <div className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border p-3'>
                                <p className='text-sm text-ui-muted'>Delete this alert route only when the delivery path is no longer owned or useful.</p>
                                <IconButton label='Delete' icon={<Trash2 className='h-4 w-4' />} tone='danger' onClick={() => void removeAutomation(selected.id)} disabled={busy.startsWith('delete-')} />
                            </div>
                        </details>
                    )}

                    {selected && (
                        <details data-testid='automation-run-history' className={disclosureClass}>
                            <summary className={disclosureSummaryClass}>
                                <span>Run history</span>
                                <span className='text-xs font-medium text-ui-muted'>{selected.runCount} checks · latest {selected.lastStatus || 'checking'}</span>
                            </summary>
                            <div className='grid gap-3 border-t border-ui-border p-3'>
                                <div className='grid gap-2 sm:grid-cols-4'>
                                    <InfoCard icon={<CalendarClock className='h-4 w-4' />} label='Next check' value={formatDate(selected.nextRunAt)} />
                                    <InfoCard icon={<DeliveryIcon status={selected.lastStatus} failures={selected.consecutiveFailures || 0} />} label='Latest result' value={`${selected.lastStatus || 'Checking'}${selected.consecutiveFailures ? ` · ${selected.consecutiveFailures} issues` : ''}`} />
                                    <InfoCard icon={<Play className='h-4 w-4' />} label='Checks' value={`${selected.runCount}`} />
                                    <InfoCard icon={<Clock3 className='h-4 w-4' />} label='Cadence' value={scheduleShort(selected)} />
                                </div>
                                <div className='grid gap-2'>
                                    {runs.map(run => (
                                        <div key={run.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                            <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'>
                                                <span>{formatDate(run.startedAt)}</span>
                                                <span className={run.status === 'failed' ? 'font-semibold text-ui-danger' : run.status === 'completed' ? 'font-semibold text-ui-success' : 'font-semibold text-ui-primary'}>{run.status}{run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}</span>
                                            </div>
                                            {run.status === 'failed'
                                                ? <ErrorNotice compact className='mt-2' message={run.error || run.result || 'Run failed.'} />
                                                : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-ui-muted'>{run.result || 'Running...'}</p>}
                                        </div>
                                    ))}
                                    {!runs.length && <p className='text-sm leading-6 text-ui-muted'>This route is armed. Use Check now to record the first run, or let the scheduled check write the next row.</p>}
                                </div>
                            </div>
                        </details>
                    )}
                </div>
            </section>
        </div>
    )
}

function routeQueueHeadline(total: number, failing: number) {
    if (!total) return 'No routes yet'
    if (failing === 1) return '1 route needs attention'
    if (failing) return `${failing} routes need attention`
    return 'Routes operating normally'
}

function IconButton({ label, icon, onClick, tone = 'default', disabled = false }: { label: string, icon: React.ReactNode, onClick: () => void, tone?: 'default' | 'danger', disabled?: boolean }) {
    return (
        <button type='button' title={label} disabled={disabled} onClick={onClick} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 ${tone === 'danger' ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger hover:bg-ui-danger/15' : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-primary/40 hover:text-ui-text'}`}>
            {icon}
            {label}
        </button>
    )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='mb-2 text-ui-primary'>{icon}</div>
            <p className='text-[11px] uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function routeHealthToneClass(tone: 'ok' | 'bad' | 'neutral') {
    if (tone === 'bad') return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    if (tone === 'ok') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    return 'border-ui-border bg-ui-raised text-ui-primary'
}

function RouteRule({ label, value }: { label: string, value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <span className='font-semibold text-ui-muted'>{label}</span>
            <span className='truncate text-right font-semibold text-ui-text' title={value}>{value}</span>
        </div>
    )
}

function QueueFact({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'ok' | 'bad' }) {
    const toneClass = tone === 'bad' ? 'text-ui-danger' : tone === 'ok' ? 'text-ui-success' : 'text-ui-text'
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>
            <p className='text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-0.5 truncate font-semibold ${toneClass}`}>{value}</p>
        </div>
    )
}

function DeliveryIcon({ status, failures }: { status?: string | null, failures: number }) {
    if (failures || status === 'failed') return <AlertTriangle className='h-4 w-4 text-ui-danger' />
    if (status === 'completed' || status === 'success') return <CheckCircle2 className='h-4 w-4 text-ui-success' />
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
    return { label: 'Armed', detail: 'Route is scheduled; completed checks stream here.', tone: 'neutral' }
}

function routeHealthForDraft(draft: AutomationPayload): { label: string, detail: string, tone: 'ok' | 'bad' | 'neutral' } {
    if (draft.status === 'paused') return { label: 'Paused', detail: 'Route is paused; reactivate to resume checks.', tone: 'neutral' }
    if ((draft.actionType === 'mail_health_check' || draft.actionType === 'system_alert') && !draft.modelName) {
        return { label: 'Needs destination', detail: 'Add a Discord webhook-file destination before activating this alert.', tone: 'bad' }
    }
    return { label: 'Configured', detail: 'Route has a destination and active schedule.', tone: 'ok' }
}

function activeRouteSaveBlocker(draft: AutomationPayload) {
    if (draft.status !== 'active') return ''
    if ((draft.actionType === 'mail_health_check' || draft.actionType === 'system_alert') && !draft.modelName) {
        return 'Add a delivery destination or keep the route paused before saving.'
    }
    return ''
}

function deliveryTargetLabel(modelName: string | null | undefined, actionType: AgentAutomation['actionType']) {
    if (modelName?.startsWith('discord-webhook-file:')) return 'Discord webhook file'
    if (modelName) return modelName
    if (actionType === 'mail_health_check' || actionType === 'system_alert') return 'Needs destination'
    return actionType === 'echo' ? 'delivery test' : 'monitoring check'
}

function alertCategoryLabel(actionType: AgentAutomation['actionType']) {
    if (actionType === 'mail_health_check') return 'Mail'
    if (actionType === 'system_alert') return 'System'
    if (actionType === 'echo') return 'Test'
    return 'Monitoring'
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
            'Include actor, company, matched watchlist term, alert summary, claim time, source label, source link, source count, review state, recommended action, and investigation pivots.',
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
            'Include actor, company, matched watchlist term, alert summary, claim time, source label, source link, source count, review state, recommended action, and investigation pivots.',
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
    if (!value) return 'Checking'
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Oslo' }).format(new Date(value))
}

function shortDate(value?: string | null) {
    if (!value) return 'checking'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'checking'
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).format(date)
}

function scheduleShort(automation: Pick<AutomationPayload, 'scheduleKind' | 'intervalMinutes' | 'runAt'>) {
    if (automation.scheduleKind === 'once') return 'once'
    return `${automation.intervalMinutes || 0}m`
}
