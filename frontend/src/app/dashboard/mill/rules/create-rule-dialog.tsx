'use client'
import { useEffect, useRef, useState } from 'react'
import { requestJson, type MillRule } from './detection-rules'
import { ruleCategories, type RuleCategory } from './rule-categories'
import ConditionBuilder, { conditionError, fieldValues, ruleInput, type Condition } from './condition-builder'

export default function CreateRuleDialog({ category, organizationId, canManage, canManageRetention, rules, onClose, onCreated }: { category: RuleCategory, organizationId: string, canManage: boolean, canManageRetention: boolean, rules: MillRule[], onClose: () => void, onCreated: (rule: MillRule) => void }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const active = useRef(true)
    const [name, setName] = useState(''), [explanation, setExplanation] = useState(''), [severity, setSeverity] = useState('medium')
    const [stage, setStage] = useState(category === 'analysis' ? 'analyze' : category === 'detection' ? 'detect' : 'match')
    const [action, setAction] = useState('keep'), [conditions, setConditions] = useState<Condition[]>([{ path: 'event_type', operator: 'equals', value: '' }])
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [options, setOptions] = useState(fieldValues)
    const [editingJson, setEditingJson] = useState(false)
    const [suggestionError, setSuggestionError] = useState('')
    useEffect(() => {
        active.current = true
        const element = dialog.current
        element?.showModal()
        return () => { active.current = false; element?.close() }
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        const next = Object.fromEntries(Object.entries(fieldValues).map(([key, values]) => [key, [...values]]))
        for (const rule of rules) for (const condition of rule.definition?.conditions || []) {
            next[condition.path] ||= []
            if (condition.operator === 'equals' && !next[condition.path].includes(condition.value)) next[condition.path].push(condition.value)
        }
        setOptions(next)
        requestJson<{ events?: Array<{ event_type?: string, normalized?: Record<string, unknown> }> }>(`/api/backend/mill/events?organizationId=${encodeURIComponent(organizationId)}&limit=50`, { signal: controller.signal }).then(payload => {
            if (controller.signal.aborted) return
            for (const event of payload.events || []) for (const key of ['event_type', 'action', 'outcome', 'service', 'log_type']) {
                const value = key === 'event_type' ? event.event_type : event.normalized?.[key]
                if (typeof value === 'string' && value.length <= 200 && !next[key].includes(value)) next[key].push(value)
            }
            setOptions({ ...next })
        }).catch(() => { if (!controller.signal.aborted) setSuggestionError('Recent event suggestions could not be loaded.') })
        return () => controller.abort()
    }, [organizationId, rules])
    const signature = { name, explanation, severity, stage, action, match: 'all', conditions }
    const permitted = canManage && (stage !== 'analyze' || canManageRetention)
    const invalid = conditionError(conditions)
    async function submit() {
        if (busy || !permitted || editingJson || invalid) return
        setBusy(true); setError('')
        try {
            const result = await requestJson<{ rule: MillRule }>(`/api/backend/mill/rules?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify(signature) })
            if (active.current) onCreated(result.rule)
        } catch (cause) { if (!active.current) return; setError(cause instanceof Error ? cause.message : 'Could not create rule.'); setBusy(false) }
    }
    return <dialog ref={dialog} id='mill-rule-create' aria-labelledby='create-rule-title' onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-black/60 sm:p-6'>
        <header className='mb-5 flex items-center justify-between gap-3'><h2 id='create-rule-title' className='text-xl font-semibold'>Create rule</h2><button type='button' aria-label='Close create rule' disabled={busy} onClick={onClose} className='rounded-md border border-ui-border px-3 py-2 text-sm'>Close</button></header>
        <form onSubmit={event => { event.preventDefault(); void submit() }} className='grid min-w-0 gap-5'>
            {error && <p role='alert' className='rounded-md border border-red-400/40 p-3 text-sm'>{error}</p>}
            <fieldset disabled={busy} className='grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
                <div className='grid min-w-0 content-start gap-4'>
                    <label className='grid gap-1 text-sm'>Name<input autoFocus required minLength={2} maxLength={120} aria-label='Rule name' value={name} onChange={event => setName(event.target.value)} className={ruleInput} /></label>
                    <label className='grid gap-1 text-sm'>Description<textarea required minLength={10} maxLength={500} rows={2} aria-label='Rule explanation' value={explanation} onChange={event => setExplanation(event.target.value)} className={ruleInput} /></label>
                    <div className='grid gap-3 sm:grid-cols-3'>
                        <label className='grid gap-1 text-xs'>Filter<select aria-label='Rule filter' value={stage} onChange={event => { setStage(event.target.value); if (event.target.value !== 'analyze') setAction('keep') }} className={ruleInput}>{Object.entries(ruleCategories).map(([key, item]) => <option key={key} value={key === 'analysis' ? 'analyze' : key === 'detection' ? 'detect' : key}>{item.label}</option>)}</select></label>
                        <label className='grid gap-1 text-xs'>Action<select aria-label='Rule action' value={action} onChange={event => setAction(event.target.value)} className={ruleInput}><option value='keep'>Store</option>{stage === 'analyze' && <option value='drop'>Drop</option>}</select></label>
                        <label className='grid gap-1 text-xs'>Severity<select aria-label='Rule severity' value={severity} onChange={event => setSeverity(event.target.value)} className={ruleInput}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value}>{value}</option>)}</select></label>
                    </div>
                    <div className='flex justify-between text-sm font-semibold'><h3>Conditions</h3><span className='font-mono text-xs text-ui-muted'>ALL</span></div>
                    {suggestionError && <p role='status' className='text-xs text-ui-muted'>{suggestionError}</p>}
                    <ConditionBuilder conditions={conditions} onChange={setConditions} options={options} onEditingJson={setEditingJson} />
                </div>
                <aside className='min-w-0 rounded-lg border border-ui-border bg-ui-raised p-4 lg:sticky lg:top-0 lg:self-start'><h3 className='mb-3 text-sm font-semibold'>Rule JSON</h3><pre aria-label='Rule JSON preview' className='max-h-[65vh] overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs leading-6'>{JSON.stringify(signature, null, 2)}</pre></aside>
            </fieldset>
            <footer className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4'>
                <p className='text-xs text-ui-muted'>{!permitted ? stage === 'analyze' ? 'System administrator access is required for retention rules.' : 'Owner or admin access is required.' : action === 'drop' ? 'Matching new events will not be stored.' : ''}</p>
                <button type='submit' disabled={busy || !permitted || editingJson || Boolean(invalid) || name.trim().length < 2 || explanation.trim().length < 10} className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy ? 'Creating…' : 'Create rule'}</button>
            </footer>
            {conditions.some(condition => condition.operator === 'regex' && condition.value) && invalid && <p role='alert' className='text-sm text-red-400'>{invalid}</p>}
        </form>
    </dialog>
}
