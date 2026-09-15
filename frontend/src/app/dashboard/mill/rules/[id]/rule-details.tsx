'use client'

import Link from '@/components/organizations/workspaceLink'
import { useEffect, useState } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { requestJson, type MillRule } from '../detection-rules'
import { ArrowLeft, Activity, History, SlidersHorizontal, ShieldCheck } from 'lucide-react'
import { getRuleCategory, ruleCategories } from '../rule-categories'

type Audit = { id: string, event_type: string, actor_id: string | null, created_at: string, context: { before?: Record<string, unknown> | null, after?: Record<string, unknown>, action?: string } }
type Payload = { triggerCount: number, rule: MillRule, canEdit: boolean, audit: Audit[], nextOffset: number | null }
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
        requestJson<Payload>(endpoint).then(payload => { if (active) { setData(payload); setDraft(payload.rule) } }).catch(cause => { if (active) setError(cause.message) })
        return () => { active = false }
    }, [endpoint, organizationId])

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
            const result = await requestJson<{ rule: MillRule }>(endpoint, { method: 'PUT', body: JSON.stringify({ name: draft.name, explanation: draft.explanation, severity: draft.severity, enabled: draft.enabled !== false, version: draft.version, ...(draft.source !== 'hanasand' ? { conditions: draft.definition?.conditions || [] } : {}) }) })
            setDraft(result.rule)
            setData(previous => previous ? { ...previous, rule: result.rule } : previous)
            setStatus('Rule saved. New events use this version.')
            const payload = await requestJson<Payload>(endpoint)
            setData(payload); setDraft(payload.rule)
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
    const conditions = draft?.definition?.conditions || []
    function changeCondition(index: number, key: 'path' | 'operator' | 'value', value: string) {
        if (draft) setDraft({ ...draft, definition: { conditions: conditions.map((condition, i) => i === index ? { ...condition, [key]: value } : condition) } })
    }
    return <DashboardPage className='!gap-6 !p-4 lg:!p-6'>
        <Link href={`/mill/rules/${getRuleCategory(data?.rule || { id })}?organizationId=${encodeURIComponent(organizationId)}`} className='inline-flex w-fit items-center gap-2 rounded-md text-sm font-medium text-ui-muted hover:text-ui-primary'><ArrowLeft size={16} aria-hidden='true' />{ruleCategories[getRuleCategory(data?.rule || { id })].label}</Link>
        {error && <div role='alert' className='rounded-lg border border-red-500 p-4'>{error} {data && <button type='button' disabled={busy} onClick={() => void reload()} className='ml-3 underline'>Reload rule</button>}</div>}
        {status && <p role='status'>{status}</p>}
        {!draft && !error && <p role='status'>Loading rule…</p>}
        {draft && data && <>
            <DashboardPanel className='overflow-hidden'>
                <header className='grid min-w-0 gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6'>
                    <div className='min-w-0'>
                        <div className='mb-3 flex flex-wrap items-center gap-2 text-xs font-medium'>
                            <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-ui-muted'>{ruleCategories[getRuleCategory(draft)].label}</span>
                            <span className='text-ui-muted'>{draft.family}</span>
                            <span className={`rounded-full px-2 py-0.5 ${data.rule.enabled === false ? 'bg-ui-raised text-ui-muted' : 'bg-ui-success/10 text-ui-success'}`}>{data.rule.enabled === false ? 'Disabled' : 'Enabled'}</span>
                        </div>
                        <h1 className='text-xl font-semibold tracking-tight text-ui-text sm:text-2xl'>{data.rule.name}</h1>
                        <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted'>
                            <span className='break-all'>{draft.id}</span><span className='h-3 border-l border-ui-border' aria-hidden='true' /><span>Version {draft.version}</span><span className='h-3 border-l border-ui-border' aria-hidden='true' /><span>{draft.source === 'hanasand' ? 'Hanasand rule' : draft.source === 'open_source' ? 'Imported rule' : 'Custom rule'}</span>
                        </div>
                    </div>
                    <dl className='flex items-center gap-3 border-t border-ui-border pt-4 sm:min-w-36 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6'>
                        <Activity size={20} className='text-ui-primary' aria-hidden='true' />
                        <div><dt className='text-xs font-medium text-ui-muted'>Trigger count</dt><dd className='mt-1 text-2xl font-semibold leading-none tabular-nums text-ui-text' title='Recorded detections for this organization across all versions, including resolved detections.'>{data.triggerCount?.toLocaleString() ?? 'Unavailable'}</dd></div>
                    </dl>
                </header>
            </DashboardPanel>
            <div className='grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'>
                <DashboardPanel className='p-4 sm:p-6'>
                    <form onSubmit={event => { event.preventDefault(); void save() }} className='grid gap-5'>
                        <div className='flex items-center gap-2'><SlidersHorizontal size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Rule settings</h2></div>
                        {!data.canEdit && <p className='text-sm text-ui-muted'>You can view this rule and its history. An organization owner or admin can edit it.</p>}
                        <fieldset disabled={!data.canEdit || busy} className='grid min-w-0 gap-4 sm:grid-cols-2'>
                            <label className='text-sm font-medium'>Name<input required minLength={2} maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={fieldClass} /></label>
                            <label className='text-sm font-medium'>Severity<select value={draft.severity} onChange={event => setDraft({ ...draft, severity: event.target.value })} className={fieldClass}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                            <label className='text-sm font-medium sm:col-span-2'>Description<textarea required minLength={10} maxLength={500} value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} rows={3} className={fieldClass} /></label>
                            <label className='flex items-center gap-2 text-sm font-medium sm:col-span-2'><input type='checkbox' checked={draft.enabled !== false} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Enabled</label>
                            {draft.source !== 'hanasand' && <div className='grid min-w-0 gap-3 sm:col-span-2'>
                                <h2 className='font-semibold'>Conditions</h2><p className='text-sm text-ui-muted'>All conditions must match the normalized event.</p>
                                {conditions.map((condition, index) => <div key={index} className='grid min-w-0 items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]'>
                                    <label className='text-xs'>Field<input required aria-label={`Condition ${index + 1} field`} value={condition.path} onChange={event => changeCondition(index, 'path', event.target.value)} className={fieldClass} /></label>
                                    <label className='text-xs'>Operator<select aria-label={`Condition ${index + 1} operator`} value={condition.operator} onChange={event => changeCondition(index, 'operator', event.target.value)} className={fieldClass}>{['equals', 'contains', 'regex'].map(value => <option key={value}>{value}</option>)}</select></label>
                                    <label className='text-xs'>Value<input required aria-label={`Condition ${index + 1} value`} value={condition.value} onChange={event => changeCondition(index, 'value', event.target.value)} className={fieldClass} /></label>
                                    <button type='button' aria-label={`Remove condition ${index + 1}`} disabled={conditions.length <= 1} className='rounded-lg border border-ui-border p-3 text-sm disabled:opacity-50' onClick={() => setDraft({ ...draft, definition: { conditions: conditions.filter((_, i) => i !== index) } })}>Remove</button>
                                </div>)}
                                <button type='button' disabled={conditions.length >= 8} className='justify-self-start rounded-lg border border-ui-border px-3 py-2 text-sm disabled:opacity-50' onClick={() => setDraft({ ...draft, definition: { conditions: [...conditions, { path: '', operator: 'equals', value: '' }] } })}>Add condition</button>
                            </div>}
                            {data.canEdit && <button type='submit' className='justify-self-start rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50 sm:col-span-2'>{busy ? 'Saving…' : 'Save changes'}</button>}
                        </fieldset>
                    </form>
                </DashboardPanel>
                <DashboardPanel className='grid gap-4 p-5 sm:p-6'>
                    <div className='flex items-center gap-2'><ShieldCheck size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>{draft.source === 'hanasand' ? 'Detection logic' : 'How this rule matches'}</h2></div>
                    <p className='text-sm leading-6 text-ui-muted'>{draft.source === 'hanasand' ? draft.detectionLogic : 'All configured conditions must match the normalized event.'}</p>
                    {draft.evidence.length > 0 && <div className='border-t border-ui-border pt-4'><h3 className='mb-2 text-xs font-medium text-ui-muted'>Supporting evidence</h3><ul className='flex flex-wrap gap-2'>{draft.evidence.map(item => <li key={item} className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs text-ui-muted'>{item}</li>)}</ul></div>}
                    {draft.source === 'hanasand' && <p className='text-xs leading-5 text-ui-muted'>Built-in detection logic is maintained by Hanasand. Settings apply to this organization.</p>}
                    <p className='text-xs leading-5 text-ui-muted'>Trigger counts include resolved detections and earlier versions of this rule.</p>
                </DashboardPanel>
            </div>
            <DashboardPanel className='grid gap-4 p-5 sm:p-6'>
                <div className='flex items-center gap-2'><History size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Audit log</h2></div>
                {!data.audit.length && <p className='text-sm text-ui-muted'>No recorded changes for this rule in this organization.</p>}
                <ol className='divide-y divide-ui-border'>{data.audit.map(entry => <li key={entry.id} className='py-4'>
                    <div className='flex flex-wrap justify-between gap-2 text-sm'><p className='font-semibold'>{entry.event_type === 'mill.rule.created' ? 'Rule created' : entry.event_type === 'mill.rule.imported' ? 'Rule imported' : 'Rule updated'}{entry.context.action ? ` · ${entry.context.action}` : ''} · {entry.actor_id || 'System'}</p><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
                    {entry.context.after && <dl className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs'>{Object.entries(entry.context.after).filter(([key, value]) => JSON.stringify(entry.context.before?.[key]) !== JSON.stringify(value)).map(([key, value]) => <div key={key} className='grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]'><dt className='font-medium capitalize'>{key === 'definition' ? 'Conditions' : key}</dt><dd className='wrap-break-word whitespace-pre-wrap text-ui-muted'>{entry.context.before && <><span>{displayValue(entry.context.before[key])}</span><span aria-label='changed to'> → </span></>}{displayValue(value)}</dd></div>)}</dl>}
                </li>)}</ol>
                {data.nextOffset !== null && <button type='button' disabled={busy} onClick={() => void moreAudit()} className='justify-self-start rounded-lg border border-ui-border px-3 py-2 text-sm'>Load older changes</button>}
            </DashboardPanel>
        </>}
    </DashboardPage>
}

function displayValue(value: unknown): string {
    if (value == null) return 'Not set'
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
    if (typeof value === 'object' && 'conditions' in value && Array.isArray(value.conditions)) return value.conditions.map((item: { path: string, operator: string, value: string }) => `${item.path} ${item.operator} ${item.value}`).join('\n')
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
