'use client'

import Link from '@/components/organizations/workspaceLink'
import { useEffect, useState } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { requestJson, type MillRule } from '../detection-rules'
import { ArrowLeft, Activity, History, SlidersHorizontal } from 'lucide-react'
import SignatureEditor from './signature-editor'
import { getRuleCategory, ruleCategories } from '../rule-categories'

type Audit = { id: string, event_type: string, actor_id: string | null, created_at: string, context: { before?: Record<string, unknown> | null, after?: Record<string, unknown>, action?: string } }
type Payload = { isHistorical?: boolean, currentVersion?: string, triggerCount: number, rule: MillRule, canEdit: boolean, audit: Audit[], nextOffset: number | null }
const fieldClass = 'mt-1.5 w-full min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm font-normal text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15 disabled:opacity-70'

export default function RuleDetails({ id, organizationId }: { id: string, organizationId: string }) {
    const [data, setData] = useState<Payload | null>(null)
    const [draft, setDraft] = useState<MillRule | null>(null)
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const endpoint = `/api/backend/mill/rules/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}`
    useEffect(() => {
        let active = true
        if (!organizationId) { setError('Choose an organization in the topbar.'); return }
        requestJson<Payload>(endpoint).then(payload => { if (active) { setData(payload); setDraft(payload.rule); canonicalize(payload) } }).catch(cause => { if (active) setError(cause.message) })
        return () => { active = false }
    }, [endpoint, organizationId])

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
            const result = await requestJson<{ rule: MillRule }>(`/api/backend/mill/rules/${encodeURIComponent(draft.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`, { method: 'PUT', body: JSON.stringify({ name: draft.name, explanation: draft.explanation, severity: draft.definition?.action === 'drop' ? 'low' : draft.severity, enabled: draft.enabled !== false, version: draft.version, ...(draft.source !== 'hanasand' ? { conditions: draft.definition?.conditions || [], action: draft.definition?.action } : { definition: draft.definition }) }) })
            setDraft(result.rule)
            setData(previous => previous ? { ...previous, rule: result.rule } : previous)
            setStatus('Rule saved. New events use this version.')
            const payload = await requestJson<Payload>(`/api/backend/mill/rules/${encodeURIComponent(draft.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`)
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
    return <DashboardPage className='!gap-6 !p-4 lg:!p-6'>
        <Link href={`/mill/rules/${getRuleCategory(data?.rule || { id })}?organizationId=${encodeURIComponent(organizationId)}`} className='inline-flex w-fit items-center gap-2 rounded-md text-sm font-medium text-ui-muted hover:text-ui-primary'><ArrowLeft size={16} aria-hidden='true' />{ruleCategories[getRuleCategory(data?.rule || { id })].label}</Link>
        {error && <div role='alert' className='rounded-lg border border-red-500 p-4'>{error} {data && <button type='button' disabled={busy} onClick={() => void reload()} className='ml-3 underline'>Reload rule</button>}</div>}
        {status && <p role='status'>{status}</p>}
        {!draft && !error && <p role='status'>Loading rule…</p>}
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
                    <dl className='flex items-center gap-2 border-t border-ui-border pt-2 sm:min-w-32 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4'>
                        <Activity size={20} className='text-ui-primary' aria-hidden='true' />
                        <div><dt className='text-xs font-medium text-ui-muted'>Trigger count</dt><dd className='mt-1 text-xl font-semibold leading-none tabular-nums text-ui-text' title='Recorded detections for this organization across all versions, including resolved detections.'>{data.triggerCount?.toLocaleString() ?? 'Unavailable'}</dd></div>
                    </dl>
                </header>
            </DashboardPanel>
            {data.isHistorical && <p role='status' className='rounded-lg border border-amber-500/40 p-4 text-sm'>You are viewing a historical signature. <Link className='underline' href={`/mill/rules/${draft.id.replace(/\.v\d+$/, '')}`}>Open current rule</Link></p>}
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
                                {data.canEdit && <button type='submit' className='justify-self-start rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50 sm:col-span-2'>{busy ? 'Saving…' : 'Save changes'}</button>}
                            </fieldset>
                        </div>
                    </DashboardPanel>
                </div>
            </form>
            <DashboardPanel className='grid gap-4 p-5 sm:p-6'>
                <div className='flex items-center gap-2'><History size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Audit log</h2></div>
                {!data.audit.length && <p className='text-sm text-ui-muted'>No recorded changes for this rule in this organization.</p>}
                <ol className='divide-y divide-ui-border'>{data.audit.map(entry => <li key={entry.id} className='py-4'>
                    <div className='flex flex-wrap justify-between gap-2 text-sm'><p className='font-semibold'>{entry.event_type === 'mill.rule.created' ? 'Rule created' : entry.event_type === 'mill.rule.imported' ? 'Rule imported' : 'Rule updated'}{entry.context.action ? ` · ${entry.context.action}` : ''} · {entry.actor_id || 'System'}</p><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
                    {typeof entry.context.before?.version === 'string' && entry.context.before.version !== data.currentVersion && <Link href={`/mill/rules/${draft.id.replace(/\.v\d+$/, '')}.v${entry.context.before.version}`} className='mr-3 text-xs underline'>View version {entry.context.before.version}</Link>}
                    {typeof entry.context.after?.version === 'string' && entry.context.after.version !== data.currentVersion && <Link href={`/mill/rules/${draft.id.replace(/\.v\d+$/, '')}.v${entry.context.after.version}`} className='text-xs underline'>View version {entry.context.after.version}</Link>}
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
