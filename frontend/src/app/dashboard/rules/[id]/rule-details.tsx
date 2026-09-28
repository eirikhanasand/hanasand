'use client'

import Link from '@/components/organizations/workspaceLink'
import { useEffect, useState } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { requestJson, type Rule } from '../detection-rules'
import { ArrowLeft, Activity, History, LoaderCircle, SlidersHorizontal } from 'lucide-react'
import SignatureEditor from './signature-editor'
import ReprocessRule from '../reprocess-rule'
import { getRuleCategory, ruleCategories } from '../rule-categories'
import { useSmoothedCount } from '../use-smoothed-count'

type Audit = { id: string, event_type: string, actor_id: string | null, created_at: string, context: { before?: Record<string, unknown> | null, after?: Record<string, unknown>, action?: string } }
type Payload = { isHistorical?: boolean, currentVersion?: string, triggerCount: number | null, rule: Rule, canEdit: boolean, audit: Audit[], nextOffset: number | null }
type StorageEstimate = { count: number, bytes: number, checkedDate: string, generatedAt: string }
const fieldClass = 'mt-1.5 w-full min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm font-normal text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15 disabled:opacity-70'

export default function RuleDetails({ id, organizationId }: { id: string, organizationId: string }) {
    const [data, setData] = useState<Payload | null>(null)
    const [draft, setDraft] = useState<Rule | null>(null)
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const [liveHitsUnavailable, setLiveHitsUnavailable] = useState(false)
    const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
    const [storageEstimateState, setStorageEstimateState] = useState<'idle' | 'loading' | 'pending' | 'unavailable'>('idle')
    const [busy, setBusy] = useState(false)
    const displayedHitCount = useSmoothedCount(data?.triggerCount, 3_000)
    const endpoint = `/api/backend/rules/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}`
    useEffect(() => {
        let active = true
        if (!organizationId) { setError('Choose an organization in the topbar.'); return }
        requestJson<Payload>(endpoint).then(payload => { if (active) { setData(payload); setDraft(payload.rule); canonicalize(payload) } }).catch(cause => { if (active) setError(cause.message) })
        return () => { active = false }
    }, [endpoint, organizationId])

    useEffect(() => {
        if (!data || data.isHistorical || data.rule.definition?.stage !== 'analyze' || data.rule.definition.action !== 'drop') {
            setStorageEstimate(null)
            setStorageEstimateState('idle')
            return
        }
        let active = true
        let requestPending = false
        let hasEstimate = false
        setStorageEstimate(null)
        setStorageEstimateState('loading')
        const refreshEstimate = async() => {
            if (!active || requestPending || hasEstimate || document.visibilityState !== 'visible') return
            requestPending = true
            try {
                const payload = await requestJson<{ estimate: StorageEstimate | null }>(`/api/backend/rules/${encodeURIComponent(id)}/storage-estimate?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
                if (!active) return
                setStorageEstimate(payload.estimate)
                hasEstimate = Boolean(payload.estimate)
                setStorageEstimateState(payload.estimate ? 'idle' : 'pending')
            } catch {
                if (active) setStorageEstimateState('unavailable')
            } finally {
                requestPending = false
            }
        }
        void refreshEstimate()
        const interval = window.setInterval(() => void refreshEstimate(), 60_000)
        return () => { active = false; window.clearInterval(interval) }
    }, [id, organizationId, data?.isHistorical, data?.rule.version, data?.rule.definition?.stage, data?.rule.definition?.action])

    useEffect(() => {
        if (!organizationId || !data) return
        let active = true
        let pending = false
        const refreshHitCount = async () => {
            if (pending || document.visibilityState !== 'visible') return
            pending = true
            try {
                const payload = await requestJson<{ triggerCount: number | null }>(`/api/backend/rules/${encodeURIComponent(id)}/hits?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
                if (active) {
                    setLiveHitsUnavailable(false)
                    setData(previous => previous ? { ...previous, triggerCount: payload.triggerCount } : previous)
                }
            } catch {
                if (active) setLiveHitsUnavailable(true)
            } finally {
                pending = false
            }
        }
        void refreshHitCount()
        const interval = window.setInterval(() => void refreshHitCount(), 15_000)
        return () => { active = false; window.clearInterval(interval) }
    }, [id, organizationId, Boolean(data)])

    function canonicalize(payload: Payload) {
        if (payload.isHistorical) return
        const url = new URL(window.location.href)
        url.pathname = url.pathname.replace(/\.v\d+$/, '')
        window.history.replaceState(window.history.state, '', url)
    }
    async function reload() {
        setBusy(true); setError('')
        try { const payload = await requestJson<Payload>(endpoint); setData(payload); setDraft(payload.rule) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reload rule.') }
        finally { setBusy(false) }
    }
    async function save() {
        if (!draft || !data?.canEdit) return
        setBusy(true); setError(''); setStatus('')
        try {
            const result = await requestJson<{ rule: Rule }>(`/api/backend/rules/${encodeURIComponent(draft.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`, { method: 'PUT', body: JSON.stringify({ name: draft.name, explanation: draft.explanation, severity: draft.definition?.action === 'drop' ? 'low' : draft.severity, enabled: draft.enabled !== false, version: draft.version, ...(draft.source !== 'hanasand' ? { conditions: draft.definition?.conditions || [], action: draft.definition?.action, storeScope: draft.definition?.storeScope } : { definition: draft.definition }) }) })
            setDraft(result.rule)
            setData(previous => previous ? { ...previous, rule: result.rule } : previous)
            setStatus('Rule saved. New events use this version.')
            const payload = await requestJson<Payload>(`/api/backend/rules/${encodeURIComponent(draft.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`)
            setData(payload); setDraft(payload.rule); canonicalize(payload)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save rule.') }
        finally { setBusy(false) }
    }
    async function moreAudit() {
        if (data?.nextOffset == null) return
        setBusy(true)
        try { const next = await requestJson<Payload>(`${endpoint}&offset=${data.nextOffset}`); setData(previous => previous ? { ...previous, audit: [...previous.audit, ...next.audit], nextOffset: next.nextOffset } : previous) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load history.') }
        finally { setBusy(false) }
    }
    return <DashboardPage className='!gap-6 !px-2 !py-4'>
        <Link href={`/rules/${getRuleCategory(data?.rule || { id })}?organizationId=${encodeURIComponent(organizationId)}`} className='inline-flex w-fit items-center gap-2 rounded-md text-sm font-medium text-ui-muted hover:text-ui-primary'><ArrowLeft size={16} aria-hidden='true' />{ruleCategories[getRuleCategory(data?.rule || { id })].label}</Link>
        {error && <div role='alert' className='rounded-lg border border-ui-danger/40 bg-ui-raised p-4 text-ui-text'>{error} {data && <button type='button' disabled={busy} onClick={() => void reload()} className='ml-3 underline hover:text-ui-primary'>Reload rule</button>}</div>}
        {status && <p role='status'>{status}</p>}
        {!draft && !error && <div role='status' aria-label='Loading rule' className='flex justify-center py-12'><LoaderCircle aria-hidden className='site-loading-icon h-6 w-6 motion-reduce:animate-none' /></div>}
        {draft && data && <>
            <DashboardPanel className='overflow-hidden'>
                <header className='grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium'>
                            <h1 className='min-w-0 wrap-anywhere text-xl font-semibold tracking-tight text-ui-text'>{data.rule.name}</h1>
                            <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-ui-muted'>{ruleCategories[getRuleCategory(draft)].label}</span>
                            <span className='text-ui-muted'>{draft.family}</span>
                            <span className={`rounded-full px-2 py-0.5 ${data.rule.enabled === false ? 'bg-ui-raised text-ui-muted' : 'bg-ui-success/10 text-ui-success'}`}>{data.rule.enabled === false ? 'Disabled' : 'Enabled'}</span>
                        </div>
                        <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted'>
                            <span className='break-all font-mono'>{draft.id.replace(/\.v\d+$/, '')}</span>{data.isHistorical && <span>Version {draft.version} · Historical</span>}<span className='h-3 border-l border-ui-border' aria-hidden='true' /><span>{draft.source === 'hanasand' ? 'Hanasand rule' : draft.source === 'open_source' ? 'Imported rule' : 'Custom rule'}</span>
                        </div>
                    </div>
                    <div className='flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ui-border pt-2 sm:border-t-0 sm:py-1'>
                        {data.rule.definition?.stage === 'analyze' && data.rule.definition.action === 'drop' && !data.isHistorical && <dl className='sm:border-l sm:border-ui-border sm:pl-4' title='Estimated event-row bytes for stored low-severity records matching this rule and eligible to be dropped. Index space is excluded.'>
                            <dt className='text-xs font-medium text-ui-muted'>Undropped</dt>
                            <dd className='mt-1 text-sm font-semibold leading-none tabular-nums text-ui-text'>
                                {storageEstimateState === 'loading' ? 'Loading…' : storageEstimateState === 'pending' ? 'Pending' : storageEstimateState === 'unavailable' ? 'Unavailable' : `${storageEstimate?.count.toLocaleString('en-US') ?? '0'} events`}
                            </dd>
                            <dd className='mt-1 text-xs tabular-nums text-ui-muted'>{storageEstimateState === 'loading' ? 'Loading saved estimate…' : storageEstimateState === 'pending' ? 'Waiting for estimate' : storageEstimateState === 'unavailable' ? 'Space estimate unavailable' : `${formatBytes(storageEstimate?.bytes ?? 0)} estimated savings`}</dd>
                            {storageEstimate && <dd className='mt-1 text-right text-[10px] tabular-nums text-ui-muted'>{formatEstimateDate(storageEstimate.checkedDate)}</dd>}
                        </dl>}
                        <dl className='flex items-center gap-2 sm:border-l sm:border-ui-border sm:pl-4'>
                            <Activity size={20} className='text-ui-primary' aria-hidden='true' />
                            <div><dt className='text-xs font-medium text-ui-muted'>Hits</dt><dd className='mt-1 text-xl font-semibold leading-none tabular-nums text-ui-text' title='Recorded rule hits for this organization, using the same total as the rule list.'>{displayedHitCount?.toLocaleString('en-US') ?? 'Unavailable'}</dd>{liveHitsUnavailable && <p className='mt-1 text-xs text-ui-warning'>Live count unavailable; retrying.</p>}</div>
                        </dl>
                    </div>
                </header>
            </DashboardPanel>
            {data.isHistorical && <p role='status' className='rounded-lg border border-ui-warning/40 bg-ui-raised p-4 text-sm text-ui-text'>You are viewing a historical signature. <Link className='underline text-ui-primary' href={`/rules/${draft.id.replace(/\.v\d+$/, '')}`}>Open current rule</Link></p>}
            <form onSubmit={event => { event.preventDefault(); void save() }} className='grid min-w-0 gap-4'>
                <SignatureEditor rule={draft} disabled={!data.canEdit || busy} onChange={definition => setDraft({ ...draft, definition, severity: definition.action === 'drop' ? 'low' : draft.severity })} />
                <div className='grid min-w-0 items-start gap-4'>
                    <DashboardPanel className='p-4 sm:p-6'>
                        <div className='grid gap-5'>
                            <div className='flex items-center gap-2'><SlidersHorizontal size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Rule settings</h2></div>
                            {!data.canEdit && !data.isHistorical && <p className='text-sm text-ui-muted'>You can view this rule and its history. An organization owner or admin can edit it.</p>}
                            <fieldset disabled={!data.canEdit || busy} className='grid min-w-0 gap-4 sm:grid-cols-2'>
                                <label className='text-sm font-medium'>Name<input required minLength={2} maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={fieldClass} /></label>
                                <label className='text-sm font-medium'>Severity<select disabled={draft.definition?.action === 'drop'} value={draft.definition?.action === 'drop' && !data.isHistorical ? 'low' : draft.severity} onChange={event => setDraft({ ...draft, severity: event.target.value })} className={fieldClass}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                                <label className='text-sm font-medium sm:col-span-2'>Description<textarea required minLength={10} maxLength={500} value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} rows={3} className={fieldClass} /></label>
                                <label className='flex items-center gap-2 text-sm font-medium sm:col-span-2'><input type='checkbox' checked={draft.enabled !== false} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Enabled</label>
                                {data.canEdit && <button type='submit' className='justify-self-start ui-button ui-button-primary px-4 py-2 text-sm disabled:opacity-50 sm:col-span-2'>{busy ? 'Saving…' : 'Save changes'}</button>}
                            </fieldset>
                        </div>
                    </DashboardPanel>
                </div>
            </form>
            {data.canEdit && !data.isHistorical && data.rule.definition?.stage === 'analyze' && data.rule.definition?.action === 'drop' &&
                <ReprocessRule key={organizationId + data.rule.id} rule={data.rule} organizationId={organizationId} disabled={busy || JSON.stringify(draft) !== JSON.stringify(data.rule)} />}
            <DashboardPanel className='grid gap-4 p-5 sm:p-6'>
                <div className='flex items-center gap-2'><History size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Audit log</h2></div>
                {!data.audit.length && <p className='text-sm text-ui-muted'>No recorded changes for this rule in this organization.</p>}
                <ol className='divide-y divide-ui-border'>{data.audit.map(entry => <li key={entry.id} className='py-4'>
                    <div className='flex flex-wrap justify-between gap-2 text-sm'><p className='font-semibold'>{entry.event_type === 'event.rule.created' ? 'Rule created' : entry.event_type === 'event.rule.imported' ? 'Rule imported' : 'Rule updated'}{entry.context.action ? ` · ${entry.context.action}` : ''} · {entry.actor_id || 'System'}</p><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
                    {typeof entry.context.before?.version === 'string' && entry.context.before.version !== data.currentVersion && <Link href={`/rules/${draft.id.replace(/\.v\d+$/, '')}.v${entry.context.before.version}`} className='mr-3 text-xs underline'>View version {entry.context.before.version}</Link>}
                    {typeof entry.context.after?.version === 'string' && entry.context.after.version !== data.currentVersion && <Link href={`/rules/${draft.id.replace(/\.v\d+$/, '')}.v${entry.context.after.version}`} className='text-xs underline'>View version {entry.context.after.version}</Link>}
                    {entry.context.after && <dl className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs'>{Object.entries(entry.context.after).filter(([key, value]) => (key !== 'version' || value !== data.currentVersion) && JSON.stringify(entry.context.before?.[key]) !== JSON.stringify(value)).map(([key, value]) => <div key={key} className='grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]'><dt className='font-medium capitalize'>{key === 'definition' ? 'Conditions' : key}</dt><dd className='wrap-break-word whitespace-pre-wrap text-ui-muted'>{entry.context.before && <><span>{displayValue(entry.context.before[key])}</span><span aria-label='changed to'> → </span></>}{displayValue(value)}</dd></div>)}</dl>}
                </li>)}</ol>
                {data.nextOffset !== null && <button type='button' disabled={busy} onClick={() => void moreAudit()} className='justify-self-start rounded-lg border border-ui-border px-3 py-2 text-sm'>Load older changes</button>}
            </DashboardPanel>
        </>}
    </DashboardPage>
}

function displayValue(value: unknown): string {
    if (value == null) return 'Not set'
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let amount = bytes / 1024, unit = 0
    while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
    return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)}${units[unit]}`
}

function formatEstimateDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return ''
    const label = `${String(day).padStart(2, '0')}:${String(month).padStart(2, '0')}`
    const now = new Date()
    const nowYear = now.getUTCFullYear(), nowMonth = now.getUTCMonth(), nowDay = now.getUTCDate()
    const previousMonth = nowMonth === 0 ? 11 : nowMonth - 1
    const previousMonthYear = nowMonth === 0 ? nowYear - 1 : nowYear
    const previousMonthDay = Math.min(nowDay, new Date(Date.UTC(previousMonthYear, previousMonth + 1, 0)).getUTCDate())
    const olderThanMonth = Date.UTC(year, month - 1, day) < Date.UTC(previousMonthYear, previousMonth, previousMonthDay)
    return year !== nowYear && olderThanMonth ? `${label}:${year}` : label
}
