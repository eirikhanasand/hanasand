'use client'

import type { AutomationPayload, JsonRule } from '@/utils/automations/client'

export const defaultJsonRule: JsonRule = { path: '', operator: 'gt', value: 80, aggregate: 'max' }

export default function JsonRuleForm({ draft, onChange, inputClass }: { draft: AutomationPayload, onChange: (draft: AutomationPayload) => void, inputClass: string }) {
    const rule = draft.jsonRule || defaultJsonRule
    const update = (change: Partial<JsonRule>) => onChange({ ...draft, jsonRule: { ...rule, ...change } })
    return <fieldset className='grid gap-3 rounded-lg border border-ui-border p-3'>
        <legend className='px-1 text-sm font-semibold text-ui-text'>JSON alert rule</legend>
        <label className='grid gap-1.5 text-xs text-ui-muted'>Source<select className={inputClass} value={draft.targetUrl === 'system:metrics' ? 'host' : 'url'} onChange={event => onChange({ ...draft, targetUrl: event.target.value === 'host' ? 'system:metrics' : '' })}><option value='url'>URL above</option><option value='host'>Host telemetry (administrator)</option></select></label>
        <label className='grid gap-1.5 text-xs text-ui-muted'>JSON field<input className={inputClass} value={rule.path} placeholder='host.storage.*.usedPercent' onChange={event => update({ path: event.target.value })} /></label>
        <div className='grid gap-3 sm:grid-cols-2'>
            <label className='grid gap-1.5 text-xs text-ui-muted'>Combine values<select className={inputClass} value={rule.aggregate} onChange={event => update({ aggregate: event.target.value as JsonRule['aggregate'] })}><option value='max'>Maximum</option><option value='min'>Minimum</option><option value='avg'>Average</option><option value='first'>First value</option></select></label>
            <label className='grid gap-1.5 text-xs text-ui-muted'>Alert when<select className={inputClass} value={rule.operator} onChange={event => update({ operator: event.target.value as JsonRule['operator'] })}><option value='gt'>Above</option><option value='gte'>At or above</option><option value='lt'>Below</option><option value='lte'>At or below</option><option value='eq'>Equal to</option><option value='ne'>Not equal to</option></select></label>
        </div>
        <label className='grid gap-1.5 text-xs text-ui-muted'>Comparison value<input className={inputClass} value={String(rule.value)} onChange={event => { const raw = event.target.value; update({ value: raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw }) }} /></label>
        <p className='text-xs leading-5 text-ui-muted'>Use dots for nested fields and * for array items. Checks with the same source share one response per minute. Missing fields fail the check. Temperature and power use the lowest margin; below 0 means a device is above its alert limit.</p>
    </fieldset>
}
