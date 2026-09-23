import { DashboardPanel } from '@/components/dashboard/ui'
import type { MillRule } from '../detection-rules'

type Definition = NonNullable<MillRule['definition']>
type Condition = NonNullable<Definition['conditions']>[number]
const inputClass = 'w-full min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-sm text-ui-text outline-none focus:border-ui-primary disabled:opacity-70'
const parameterLabels: Record<string, { label: string, unit: string, max: number }> = {
    windowMinutes: { label: 'Time window', unit: 'minutes', max: 10080 },
    minimumCount: { label: 'Minimum count', unit: 'events', max: 1000 },
    distanceKm: { label: 'Minimum distance', unit: 'km', max: 20040 },
    historyLimit: { label: 'History depth', unit: 'prior logins', max: 1000 },
    requestThreshold: { label: 'Alert above', unit: 'requests per IP', max: 1000 },
}

export default function SignatureEditor({ rule, disabled, onChange }: { rule: MillRule, disabled: boolean, onChange: (definition: Definition) => void }) {
    const definition = rule.definition || { match: 'all', conditions: [] }
    const analyze = definition.stage === 'analyze'
    const brute = rule.id.startsWith('auth.brute_force_success.')
    const spray = rule.id.startsWith('auth.password_spray.')
    const builtIn = rule.source === 'hanasand'
    const conditions = definition.conditions || []
    function selectors(key: 'conditions' | 'failureConditions', title: string, required: string) {
        const items = definition[key] || []
        return <section className='grid min-w-0 content-start gap-3 rounded-lg border border-ui-border p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'><h3 className='text-sm font-semibold'>{title}</h3><span className='text-xs text-ui-muted'>ALL conditions</span></div>
            {required && <code className='whitespace-pre-wrap wrap-break-word text-xs text-ui-muted'>{required}</code>}
            {items.map((condition, index) => <div key={index} className='grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]'>
                <label className='grid gap-1 text-xs'>Field<input required maxLength={80} aria-label={`${title} ${index + 1} field`} placeholder='EventID' value={condition.path} onChange={event => update(index, 'path', event.target.value)} className={inputClass} /></label>
                <label className='grid gap-1 text-xs'>Operator<select aria-label={`${title} ${index + 1} operator`} value={condition.operator} onChange={event => update(index, 'operator', event.target.value)} className={inputClass}>{['equals', 'contains', 'regex'].map(value => <option key={value}>{value}</option>)}</select></label>
                <label className='grid gap-1 text-xs'>Value<input required maxLength={200} aria-label={`${title} ${index + 1} value`} placeholder='4625' value={condition.value} onChange={event => update(index, 'value', event.target.value)} className={inputClass} /></label>
                <button type='button' aria-label={`Remove ${title.toLowerCase()} condition ${index + 1}`} disabled={!builtIn && items.length <= 1} className='self-end rounded-md border border-ui-border px-3 py-2 text-sm disabled:opacity-40' onClick={() => onChange({ ...definition, [key]: items.filter((_, i) => i !== index) })}>Remove</button>
            </div>)}
            {!items.length && <p className='text-xs text-ui-muted'>No additional restrictions.</p>}
            <button type='button' disabled={items.length >= 8} onClick={() => onChange({ ...definition, [key]: [...items, { path: '', operator: 'equals', value: '' }] })} className='justify-self-start rounded-md border border-ui-border px-3 py-2 text-xs font-medium disabled:opacity-40'>Add {title.toLowerCase()} condition</button>
        </section>
        function update(index: number, keyName: keyof Condition, value: string) {
            onChange({ ...definition, [key]: items.map((condition, i) => i === index ? { ...condition, [keyName]: value } : condition) })
        }
    }
    const signature = {
        rule: rule.id.replace(/\.v\d+$/, ''),
        ...(analyze ? { stage: 'before storage', action: definition.action } : {}),
        ...(builtIn ? { engine: brute ? 'sequence' : spray ? 'distinct_count' : 'builtin', ...(brute ? { group_by: 'user.id', sequence: [{ event_type: 'authentication', action: 'login', outcome: 'failure', where: definition.failureConditions || [], count_at_least: definition.parameters?.minimumCount }, { event_type: 'authentication', action: 'login', outcome: 'success', where: conditions }] } : { where: conditions }), ...definition.parameters } : { match: 'all', where: conditions }),
    }
    return <DashboardPanel className='overflow-hidden'>
        <header className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-5 py-4'><div><h2 className='font-semibold'>{analyze ? 'Analyze rule' : 'Detection signature'}</h2><p className='mt-1 text-xs text-ui-muted'>{analyze ? 'Runs before storage and detection. Dropped logs cannot be recovered.' : 'Selectors and parameters are executed on new events and replays.'}</p></div><span className='rounded-md border border-ui-border px-2 py-1 font-mono text-xs'>{analyze ? 'ANALYZE FIRST' : brute ? 'SEQUENCE' : spray ? 'DISTINCT COUNT' : 'MATCH'}</span></header>
        <div className='grid min-w-0 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'>
            <fieldset disabled={disabled} className='grid min-w-0 content-start gap-4 p-4 sm:p-5'>
                {analyze && <><label className='grid gap-2 text-sm'>Action<select aria-label='Action' className={inputClass} value={definition.action} onChange={event => onChange({ ...definition, action: event.target.value as 'drop' | 'keep' })}><option value='drop'>Drop</option><option value='keep'>Store</option></select></label><p className='text-sm text-ui-muted'>{rule.explanation}</p></>}
                {Object.keys(definition.parameters || {}).length > 0 && <div className='grid gap-3 sm:grid-cols-2'>{Object.entries(definition.parameters || {}).map(([key, value]) => {
                    const meta = parameterLabels[key]
                    return <label key={key} className='grid gap-1.5 text-xs font-medium'>{key === 'minimumCount' ? (spray ? 'Minimum distinct users' : 'Minimum failed logins') : meta?.label || key}<div className='flex items-center gap-2'><input required type='number' min={1} max={meta?.max} step={1} value={Number.isFinite(value) ? value : ''} onChange={event => onChange({ ...definition, parameters: { ...definition.parameters, [key]: event.target.value === '' ? NaN : Number(event.target.value) } })} className={inputClass} /><span className='shrink-0 text-ui-muted'>{key === 'minimumCount' && spray ? 'users' : meta?.unit}</span></div></label>
                })}</div>}
                {brute && <><p className='font-mono text-xs text-ui-muted'>GROUP BY user.id · failure → success</p>{selectors('failureConditions', 'Failure selector', 'event_type = authentication AND action = login AND outcome = failure')}</>}
                {(!analyze || !builtIn) && selectors('conditions', brute ? 'Success selector' : 'Event selector', builtIn ? brute ? 'event_type = authentication AND action = login AND outcome = success' : rule.id.startsWith('auth.') ? `event_type = authentication AND action = login AND outcome = ${spray ? 'failure' : 'success'}` : rule.detectionLogic || '' : '')}
                {!analyze && <p className='text-xs leading-5 text-ui-muted'>Fields use paths in the normalized event, such as EventID, event.code, signature_id, or source.ip. Field names are case-sensitive; values are case-insensitive. Use regex <code className='font-mono'>^(4625|4771)$</code> to select multiple event IDs. Empty built-in selectors accept every event matching the required fields.</p>}
            </fieldset>
            <aside className='min-w-0 border-t border-ui-border bg-ui-raised p-5 xl:border-t-0 xl:border-l'><h3 className='mb-3 text-xs font-semibold uppercase tracking-wide text-ui-muted'>Signature preview</h3><pre aria-label='Signature preview' className='max-h-[38rem] overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-xs leading-6 text-ui-text'>{JSON.stringify(signature, null, 2)}</pre></aside>
        </div>
    </DashboardPanel>
}
