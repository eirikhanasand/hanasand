'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { requestJson, type MillRule } from '../detection-rules'

type Audit = { id: string, event_type: string, actor_id: string | null, created_at: string, context: { before?: Record<string, unknown> | null, after?: Record<string, unknown>, action?: string } }
type Payload = { rule: MillRule, canEdit: boolean, audit: Audit[], nextOffset: number | null }
const fieldClass = 'mt-1 w-full min-w-0 rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm disabled:opacity-70'

export default function RuleDetails({ id, organizationId }: { id: string, organizationId: string }) {
    const [data, setData] = useState<Payload | null>(null)
    const [draft, setDraft] = useState<MillRule | null>(null)
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)
    const endpoint = `/api/backend/mill/rules/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}`
    useEffect(() => {
        let active = true
        if (!organizationId) { setError('Choose an organization from the rule library first.'); return }
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
        <Link href={`/mill/rules?organizationId=${encodeURIComponent(organizationId)}`} className='text-sm font-semibold text-ui-primary'>← Detection rules</Link>
        {error && <div role='alert' className='rounded-lg border border-red-500 p-4'>{error} {data && <button type='button' disabled={busy} onClick={() => void reload()} className='ml-3 underline'>Reload rule</button>}</div>}
        {status && <p role='status'>{status}</p>}
        {!draft && !error && <p role='status'>Loading rule…</p>}
        {draft && data && <>
            <header><h1 className='text-2xl font-semibold'>{data.rule.name}</h1><p className='mt-2 break-all font-mono text-sm text-ui-muted'>{draft.id} · Version {draft.version}</p><p className='mt-2 text-sm text-ui-muted'>{draft.family} · {draft.source === 'hanasand' ? 'Hanasand rule' : draft.source === 'open_source' ? 'Imported rule' : 'Custom rule'}</p></header>
            <DashboardPanel className='p-4 sm:p-6'>
                <form onSubmit={event => { event.preventDefault(); void save() }} className='grid gap-5'>
                    {!data.canEdit && <p className='text-sm text-ui-muted'>You can view this rule and its history. An organization owner or admin can edit it.</p>}
                    <fieldset disabled={!data.canEdit || busy} className='grid min-w-0 gap-5'>
                        <label className='text-sm font-semibold'>Name<input required minLength={2} maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={fieldClass} /></label>
                        <label className='text-sm font-semibold'>Description<textarea required minLength={10} maxLength={500} value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} className={fieldClass} /></label>
                        <label className='text-sm font-semibold'>Severity<select value={draft.severity} onChange={event => setDraft({ ...draft, severity: event.target.value })} className={fieldClass}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                        <label className='flex items-center gap-2 text-sm font-semibold'><input type='checkbox' checked={draft.enabled !== false} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Enabled</label>
                        {draft.source === 'hanasand' ? <div><h2 className='font-semibold'>Detection logic</h2><p className='mt-2 text-sm text-ui-muted'>This built-in detector uses the detection logic below. You can change its name, description, severity and enabled state for this organization.</p><p className='mt-2 text-sm'>{draft.detectionLogic}</p><ul className='mt-2 list-inside list-disc text-sm'>{draft.evidence.map(item => <li key={item}>{item}</li>)}</ul></div> : <div className='grid gap-3'>
                            <h2 className='font-semibold'>Conditions</h2><p className='text-sm text-ui-muted'>All conditions must match the normalized event.</p>
                            {conditions.map((condition, index) => <div key={index} className='grid min-w-0 items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]'>
                                <label className='text-xs'>Field<input required aria-label={`Condition ${index + 1} field`} value={condition.path} onChange={event => changeCondition(index, 'path', event.target.value)} className={fieldClass} /></label>
                                <label className='text-xs'>Operator<select aria-label={`Condition ${index + 1} operator`} value={condition.operator} onChange={event => changeCondition(index, 'operator', event.target.value)} className={fieldClass}>{['equals', 'contains', 'regex'].map(value => <option key={value}>{value}</option>)}</select></label>
                                <label className='text-xs'>Value<input required aria-label={`Condition ${index + 1} value`} value={condition.value} onChange={event => changeCondition(index, 'value', event.target.value)} className={fieldClass} /></label>
                                <button type='button' aria-label={`Remove condition ${index + 1}`} disabled={conditions.length <= 1} className='rounded-lg border border-ui-border p-3 text-sm disabled:opacity-50' onClick={() => setDraft({ ...draft, definition: { conditions: conditions.filter((_, i) => i !== index) } })}>Remove</button>
                            </div>)}
                            <button type='button' disabled={conditions.length >= 8} className='justify-self-start rounded-lg border border-ui-border px-3 py-2 text-sm disabled:opacity-50' onClick={() => setDraft({ ...draft, definition: { conditions: [...conditions, { path: '', operator: 'equals', value: '' }] } })}>Add condition</button>
                        </div>}
                        {data.canEdit && <button type='submit' className='justify-self-start rounded-lg bg-ui-primary px-4 py-2 font-semibold text-ui-canvas disabled:opacity-50'>{busy ? 'Saving…' : 'Save changes'}</button>}
                    </fieldset>
                </form>
            </DashboardPanel>
            <DashboardPanel className='grid gap-4 p-4 sm:p-6'>
                <h2 className='text-lg font-semibold'>Audit log</h2>
                {!data.audit.length && <p className='text-sm text-ui-muted'>No recorded changes for this rule in this organization.</p>}
                <ol className='divide-y divide-ui-border'>{data.audit.map(entry => <li key={entry.id} className='py-4'>
                    <div className='flex flex-wrap justify-between gap-2 text-sm'><p className='font-semibold'>{entry.event_type === 'mill.rule.created' ? 'Rule created' : entry.event_type === 'mill.rule.imported' ? 'Rule imported' : 'Rule updated'}{entry.context.action ? ` · ${entry.context.action}` : ''} · {entry.actor_id || 'System'}</p><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></div>
                    {entry.context.after && <dl className='mt-3 grid gap-2 text-sm'>{Object.entries(entry.context.after).filter(([key, value]) => JSON.stringify(entry.context.before?.[key]) !== JSON.stringify(value)).map(([key, value]) => <div key={key} className='min-w-0'><dt className='font-semibold capitalize'>{key === 'definition' ? 'Conditions' : key}</dt><dd className='wrap-break-word whitespace-pre-wrap text-ui-muted'>{entry.context.before && <><span>{displayValue(entry.context.before[key])}</span><span aria-label='changed to'> → </span></>}{displayValue(value)}</dd></div>)}</dl>}
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
