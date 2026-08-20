'use client'

import { useEffect, useState } from 'react'
import { Check, Clock3, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
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

const inputClass = 'h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const defaultDraft = (): AutomationPayload => ({
    name: 'Website health check',
    prompt: 'Check that the website and API endpoint are working as expected. Alert me when the check fails or needs attention.',
    scheduleKind: 'interval',
    intervalMinutes: 15,
    runAt: '',
    status: 'active',
    actionType: 'agent_prompt',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    modelName: null,
    notifyOn: 'failure',
})

export default function AutomationsClient({ setup }: { setup?: 'dwm' }) {
    const [automations, setAutomations] = useState<AgentAutomation[]>([])
    const [selected, setSelected] = useState<AgentAutomation | null>(null)
    const [draft, setDraft] = useState<AutomationPayload>(defaultDraft)
    const [runs, setRuns] = useState<AgentAutomationRun[]>([])
    const [editing, setEditing] = useState(Boolean(setup))
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')

    async function load(selectedId = selected?.id) {
        setBusy('load')
        try {
            const result = await fetchAutomations()
            setAutomations(result.automations || [])
            const next = (result.automations || []).find(item => item.id === selectedId) || (result.automations || [])[0] || null
            if (next) await select(next, false)
            else {
                setSelected(null)
                setRuns([])
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load automations.')
        } finally {
            setBusy('')
        }
    }

    useEffect(() => { void load() }, [])

    async function select(automation: AgentAutomation, openEditor = false) {
        setSelected(automation)
        setDraft(toDraft(automation))
        setEditing(openEditor)
        try {
            const result = await fetchAutomation(automation.id)
            setRuns(result.runs || [])
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load automation history.')
        }
    }

    function beginCreate() {
        setSelected(null)
        setRuns([])
        setDraft(defaultDraft())
        setEditing(true)
        setMessage('')
    }

    async function save() {
        if (!draft.name.trim() || !draft.prompt.trim()) {
            setMessage('Add a name and describe what should be checked.')
            return
        }
        setBusy('save')
        try {
            const result = selected ? await updateAutomation(selected.id, draft) : await createAutomation(draft)
            setMessage(selected ? 'Automation updated.' : 'Automation created.')
            setEditing(false)
            await load(result.automation.id)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to save automation.')
        } finally {
            setBusy('')
        }
    }

    async function runNow() {
        if (!selected) return
        setBusy('run')
        try {
            await runAutomationNow(selected.id)
            setMessage('Check started. Refresh shortly to see the result.')
            await select(selected, false)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to start the check.')
        } finally {
            setBusy('')
        }
    }

    async function remove() {
        if (!selected || !window.confirm(`Delete “${selected.name}”?`)) return
        setBusy('delete')
        try {
            await deleteAutomation(selected.id)
            setMessage('Automation deleted.')
            await load('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to delete automation.')
        } finally {
            setBusy('')
        }
    }

    if (!automations.length && !editing) return <WelcomeState onCreate={beginCreate} />

    return (
        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]'>
            <section className='rounded-xl border border-ui-border bg-ui-panel shadow-sm'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                    <div><p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Monitoring</p><h2 className='mt-1 text-lg font-semibold text-ui-text'>Your automations</h2><p className='mt-1 text-sm text-ui-muted'>{automations.length} check{automations.length === 1 ? '' : 's'} configured</p></div>
                    <button type='button' onClick={beginCreate} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90'><Plus className='h-4 w-4' />Create automation</button>
                </div>
                <div className='divide-y divide-ui-border'>
                    {automations.map(automation => <AutomationRow key={automation.id} automation={automation} selected={selected?.id === automation.id} onClick={() => void select(automation)} />)}
                </div>
            </section>

            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 shadow-sm'>
                {editing ? <AutomationForm draft={draft} selected={selected} busy={busy} message={message} onChange={setDraft} onSave={() => void save()} onCancel={() => { setEditing(false); setMessage('') }} /> : selected ? <AutomationDetails automation={selected} runs={runs} busy={busy} message={message} onRun={() => void runNow()} onEdit={() => setEditing(true)} onDelete={() => void remove()} onRefresh={() => void select(selected, false)} /> : <WelcomeState onCreate={beginCreate} compact />}
            </section>
        </div>
    )
}

function WelcomeState({ onCreate, compact = false }: { onCreate: () => void, compact?: boolean }) {
    if (compact) return <div className='grid min-h-72 place-items-center text-center'><div><Clock3 className='mx-auto h-8 w-8 text-ui-primary' /><h2 className='mt-3 text-lg font-semibold text-ui-text'>Nothing selected</h2><p className='mt-1 text-sm text-ui-muted'>Choose an automation to see its latest checks.</p></div></div>
    return <section className='relative isolate grid min-h-[40rem] overflow-hidden px-4 py-10 text-center sm:px-8'>
        <svg viewBox='0 0 280 210' preserveAspectRatio='none' aria-hidden='true' className='absolute inset-0 z-0 h-full w-full'>
            <path d='M16 132c0-26 21-47 47-47 7-25 30-43 57-43 20 0 38 9 49 24 12-13 30-21 49-21 29 0 54 18 63 44 25 2 43 23 43 49 0 18-9 34-23 43 11 8 18 17 22 29H7c3-12 10-22 21-30-8-8-12-19-12-31Z' fill='var(--automation-cloud)' />
        </svg>
        <div className='relative z-10 mx-auto flex max-w-2xl flex-col items-center justify-center'>
            <div className='relative mb-3 h-72 w-[min(32rem,92%)]'>
                <img src='/images/empty-states/automations-barn-draft.png' alt='A simple open barn with an empty interior' className='relative z-10 h-full w-full object-contain' />
            </div>
            <h2 className='text-3xl font-semibold text-(--automation-cloud-ink)'>Create automation</h2>
            <p className='mx-auto mt-3 max-w-lg text-base leading-7 text-(--automation-cloud-ink)/70'>Check that everything is working as it should, and get alerted if something is wrong.</p>
            <button type='button' onClick={onCreate} className='mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-5 text-sm font-semibold text-ui-canvas shadow-lg shadow-ui-primary/20 hover:opacity-90'><Plus className='h-4 w-4' />Create your first automation</button>
        </div>
    </section>
}

function AutomationRow({ automation, selected, onClick }: { automation: AgentAutomation, selected: boolean, onClick: () => void }) {
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed')
    return <button type='button' onClick={onClick} className={`grid w-full gap-3 p-4 text-left transition hover:bg-ui-raised ${selected ? 'bg-ui-primary/5' : ''}`}>
        <div className='flex flex-wrap items-center justify-between gap-3'><span className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'><span className={`h-2.5 w-2.5 rounded-full ${failed ? 'bg-ui-danger' : automation.status === 'active' ? 'bg-ui-success' : 'bg-ui-muted'}`} />{automation.name}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${failed ? 'bg-ui-danger/10 text-ui-danger' : automation.status === 'active' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{failed ? 'Needs attention' : automation.status === 'active' ? 'Healthy' : 'Paused'}</span></div>
        <div className='grid gap-2 text-xs text-ui-muted sm:grid-cols-3'><span>{automation.actionType === 'agent_prompt' ? 'Monitoring check' : labelForType(automation.actionType)}</span><span>Every {automation.intervalMinutes || 1} minutes</span><span className='sm:text-right'>Last: {automation.lastStatus || 'Not checked'}</span></div>
    </button>
}

function AutomationForm({ draft, selected, busy, message, onChange, onSave, onCancel }: { draft: AutomationPayload, selected: AgentAutomation | null, busy: string, message: string, onChange: (draft: AutomationPayload) => void, onSave: () => void, onCancel: () => void }) {
    return <div className='grid gap-4'><div><p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>{selected ? 'Edit automation' : 'New automation'}</p><h2 className='mt-1 text-xl font-semibold text-ui-text'>{selected?.name || 'Create an automation'}</h2><p className='mt-1 text-sm text-ui-muted'>Choose what to check and where to send an alert.</p></div>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Name</span><input className={inputClass} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} placeholder='Website health' /></label>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Automation type</span><select className={inputClass} value={draft.actionType} onChange={event => onChange({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}><option value='agent_prompt'>Monitoring check</option><option value='mail_health_check'>Mail health</option><option value='system_alert'>System alert</option></select></label>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>What should it check?</span><textarea className='min-h-28 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' value={draft.prompt} onChange={event => onChange({ ...draft, prompt: event.target.value })} placeholder='Check https://example.com and alert me if it is unavailable.' /></label>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Notification destination</span><input className={inputClass} value={draft.modelName || ''} onChange={event => onChange({ ...draft, modelName: event.target.value.trim() || null })} placeholder='Webhook or notification destination' /></label>
        <div className='grid gap-3 sm:grid-cols-2'><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Check every</span><div className='flex items-center gap-2'><input className={inputClass} type='number' min={1} value={draft.intervalMinutes || ''} onChange={event => onChange({ ...draft, intervalMinutes: Number(event.target.value) || null })} /><span className='text-sm text-ui-muted'>minutes</span></div></label><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Notify me</span><select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => onChange({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}><option value='failure'>When something fails</option><option value='always'>After every check</option><option value='never'>Never</option></select></label></div>
        <label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'><span><span className='block text-sm font-semibold text-ui-text'>Automation active</span><span className='text-xs text-ui-muted'>Start checking as soon as it is saved.</span></span><input type='checkbox' checked={draft.status === 'active'} onChange={event => onChange({ ...draft, status: event.target.checked ? 'active' : 'paused' })} className='h-4 w-4 accent-(--ui-primary)' /></label>
        <div className='flex flex-wrap items-center gap-2 border-t border-ui-border pt-4'><button type='button' onClick={onSave} disabled={busy === 'save'} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:opacity-50'>{selected ? <Check className='h-4 w-4' /> : <Plus className='h-4 w-4' />}{selected ? 'Save changes' : 'Create automation'}</button><button type='button' onClick={onCancel} className='h-10 rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button>{message ? <span className='text-sm text-ui-muted'>{message}</span> : null}</div>
    </div>
}

function AutomationDetails({ automation, runs, busy, message, onRun, onEdit, onDelete, onRefresh }: { automation: AgentAutomation, runs: AgentAutomationRun[], busy: string, message: string, onRun: () => void, onEdit: () => void, onDelete: () => void, onRefresh: () => void }) {
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed')
    return <div className='grid gap-4'><div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Automation</p><h2 className='mt-1 text-xl font-semibold text-ui-text'>{automation.name}</h2><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${failed ? 'bg-ui-danger/10 text-ui-danger' : automation.status === 'active' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{failed ? 'Needs attention' : automation.status === 'active' ? 'Healthy' : 'Paused'}</p></div><div className='flex gap-2'><button type='button' onClick={onRun} disabled={busy === 'run'} className='inline-flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:opacity-50'><Play className='h-4 w-4' />Check now</button><button type='button' onClick={onEdit} className='h-9 rounded-lg border border-ui-border px-3 text-sm font-semibold text-ui-text'>Edit</button></div></div>
        <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm'><p className='leading-6 text-ui-text'>{automation.prompt}</p><div className='grid gap-3 border-t border-ui-border pt-3 text-xs text-ui-muted sm:grid-cols-2'><span>Every {automation.intervalMinutes || 1} minutes</span><span>{automation.modelName || 'No notification destination'}</span></div></div>
        <div><div className='mb-2 flex items-center justify-between'><h3 className='text-sm font-semibold text-ui-text'>Recent checks</h3><button type='button' onClick={onRefresh} className='text-ui-muted hover:text-ui-text' aria-label='Refresh checks'><RefreshCw className='h-4 w-4' /></button></div><div className='grid gap-2'>{runs.slice(0, 5).map(run => <div key={run.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'><div className='flex justify-between gap-2 text-xs text-ui-muted'><span>{formatDate(run.startedAt)}</span><span className={run.status === 'failed' ? 'font-semibold text-ui-danger' : 'font-semibold text-ui-success'}>{run.status}</span></div>{run.status === 'failed' ? <ErrorNotice compact className='mt-2' message={run.error || 'Check failed.'} /> : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-ui-muted'>{run.result || 'Check completed.'}</p>}</div>)}{!runs.length ? <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted'>No checks yet. Run it now or wait for the next scheduled check.</p> : null}</div></div>
        <div className='flex items-center justify-between border-t border-ui-border pt-3'><span className='text-sm text-ui-muted'>{message}</span><button type='button' onClick={onDelete} disabled={busy === 'delete'} className='inline-flex items-center gap-2 text-sm font-semibold text-ui-danger hover:underline'><Trash2 className='h-4 w-4' />Delete</button></div>
    </div>
}

function toDraft(automation: AgentAutomation): AutomationPayload {
    return { name: automation.name, prompt: automation.prompt, scheduleKind: automation.scheduleKind, intervalMinutes: automation.intervalMinutes || 15, runAt: automation.runAt || '', status: automation.status === 'paused' ? 'paused' : 'active', actionType: automation.actionType, organizationId: automation.organizationId, timezone: automation.timezone, modelName: automation.modelName, notifyOn: automation.notifyOn || 'failure' }
}

function labelForType(type: AgentAutomation['actionType']) {
    if (type === 'mail_health_check') return 'Mail health'
    if (type === 'system_alert') return 'System alert'
    if (type === 'organization_report') return 'Organization report'
    if (type === 'echo') return 'Delivery test'
    return 'Monitoring check'
}

function formatDate(value?: string | null) {
    if (!value) return 'Not yet'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
