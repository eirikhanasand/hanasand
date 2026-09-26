'use client'
import { useId, useState } from 'react'

export type Condition = { path: string, operator: string, value: string }
export const ruleInput = 'w-full min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-sm text-ui-text outline-none focus:border-ui-primary disabled:opacity-60'
export const fieldValues: Record<string, string[]> = {
    event_type: ['application', 'authentication', 'database', 'network', 'process', 'vulnerability'],
    action: ['login', 'log', 'exec', 'alert', 'request'], outcome: ['success', 'failure', 'unknown'],
    level: ['debug', 'info', 'warn', 'error', 'fatal'], 'http.method': ['GET', 'POST', 'PUT', 'DELETE'],
    'http.status_code': ['200', '201', '400', '401', '403', '404', '500'],
    service: [], message: [], log_type: [], 'source.ip': [], 'source.country': [], 'user.id': [], 'device.id': [],
    'process.command_line': [], 'mongo.command': [], 'mongo.database': [],
}

export function Suggestions({ label, value, options, onChange, placeholder }: { label: string, value: string, options: string[], onChange: (value: string) => void, placeholder?: string }) {
    const id = useId(), [open, setOpen] = useState(false), [active, setActive] = useState(-1)
    const query = value.toLowerCase()
    const matches = [...new Set(options)].filter(option => option.toLowerCase().includes(query)).sort((a, b) => Number(b.toLowerCase().startsWith(query)) - Number(a.toLowerCase().startsWith(query)) || a.localeCompare(b)).slice(0, 20)
    function choose(value: string) { onChange(value); setOpen(false); setActive(-1) }
    return <div className='relative min-w-0'>
        <input role='combobox' aria-label={label} aria-expanded={open} aria-controls={id} aria-autocomplete='list' aria-activedescendant={active >= 0 && matches[active] ? `${id}-${active}` : undefined} autoComplete='off' value={value} placeholder={placeholder} className={ruleInput}
            onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1) }} onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))) }
                if (event.key === 'Enter' && open && active >= 0 && matches[active]) { event.preventDefault(); choose(matches[active]) }
                if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
            }} />
        {open && <ul id={id} role='listbox' aria-label={`${label} suggestions`} className='absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-ui-border bg-ui-panel p-1 shadow-xl'>
            {matches.map((option, index) => <li role='option' aria-selected={index === active} id={`${id}-${index}`} key={option} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)} className={`cursor-pointer rounded px-3 py-2 font-mono text-sm hover:bg-ui-raised ${index === active ? 'bg-ui-raised' : ''}`}>{option}</li>)}
            {!matches.length && <li className='px-3 py-2 text-xs text-ui-muted'>No suggestions</li>}
        </ul>}
    </div>
}

export function conditionError(conditions: Condition[]) {
    if (!conditions.length || conditions.length > 8) return 'Add 1–8 conditions.'
    for (const condition of conditions) {
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(condition.path)) return 'Choose a field or enter a valid field path.'
        if (!['equals', 'contains', 'regex'].includes(condition.operator)) return 'Choose equals, contains, or regex.'
        if (!condition.value || condition.value.length > 200) return 'Enter a value of 1–200 characters.'
        if (condition.operator === 'regex') { try { new RegExp(condition.value) } catch { return 'Invalid regular expression.' } }
    }
    return ''
}

export default function ConditionBuilder({ conditions, onChange, options = fieldValues, label = 'Condition', onEditingJson }: { conditions: Condition[], onChange: (conditions: Condition[]) => void, options?: Record<string, string[]>, label?: string, onEditingJson?: (editing: boolean) => void }) {
    const [json, setJson] = useState<string | null>(null), [jsonError, setJsonError] = useState('')
    function update(index: number, patch: Partial<Condition>) { onChange(conditions.map((condition, i) => i === index ? { ...condition, ...patch } : condition)) }
    return <div className='grid min-w-0 gap-3'>
        {conditions.map((condition, index) => {
            const examples = options[condition.path] || []
            const example = examples[0] || 'example'
            const escaped = example.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const samples = condition.operator === 'regex' ? [`^${escaped}$`, `^${escaped}`, `${escaped}$`, `^(${escaped}|other)$`] : examples.slice(0, 4)
            return <section key={index} className='grid min-w-0 gap-3 rounded-lg border border-ui-border p-3'>
                <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]'>
                    <label className='grid min-w-0 gap-1 text-xs'>Field<Suggestions label={`${label} ${index + 1} field`} value={condition.path} options={Object.keys(options)} onChange={path => update(index, { path })} /></label>
                    <label className='grid gap-1 text-xs'>Operator<select aria-label={`${label} ${index + 1} operator`} className={ruleInput} value={condition.operator} onChange={event => update(index, { operator: event.target.value })}>{['equals', 'contains', 'regex'].map(value => <option key={value}>{value}</option>)}</select></label>
                </div>
                <label className='grid gap-1 text-xs'>{condition.path === 'event_type' ? 'Event type' : condition.operator === 'regex' ? 'Pattern' : 'Value'}<Suggestions label={`${label} ${index + 1} value`} value={condition.value} options={condition.operator === 'regex' ? [] : examples} placeholder={condition.operator === 'regex' ? `^${escaped}$` : example} onChange={value => update(index, { value })} /></label>
                <div className='flex min-w-0 flex-wrap gap-2'>{samples.map(value => <button type='button' key={value} onClick={() => update(index, { value })} className='max-w-full break-all rounded border border-ui-border bg-ui-raised px-2 py-1 font-mono text-xs'>{condition.operator === 'regex' ? `/${value}/i` : JSON.stringify(value)}</button>)}</div>
                <pre aria-label={`${label} ${index + 1} JSON`} className='overflow-auto rounded bg-ui-raised p-3 font-mono text-xs'>{JSON.stringify(condition, null, 2)}</pre>
                <button type='button' disabled={conditions.length <= 1} onClick={() => onChange(conditions.filter((_, i) => i !== index))} className='justify-self-end text-xs text-ui-muted disabled:opacity-40'>Remove condition</button>
            </section>
        })}
        <div className='flex flex-wrap gap-3'><button type='button' disabled={conditions.length >= 8} onClick={() => onChange([...conditions, { path: 'event_type', operator: 'equals', value: '' }])} className='rounded-md border border-ui-border px-3 py-2 text-sm disabled:opacity-40'>Add condition</button><button type='button' onClick={() => { onEditingJson?.(true); setJson(JSON.stringify(conditions, null, 2)); setJsonError('') }} className='rounded-md border border-ui-border px-3 py-2 text-sm'>Edit JSON</button></div>
        {json !== null && <div className='grid gap-2'><textarea aria-label='Conditions JSON' rows={10} spellCheck={false} className={ruleInput} value={json} onChange={event => setJson(event.target.value)} /><button type='button' className='justify-self-start rounded-md border border-ui-border px-3 py-2 text-sm' onClick={() => {
            try {
                const parsed = JSON.parse(json)
                if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item.path !== 'string' || typeof item.operator !== 'string' || typeof item.value !== 'string')) throw new Error('Use an array of { "path", "operator", "value" } objects.')
                const error = conditionError(parsed)
                if (error) throw new Error(error)
                onChange(parsed); onEditingJson?.(false); setJson(null); setJsonError('')
            } catch (cause) { setJsonError(cause instanceof Error ? cause.message : 'Invalid JSON.') }
        }}>Apply JSON</button>{jsonError && <p role='alert' className='text-sm text-ui-danger'>{jsonError}</p>}</div>}
    </div>
}
