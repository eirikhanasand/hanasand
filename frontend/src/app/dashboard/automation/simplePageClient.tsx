'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Clock3, Filter, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
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
import type { InitialAutomationData } from '@/utils/automations/server'
import useAutomationHistory from './useAutomationHistory'
import ErrorNotice from '@/components/error/errorNotice'
import CertificateStatus from './certificateStatus'

const inputClass = 'h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const defaultDraft = (): AutomationPayload => ({
    name: 'Website health check',
    prompt: 'Monitor the website and API endpoint for availability and response errors.',
    targetUrl: '',
    monitoringType: 'fetch',
    followRedirects: true,
    userAgent: '',
    expectedDown: false,
    upsideDown: false,
    timeoutSeconds: 1,
    retryCount: 1,
    scheduleKind: 'interval',
    intervalMinutes: 15,
    runAt: '',
    status: 'active',
    actionType: 'agent_prompt',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    modelName: null,
    notificationDestinations: [],
    notifyOn: 'failure',
    notifyWarnings: false,
})

export default function AutomationsClient({ setup, initial }: { setup?: 'dwm', initial: InitialAutomationData }) {
    const [automations, setAutomations] = useState<AgentAutomation[]>(initial.automations)
    const [selected, setSelected] = useState<AgentAutomation | null>(setup ? null : initial.detail?.automation || initial.automations[0] || null)
    const [draft, setDraft] = useState<AutomationPayload>(() => selected ? toDraft(selected) : { ...defaultDraft(), timezone: 'UTC' })
    const [historyFrom, setHistoryFrom] = useState('')
    const [historyTo, setHistoryTo] = useState('')
    const history = useAutomationHistory(selected?.id, historyFrom, historyTo, initial.detail, initial.error)
    const [showHistoryFilters, setShowHistoryFilters] = useState(false)
    const [editing, setEditing] = useState(Boolean(setup))
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState(initial.error || '')
    const [loadError, setLoadError] = useState(initial.error || '')

    async function load(selectedId = selected?.id) {
        setBusy('load')
        try {
            const result = await fetchAutomations()
            setLoadError('')
            setAutomations(result.automations || [])
            const next = (result.automations || []).find(item => item.id === selectedId) || (result.automations || [])[0] || null
            if (next) await select(next, false)
            else {
                setSelected(null)
            }
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load automations.')
        } finally {
            setBusy('')
        }
    }

    useEffect(() => {
        if (editing) return
        const refresh = window.setInterval(() => {
            void fetchAutomations().then(result => {
                setAutomations(result.automations)
                const fresh = result.automations.find(item => item.id === selected?.id) || result.automations[0] || null
                setSelected(fresh)
            }).catch(() => undefined)
        }, 15_000)
        return () => window.clearInterval(refresh)
    }, [editing, selected?.id])

    async function select(automation: AgentAutomation, openEditor = false) {
        setSelected(automation)
        setDraft(toDraft(automation))
        setEditing(openEditor)
        try {
            const result = await fetchAutomation(automation.id)
            setSelected(result.automation)
            setDraft(toDraft(result.automation))
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load automation history.')
        }
    }

    function beginCreate() {
        setSelected(null)
        setHistoryFrom('')
        setHistoryTo('')
        setShowHistoryFilters(false)
        setDraft(defaultDraft())
        setEditing(true)
        setMessage('')
    }

    async function save() {
        const validation = validateDraft(draft)
        if (validation) {
            setMessage(validation.message)
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

    if (!automations.length && loadError) return <ErrorNotice message={loadError} actionLabel={busy ? 'Retrying…' : 'Try again'} onAction={() => void load()} />
    if (!automations.length && !editing) return <WelcomeState onCreate={beginCreate} />

    return (
        <div className='grid gap-4'>
            <StatusSummary automations={automations} />
            <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]'>
                <section className='rounded-xl border border-ui-border bg-ui-panel shadow-sm'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                        <div><h2 className='text-lg font-semibold text-ui-text'>Your automations</h2><p className='mt-1 text-sm text-ui-muted'>{automations.length} check{automations.length === 1 ? '' : 's'} configured</p></div>
                        {!editing ? <button type='button' onClick={beginCreate} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90'><Plus className='h-4 w-4' />Create automation</button> : null}
                    </div>
                    <div className='hidden grid-cols-2 gap-3 border-b border-ui-border px-4 py-2 text-xs text-ui-muted md:grid md:grid-cols-[minmax(9rem,1.3fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_minmax(8rem,1fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)]'><span>Name</span><span>Status</span><span>Cert</span><span>History</span><span>Uptime</span><span>Tags</span></div>
                    <div className='divide-y divide-ui-border'>
                        {automations.map(automation => <AutomationRow key={automation.id} automation={automation} selected={selected?.id === automation.id} onClick={() => void select(automation)} />)}
                    </div>
                </section>

                <section className='rounded-xl border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    {editing ? <AutomationForm draft={draft} selected={selected} busy={busy} message={message} onChange={setDraft} onSave={() => void save()} onCancel={() => { setEditing(false); setMessage('') }} /> : selected ? <AutomationDetails automation={selected} runs={history.runs} history={history} historyFrom={historyFrom} historyTo={historyTo} onHistoryFromChange={setHistoryFrom} onHistoryToChange={setHistoryTo} showHistoryFilters={showHistoryFilters} onShowHistoryFiltersChange={setShowHistoryFilters} busy={busy} message={message} onRun={() => void runNow()} onEdit={() => setEditing(true)} onDelete={() => void remove()} onRefresh={history.refresh} /> : <WelcomeState onCreate={beginCreate} compact />}
                </section>
            </div>
        </div>
    )
}

function StatusSummary({ automations }: { automations: AgentAutomation[] }) {
    const counts = automations.reduce((result, automation) => {
        const key = automation.status === 'paused' || automation.expectedDown || automation.upsideDown ? 'maintenance' : !automation.lastStatus || automation.lastStatus === 'running' ? 'pending' : automation.lastStatus === 'failed' ? 'down' : automation.lastStatus === 'warning' ? 'warning' : 'up'
        result[key] += 1
        return result
    }, { up: 0, down: 0, maintenance: 0, pending: 0, warning: 0 })
    return <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>{(['up', 'down', 'maintenance', 'pending', 'warning'] as const).map(key => <div key={key} className='rounded-xl border border-ui-border bg-ui-panel px-4 py-3'><div className='flex items-center gap-2 text-sm text-ui-muted'><span className={`h-2.5 w-2.5 rounded-full ${key === 'up' ? 'bg-ui-success' : key === 'down' ? 'bg-ui-danger' : key === 'maintenance' ? 'bg-ui-primary' : 'bg-ui-warning'}`} />{key[0].toUpperCase() + key.slice(1)}</div><p className='mt-2 text-2xl font-semibold text-ui-text'>{counts[key]}</p></div>)}</div>
}

function WelcomeState({ onCreate, compact = false }: { onCreate: () => void, compact?: boolean }) {
    if (compact) return <div className='grid min-h-72 place-items-center text-center'><div><Clock3 className='mx-auto h-8 w-8 text-ui-primary' /><h2 className='mt-3 text-lg font-semibold text-ui-text'>Nothing selected</h2><p className='mt-1 text-sm text-ui-muted'>Choose an automation to see its latest checks.</p></div></div>
    return <section className='relative isolate grid min-h-[40rem] overflow-hidden px-4 py-10 text-center sm:px-8'>
        <svg viewBox='0 0 1000 700' preserveAspectRatio='none' aria-hidden='true' className='absolute left-1/2 top-4 z-0 h-[calc(100%-2rem)] w-[min(80%,96rem)] -translate-x-1/2'>
            <defs>
                <clipPath id='automation-cloud-shape'>
                    <path d='M80 600C48 574 43 523 61 477C79 431 121 409 171 414C182 358 220 310 276 293C315 281 350 288 378 305C392 248 439 201 501 190C558 180 608 198 642 232C683 200 741 183 796 199C858 217 893 260 901 309C945 318 972 353 968 397C1002 421 1005 467 983 504C1002 546 977 596 931 616C861 647 778 629 724 638C670 648 625 638 573 648C515 661 455 645 414 635C350 650 292 641 255 628C201 639 131 632 80 600Z' />
                </clipPath>
            </defs>
            <path fill='var(--automation-cloud)' fillOpacity='0.76' d='M80 600C48 574 43 523 61 477C79 431 121 409 171 414C182 358 220 310 276 293C315 281 350 288 378 305C392 248 439 201 501 190C558 180 608 198 642 232C683 200 741 183 796 199C858 217 893 260 901 309C945 318 972 353 968 397C1002 421 1005 467 983 504C1002 546 977 596 931 616C861 647 778 629 724 638C670 648 625 638 573 648C515 661 455 645 414 635C350 650 292 641 255 628C201 639 131 632 80 600Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.34' clipPath='url(#automation-cloud-shape)' d='M25 480C82 445 143 443 191 461C242 481 284 472 325 451C366 430 408 438 443 464C470 485 486 508 500 529C484 551 463 571 437 582C392 601 362 589 322 601C278 614 237 596 196 603C144 612 94 600 55 578C28 563 14 526 25 480Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.25' clipPath='url(#automation-cloud-shape)' d='M613 300C650 276 694 274 731 292C764 308 788 337 792 370C765 382 736 382 710 370C678 355 647 355 620 365C604 343 601 321 613 300Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.22' clipPath='url(#automation-cloud-shape)' d='M350 568C388 548 424 548 458 564C488 578 519 579 547 565C572 553 601 557 623 575C602 602 572 616 536 616C502 616 474 605 443 614C408 625 375 612 350 592C340 584 340 576 350 568Z' />
        </svg>
        <div className='relative z-10 mx-auto flex max-w-2xl flex-col items-center justify-center'>
            <div className='relative mb-3 h-72 w-[min(32rem,92%)]'>
                <img src='/images/empty-states/automations-barn-draft.png' alt='A simple open barn with an empty interior' className='relative z-10 h-full w-full object-contain' />
            </div>
            <h2 className='text-3xl font-semibold text-(--automation-cloud-ink)'>Create automation</h2>
            <p className='mx-auto mt-3 max-w-lg text-base leading-7 text-(--automation-cloud-ink)/70'>Check that everything is working as it should, and get alerted if something is wrong.</p>
            <button type='button' onClick={onCreate} className='mt-7 inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-lg bg-(--automation-cloud-ink) px-5 text-sm font-semibold text-white shadow-lg shadow-black/20 hover:opacity-90'><Plus className='h-4 w-4' />Create</button>
        </div>
    </section>
}

function AutomationRow({ automation, selected, onClick }: { automation: AgentAutomation, selected: boolean, onClick: () => void }) {
    const missingUrl = automation.actionType === 'agent_prompt' && !automation.targetUrl
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed' || missingUrl)
    const warning = automation.lastStatus === 'warning'
    const state = missingUrl ? 'Missing URL' : failed ? 'Needs attention' : warning ? 'Warning' : automation.expectedDown || automation.upsideDown ? 'Maintenance' : automation.status === 'active' ? 'Healthy' : 'Paused'
    return <div className={`relative grid [&>span]:pointer-events-none w-full grid-cols-2 items-center gap-3 border-t border-ui-border px-4 py-3 text-left transition hover:bg-ui-raised md:grid-cols-[minmax(9rem,1.3fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_minmax(8rem,1fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)] ${selected ? 'bg-ui-primary/5' : ''}`}>
        <button type='button' onClick={onClick} aria-label={automation.name} className='absolute inset-0 rounded focus-visible:outline-2 focus-visible:outline-ui-primary' />
        <span className='min-w-0 truncate text-sm font-semibold text-ui-text'>{automation.name}</span>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${failed ? 'bg-ui-danger/10 text-ui-danger' : warning ? 'bg-ui-warning/10 text-ui-warning' : automation.status === 'active' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{state}</span>
        <CertificateStatus automation={automation} />
        <span className='flex items-center gap-1' aria-label='History'>{historyBars(automation)}</span>
        <span className='text-xs text-ui-muted'>{uptimeLabel(automation)}</span>
        <span className='text-xs text-ui-muted'>{automation.actionType === 'agent_prompt' ? 'Monitoring' : labelForType(automation.actionType)}</span>
    </div>
}

function historyBars(automation: AgentAutomation) {
    const history = automation.history || []
    if (!history.length) return <span className='text-xs text-ui-muted'>No checks</span>
    return <span className='flex gap-0.5'>{history.map(run => <span key={run.id} title={`${formatDate(run.started_at)}: ${run.warning ? 'warning' : run.status}`} className={`h-4 w-1 rounded-sm ${run.status === 'failed' ? 'bg-ui-danger' : run.warning ? 'bg-ui-warning' : run.status === 'completed' ? 'bg-ui-success' : 'bg-ui-muted/40'}`} />)}</span>
}

function uptimeLabel(automation: AgentAutomation) {
    return automation.uptime == null ? '—' : `${automation.uptime}%`
}

function AutomationForm({ draft, selected, busy, message, onChange, onSave, onCancel }: { draft: AutomationPayload, selected: AgentAutomation | null, busy: string, message: string, onChange: (draft: AutomationPayload) => void, onSave: () => void, onCancel: () => void }) {
    const validation = validateDraft(draft)
    return <div className='grid gap-4'><div><h2 className='text-xl font-semibold text-ui-text'>{selected?.name || 'Create an automation'}</h2><p className='mt-1 text-sm text-ui-muted'>Define a monitoring job and where to send its alerts.</p></div>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Name</span><input className={inputClass} required value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} placeholder='Website health' />{validation?.field === 'name' ? <span className='text-sm text-ui-danger'>{validation.message}</span> : null}</label>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Automation type</span><select className={inputClass} value={draft.actionType} onChange={event => onChange({ ...draft, actionType: event.target.value as AutomationPayload['actionType'] })}><option value='agent_prompt'>Monitoring</option><option value='mail_health_check'>Mail health</option><option value='system_alert'>System alert</option></select></label>
        {draft.actionType === 'agent_prompt' ? <>
            <div className='grid gap-3 sm:grid-cols-2'><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Type</span><select className={inputClass} value={draft.monitoringType || 'fetch'} onChange={event => onChange({ ...draft, monitoringType: event.target.value as AutomationPayload['monitoringType'] })}><option value='fetch'>Fetch</option><option value='post'>Post</option><option value='tcp'>TCP</option><option value='ssh'>SSH</option></select></label><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>{draft.monitoringType === 'ssh' ? 'SSH host' : draft.monitoringType === 'tcp' ? 'TCP host' : 'URL to check'}</span><span className='relative block'>{draft.monitoringType === 'fetch' || draft.monitoringType === 'post' ? <span className={`pointer-events-none absolute inset-y-0 left-3 flex items-center text-ui-muted ${hasUrlScheme(draft.targetUrl || '') ? 'hidden' : ''}`} aria-hidden='true'>https://</span> : null}<input className={`${inputClass} ${(draft.monitoringType === 'fetch' || draft.monitoringType === 'post') && !hasUrlScheme(draft.targetUrl || '') ? 'pl-14' : ''}`} required type='text' value={draft.targetUrl || ''} onChange={event => onChange({ ...draft, targetUrl: event.target.value })} placeholder={draft.monitoringType === 'ssh' ? 'git.hanasand.com:22' : draft.monitoringType === 'tcp' ? 'git.hanasand.com:22' : 'example.com/health'} /></span>{validation?.field === 'url' ? <span className='text-sm text-ui-danger'>{validation.message}</span> : null}</label></div>
            <div className='grid gap-3 sm:grid-cols-2'><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>User agent</span><input className={inputClass} value={draft.userAgent || ''} onChange={event => onChange({ ...draft, userAgent: event.target.value })} placeholder='Default browser-like agent' /></label><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Redirects</span><select className={inputClass} value={draft.followRedirects === false ? 'no' : 'yes'} onChange={event => onChange({ ...draft, followRedirects: event.target.value === 'yes' })}><option value='yes'>Follow redirects</option><option value='no'>Do not follow redirects</option></select></label></div>
            <div className='grid gap-3 sm:grid-cols-2'><label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'><span><span className='block text-sm font-semibold text-ui-text'>Expected down</span><span className='text-xs text-ui-muted'>Down is maintenance; up is a failure.</span></span><input type='checkbox' checked={Boolean(draft.expectedDown)} onChange={event => onChange({ ...draft, expectedDown: event.target.checked })} className='h-4 w-4 accent-(--ui-primary)' /></label><label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'><span><span className='block text-sm font-semibold text-ui-text'>Upside down</span><span className='text-xs text-ui-muted'>Invert the expected result.</span></span><input type='checkbox' checked={Boolean(draft.upsideDown)} onChange={event => onChange({ ...draft, upsideDown: event.target.checked })} className='h-4 w-4 accent-(--ui-primary)' /></label></div>
        </> : null}
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Description</span><textarea className='min-h-28 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' required value={draft.prompt} onChange={event => onChange({ ...draft, prompt: event.target.value })} placeholder='Monitor the service for availability and response errors.' />{validation?.field === 'prompt' ? <span className='text-sm text-ui-danger'>{validation.message}</span> : null}</label>
        <label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Notification destinations</span><textarea className='min-h-20 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' value={(draft.notificationDestinations || (draft.modelName ? [draft.modelName] : [])).join('\n')} onChange={event => { const destinations = event.target.value.split('\n').map(item => item.trim()).filter(Boolean); onChange({ ...draft, notificationDestinations: destinations, modelName: destinations[0] || null }) }} placeholder='One destination per line' /></label>
        {!draft.modelName?.trim() && draft.notifyOn !== 'never' ? <span className='-mt-2 inline-flex w-fit text-ui-warning' title='No delivery destination configured' aria-label='No delivery destination configured'><AlertTriangle className='h-5 w-5' /></span> : null}
        <div className='grid gap-3 sm:grid-cols-2'><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Check every</span><div className='flex items-center gap-2'><input className={inputClass} type='number' min={1} value={draft.intervalMinutes || ''} onChange={event => onChange({ ...draft, intervalMinutes: Number(event.target.value) || null })} /><span className='text-sm text-ui-muted'>{draft.intervalMinutes === 1 ? 'minute' : 'minutes'}</span></div></label><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Notify me</span><select className={inputClass} value={draft.notifyOn || 'failure'} onChange={event => onChange({ ...draft, notifyOn: event.target.value as AutomationPayload['notifyOn'] })}><option value='failure'>When something fails</option><option value='always'>After every check</option><option value='never'>Never</option></select></label></div>
        {draft.actionType === 'agent_prompt' ? <label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'><span><span className='block text-sm font-semibold text-ui-text'>Notify me about warnings</span><span className='text-xs text-ui-muted'>Warn when a successful check takes 1 second or longer.</span></span><input type='checkbox' checked={Boolean(draft.notifyWarnings)} onChange={event => onChange({ ...draft, notifyWarnings: event.target.checked })} className='h-4 w-4 accent-(--ui-primary)' /></label> : null}
        {draft.actionType === 'agent_prompt' ? <div className='grid gap-3 sm:grid-cols-2'><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Response timeout</span><div className='flex items-center gap-2'><input className={inputClass} type='number' min={1} max={120} value={draft.timeoutSeconds || ''} onChange={event => onChange({ ...draft, timeoutSeconds: Number(event.target.value) || null })} /><span className='text-sm text-ui-muted'>seconds</span></div></label><label className='grid gap-1.5'><span className='text-xs font-semibold text-ui-muted'>Retries before failure</span><div className='flex items-center gap-2'><input className={inputClass} type='number' min={0} max={5} value={draft.retryCount ?? ''} onChange={event => onChange({ ...draft, retryCount: Number(event.target.value) || 0 })} /><span className='text-sm text-ui-muted'>retries</span></div></label></div> : null}
        <label className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5'><span><span className='block text-sm font-semibold text-ui-text'>Automation active</span><span className='text-xs text-ui-muted'>Start checking as soon as it is saved.</span></span><input type='checkbox' checked={draft.status === 'active'} onChange={event => onChange({ ...draft, status: event.target.checked ? 'active' : 'paused' })} className='h-4 w-4 accent-(--ui-primary)' /></label>
        <div className='grid gap-3 border-t border-ui-border pt-4'><p className='min-h-5 wrap-break-word text-sm text-ui-danger'>{message}</p><div className='flex items-center justify-between gap-3'><button type='button' onClick={onCancel} className='h-10 rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button><button type='button' onClick={onSave} disabled={busy === 'save' || Boolean(validation)} className='inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:opacity-50'>{selected ? <Check className='h-4 w-4' /> : <Plus className='h-4 w-4' />}{selected ? 'Save changes' : 'Create automation'}</button></div></div>
    </div>
}

function AutomationDetails({ automation, runs, history, historyFrom, historyTo, onHistoryFromChange, onHistoryToChange, showHistoryFilters, onShowHistoryFiltersChange, busy, message, onRun, onEdit, onDelete, onRefresh }: { automation: AgentAutomation, runs: AgentAutomationRun[], history: ReturnType<typeof useAutomationHistory>, historyFrom: string, historyTo: string, onHistoryFromChange: (value: string) => void, onHistoryToChange: (value: string) => void, showHistoryFilters: boolean, onShowHistoryFiltersChange: (value: boolean) => void, busy: string, message: string, onRun: () => void, onEdit: () => void, onDelete: () => void, onRefresh: () => void }) {
    const missingUrl = automation.actionType === 'agent_prompt' && !automation.targetUrl
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed' || missingUrl)
    const warning = automation.lastStatus === 'warning'
    const state = missingUrl ? 'Missing URL' : failed ? 'Needs attention' : warning ? 'Warning' : automation.expectedDown || automation.upsideDown ? 'Maintenance' : automation.status === 'active' ? 'Healthy' : 'Paused'
    const visibleRuns = runs
    const bottom = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!history.hasMore || history.loading || history.error || !bottom.current) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) history.loadMore()
        }, { root: bottom.current.parentElement, rootMargin: '100px' })
        observer.observe(bottom.current)
        return () => observer.disconnect()
    }, [history.hasMore, history.loading, history.error, history.loadMore])
    return <div className='grid gap-4'><div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>Automation</p><h2 className='mt-1 text-xl font-semibold text-ui-text'>{automation.name}</h2><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${failed ? 'bg-ui-danger/10 text-ui-danger' : warning ? 'bg-ui-warning/10 text-ui-warning' : automation.status === 'active' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{state}</p></div><div className='flex gap-2'><button type='button' onClick={onRun} disabled={busy === 'run' || missingUrl} className='inline-flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:opacity-50' title={missingUrl ? 'Add a URL before checking' : undefined}><Play className='h-4 w-4' />Check now</button><button type='button' onClick={onEdit} className='h-9 rounded-lg border border-ui-border px-3 text-sm font-semibold text-ui-text'>Edit</button></div></div>
        <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm'><div className='flex items-center justify-between gap-3'><p className='leading-6 text-ui-text'>{automation.prompt}</p><CertificateStatus automation={automation} /></div><div className='grid gap-3 border-t border-ui-border pt-3 text-xs text-ui-muted sm:grid-cols-2'>{automation.actionType === 'agent_prompt' ? <span className={`break-all ${missingUrl ? 'font-semibold text-ui-danger' : ''}`}>{missingUrl ? 'Missing URL' : `${automation.monitoringType.toUpperCase()}: ${automation.targetUrl}`}</span> : null}<span>{formatInterval(automation.intervalMinutes)}</span><span>{automation.actionType === 'agent_prompt' ? `Timeout: ${automation.timeoutSeconds || 1}s · ${automation.retryCount || 0} retries` : ''}</span><span>{automation.modelName || 'No notification destination'}{!automation.modelName && automation.notifyOn !== 'never' ? <span className='ml-1 inline-flex align-text-bottom text-ui-warning' title='No delivery destination configured' aria-label='No delivery destination configured'><AlertTriangle className='h-4 w-4' /></span> : null}</span></div></div>
        <section aria-label='Monitoring issues' className='grid gap-2'>
            <h3 className='text-sm font-semibold text-ui-text'>Issues ({history.issues.length})</h3>
            <p className='text-xs text-ui-muted'>Discord receives only the case number, at most once per issue every 24 hours.</p>
            <div className='grid max-h-80 gap-2 overflow-y-auto'>{history.issues.map(issue => <details key={issue.id} id={issue.caseNumber} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <summary className='cursor-pointer text-sm text-ui-text'><span className='font-semibold'>{issue.caseNumber}</span> · {issue.resolvedAt ? 'Resolved' : 'Open'} · {issue.occurrences} occurrences</summary>
                <p className='mt-2 whitespace-pre-wrap wrap-break-word text-sm text-ui-text'>{issue.summary}</p>
                <p className='mt-2 text-xs text-ui-muted'>First seen: {formatDate(issue.firstSeenAt)} · Last seen: {formatDate(issue.lastSeenAt)}{issue.resolvedAt ? ` · Resolved: ${formatDate(issue.resolvedAt)}` : ''}</p>
                {issue.notifications.map((notification, index) => <p key={index} className='mt-2 text-xs text-ui-muted'>{notification.error ? `Discord delivery failed: ${notification.error}` : notification.deliveredAt ? `Discord notified: ${formatDate(notification.deliveredAt)}` : 'Discord delivery pending.'} Next eligible notification: {formatDate(notification.nextAttemptAt)}</p>)}
            </details>)}</div>
            {!history.issues.length ? <p className='text-sm text-ui-muted'>{history.loading ? 'Loading issues…' : history.error ? 'Issues are unavailable.' : 'No issues recorded.'}</p> : null}
        </section>
        <div><div className='mb-2 flex flex-wrap items-center justify-between gap-2'><h3 className='text-sm font-semibold text-ui-text'>Recent checks <span className='font-normal text-ui-muted'>({visibleRuns.length}/{history.total})</span></h3><div className='flex items-center gap-2'><button type='button' onClick={() => onShowHistoryFiltersChange(!showHistoryFilters)} className={`rounded-md p-1.5 ${showHistoryFilters || historyFrom || historyTo ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`} aria-label='Filter checks by time' aria-pressed={showHistoryFilters} title='Filter checks by time'><Filter className='h-4 w-4' /></button><button type='button' onClick={onRefresh} className='text-ui-muted hover:text-ui-text' aria-label='Refresh checks' title='Refresh checks'><RefreshCw className='h-4 w-4' /></button></div></div>{showHistoryFilters ? <div className='mb-2 grid gap-2 sm:grid-cols-2'><label className='grid gap-1 text-xs text-ui-muted'><span>From</span><input type='datetime-local' value={historyFrom} onChange={event => onHistoryFromChange(event.target.value)} className={inputClass} /></label><label className='grid gap-1 text-xs text-ui-muted'><span>To</span><input type='datetime-local' value={historyTo} onChange={event => onHistoryToChange(event.target.value)} className={inputClass} /></label></div> : null}<div className='grid max-h-[32rem] gap-2 overflow-y-auto pr-1'>{visibleRuns.map(run => <div key={run.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'><div className='flex justify-between gap-2 text-xs text-ui-muted'><span>{formatDate(run.startedAt)}{run.caseNumber ? ` · ${run.caseNumber}` : ''}</span><span className={run.status === 'failed' ? 'font-semibold text-ui-danger' : run.warning ? 'font-semibold text-ui-warning' : 'font-semibold text-ui-success'}>{run.warning ? 'warning' : run.status}</span></div>{run.status === 'failed' ? <ErrorNotice compact className='mt-2' message={run.error || 'Check failed.'} /> : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-ui-muted'>{run.result || 'Check completed.'}</p>}</div>)}{!visibleRuns.length ? <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted'>{history.loading ? 'Loading checks…' : history.error ? 'Checks are unavailable.' : runs.length ? 'No checks match this time range.' : 'No checks yet. Run it now or wait for the next check.'}</p> : null}<div ref={bottom} aria-live='polite'>{history.loading ? 'Loading checks…' : history.error ? <button type='button' onClick={history.loadMore}>Retry: {history.error}</button> : history.hasMore ? <button type='button' onClick={history.loadMore}>Load more checks</button> : null}</div></div></div>
        <div className='flex items-center justify-between border-t border-ui-border pt-3'><span className='text-sm text-ui-muted'>{message}</span><button type='button' onClick={onDelete} disabled={busy === 'delete'} className='inline-flex items-center gap-2 text-sm font-semibold text-ui-danger hover:underline'><Trash2 className='h-4 w-4' />Delete</button></div>
    </div>
}

function toDraft(automation: AgentAutomation): AutomationPayload {
    return { name: automation.name, prompt: automation.prompt, targetUrl: automation.monitoringType === 'fetch' || automation.monitoringType === 'post' ? normalizeMonitoringUrl(automation.targetUrl || '') : automation.targetUrl, monitoringType: automation.monitoringType, followRedirects: automation.followRedirects, userAgent: automation.userAgent || '', expectedDown: automation.expectedDown, upsideDown: automation.upsideDown, timeoutSeconds: automation.timeoutSeconds || 1, retryCount: automation.retryCount ?? 1, scheduleKind: automation.scheduleKind, intervalMinutes: automation.intervalMinutes || 15, runAt: automation.runAt || '', status: automation.status === 'paused' ? 'paused' : 'active', actionType: automation.actionType, organizationId: automation.organizationId, timezone: automation.timezone, modelName: automation.modelName, notificationDestinations: automation.notificationDestinations || (automation.modelName ? [automation.modelName] : []), notifyOn: automation.notifyOn || 'failure', notifyWarnings: automation.notifyWarnings }
}

function normalizeMonitoringUrl(value: string) {
    const trimmed = value.trim()
    return trimmed && !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed
}

function hasUrlScheme(value: string) {
    return /^https?:\/\//i.test(value.trim())
}

function validateDraft(draft: AutomationPayload) {
    if (!draft.name.trim()) return { field: 'name' as const, message: 'Name is required.' }
    if (draft.actionType === 'agent_prompt') {
        const targetUrl = draft.monitoringType === 'tcp' || draft.monitoringType === 'ssh' ? (draft.targetUrl || '').trim() : normalizeMonitoringUrl(draft.targetUrl || '')
        if (!targetUrl) return { field: 'url' as const, message: 'URL is required.' }
        if (draft.monitoringType === 'tcp' || draft.monitoringType === 'ssh') {
            if (!/^[^:/\s]+(?::\d+)?$/.test(targetUrl)) return { field: 'url' as const, message: 'Enter a host with an optional port.' }
        } else {
            try {
                const parsed = new URL(targetUrl)
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
            } catch {
                return { field: 'url' as const, message: 'Enter a valid HTTP or HTTPS URL.' }
            }
        }
    }
    if (!draft.prompt.trim()) return { field: 'prompt' as const, message: 'Description is required.' }
    return null
}

function labelForType(type: AgentAutomation['actionType']) {
    if (type === 'mail_health_check') return 'Mail health'
    if (type === 'system_alert') return 'System alert'
    if (type === 'organization_report') return 'Organization report'
    if (type === 'echo') return 'Delivery test'
    return 'Monitoring'
}

function formatDate(value?: string | null) {
    if (!value) return 'Not yet'
    return new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

function formatInterval(value?: number | null) {
    const minutes = Number(value || 1)
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`
}
