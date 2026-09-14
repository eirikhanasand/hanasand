'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

type Organization = { id: string, name?: string, slug?: string, role?: string }
export type MillRule = { id: string, detectionLogic?: string, recordId?: string, rule_id?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: { conditions?: Array<{ path: string, operator: string, value: string }> } }

export default function DetectionRules() {
    const latestOrganization = useRef('')
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [organizationId, setOrganizationId] = useState('')
    const [rules, setRules] = useState<MillRule[]>([])
    const [showImports, setShowImports] = useState(false)
    const [ruleName, setRuleName] = useState('')
    const [ruleExplanation, setRuleExplanation] = useState('')
    const [ruleSeverity, setRuleSeverity] = useState('medium')
    const [rulePath, setRulePath] = useState('event_type')
    const [ruleOperator, setRuleOperator] = useState('equals')
    const [ruleValue, setRuleValue] = useState('')
    const [packName, setPackName] = useState('')
    const [packVersion, setPackVersion] = useState('')
    const [packReference, setPackReference] = useState('')
    const [packJson, setPackJson] = useState('{"rules":[{"id":"example-login","name":"Example login rule","description":"Example imported rule for review.","level":"medium","conditions":[{"path":"event_type","operator":"equals","value":"authentication"}]}]}')
    const [sigmaPackName, setSigmaPackName] = useState('')
    const [sigmaPackVersion, setSigmaPackVersion] = useState('')
    const [sigmaPackReference, setSigmaPackReference] = useState('')
    const [sigmaYaml, setSigmaYaml] = useState('title: Suspicious authentication event\nstatus: experimental\nlogsource:\n  product: identity\ndetection:\n  selection:\n    event_type: authentication\n    outcome: failure\n  condition: selection\nlevel: high\n')
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')

    useEffect(() => { void loadOrganizations() }, [])
    useEffect(() => { if (organizationId) void loadMill(organizationId) }, [organizationId])

    async function loadOrganizations() {
        try {
            const payload = await requestJson<{ organizations?: Organization[] }>('/api/organizations')
            const next = payload.organizations || []
            setOrganizations(next)
            const requestedId = new URLSearchParams(window.location.search).get('organizationId')
            setOrganizationId(next.find(org => org.id === requestedId)?.id || next[0]?.id || '')
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function loadMill(id: string) {
        latestOrganization.current = id
        try {
            setError('')
            const payload = await requestJson<{ rules?: MillRule[] }>(`/api/backend/mill/rules?organizationId=${encodeURIComponent(id)}`)
            if (latestOrganization.current === id) setRules(payload.rules || [])
        } catch (cause) { if (latestOrganization.current === id) { setError(errorMessage(cause)); setRules([]) } }
    }

    async function createRule() {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/mill/rules?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ name: ruleName, explanation: ruleExplanation, severity: ruleSeverity, conditions: [{ path: rulePath, operator: ruleOperator, value: ruleValue }] }) })
            setStatus('Custom rule created and enabled for new events.')
            setRuleName(''); setRuleExplanation(''); setRuleValue('')
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function toggleRule(rule: MillRule) {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/mill/rules/${encodeURIComponent(rule.recordId || rule.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ action: rule.enabled === false ? 'enable' : 'disable' }) })
            setStatus(`${rule.name} ${rule.enabled === false ? 'enabled' : 'disabled'}.`)
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function importRulePack() {
        if (!organizationId) return
        try {
            const parsed = JSON.parse(packJson) as { rules?: unknown }
            await requestJson(`/api/backend/mill/rules/packs?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName, packVersion, sourceReference: packReference, rules: parsed.rules }) })
            setStatus('Signature pack imported and enabled for new events.')
            setPackName(''); setPackVersion(''); setPackReference('')
            setShowImports(false)
            await loadMill(organizationId)
        } catch (cause) { setError(cause instanceof SyntaxError ? 'Signature pack JSON is invalid.' : errorMessage(cause)) }
    }

    async function importSigmaPack() {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/mill/rules/sigma?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName: sigmaPackName, packVersion: sigmaPackVersion, sourceReference: sigmaPackReference, yaml: sigmaYaml }) })
            setStatus('Sigma rules imported and enabled for new events.')
            setSigmaPackName(''); setSigmaPackVersion(''); setSigmaPackReference('')
            setShowImports(false)
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    const selectedOrganization = organizations.find(org => org.id === organizationId)
    const canManageRules = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'

    return (
        <DashboardPage className='!gap-6 !p-4 lg:!p-6'>
            <div className='flex flex-wrap items-center justify-between gap-4'>
                <div><p className='text-sm text-ui-muted'>Security tools</p><h1 className='mt-1 text-2xl font-semibold'>Detection rules</h1><p className='mt-2 text-sm text-ui-muted'>Create, import, and enable the rules that monitor your security events.</p></div>
                <div className='flex max-w-full flex-wrap items-center gap-3'>
                    <select value={organizationId} onChange={event => { latestOrganization.current = event.target.value; setRules([]); setOrganizationId(event.target.value); setStatus(''); const url = new URL(window.location.href); url.searchParams.set('organizationId', event.target.value); window.history.replaceState(null, '', url) }} className='h-10 max-w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text' aria-label='Organization'>{!organizations.length && <option value=''>No organizations available</option>}{organizations.map(org => <option key={org.id} value={org.id}>{org.name || org.slug || org.id}</option>)}</select>
                    <button type='button' aria-expanded={showImports} aria-controls='mill-rule-imports' onClick={() => setShowImports(open => !open)} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>Import</button>
                    <Link href={`/cases${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`} className='rounded-lg border border-ui-border px-4 py-2 text-sm font-semibold text-ui-primary hover:bg-ui-raised'>Cases</Link>
                </div>
            </div>
            {error && <div role='alert' className='rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200'>{error}</div>}
            {status && <div role='status' className='rounded-lg border border-ui-primary/40 bg-ui-primary/10 p-3 text-sm text-ui-text'>{status}</div>}
            {showImports && <DashboardPanel className='grid min-w-0 gap-4 p-4 sm:p-6' id='mill-rule-imports'>
                <h2 className='font-semibold'>Import or create rules</h2>
                <details className='min-w-0 rounded-lg border border-ui-border'>
                    <summary className='cursor-pointer rounded-lg p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ui-primary sm:p-5'>Create custom rule</summary>
                    <form className='grid min-w-0 gap-4 border-t border-ui-border p-4 sm:p-5' onSubmit={event => { event.preventDefault(); void createRule() }}>
                        <div className='grid gap-2 md:grid-cols-3'><input value={ruleName} onChange={event => setRuleName(event.target.value)} placeholder='Rule name' aria-label='Rule name' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><select value={ruleSeverity} onChange={event => setRuleSeverity(event.target.value)} aria-label='Rule severity' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'><option value='low'>Low</option><option value='medium'>Medium</option><option value='high'>High</option><option value='critical'>Critical</option></select><input value={ruleExplanation} onChange={event => setRuleExplanation(event.target.value)} placeholder='Why this matters (10-500 chars)' aria-label='Rule explanation' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></div>
                        <div className='grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]'><input value={rulePath} onChange={event => setRulePath(event.target.value)} placeholder='event_type' aria-label='Rule field path' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><select value={ruleOperator} onChange={event => setRuleOperator(event.target.value)} aria-label='Rule operator' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'><option value='equals'>equals</option><option value='contains'>contains</option><option value='regex'>regex</option></select><input value={ruleValue} onChange={event => setRuleValue(event.target.value)} placeholder='authentication' aria-label='Rule value' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><button type='submit' className='min-w-0 h-10 rounded-md bg-ui-text px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50' disabled={!canManageRules || !ruleName.trim() || !ruleExplanation.trim() || !rulePath.trim() || !ruleValue.trim()}>Create rule</button></div>
                        {!canManageRules && <p className='text-xs text-ui-muted'>Owner or admin access is required to change organization rules.</p>}
                    </form>
                </details>
                <details className='min-w-0 rounded-lg border border-ui-border'>
                    <summary className='cursor-pointer rounded-lg p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ui-primary sm:p-5'>Import JSON pack</summary>
                    <form className='grid min-w-0 gap-4 border-t border-ui-border p-4 sm:p-5' onSubmit={event => { event.preventDefault(); void importRulePack() }}>
                        <p className='text-xs text-ui-muted'>Use the bounded JSON shape for vendor packs. Sigma YAML has its own importer below and is compiled into auditable field rules.</p>
                        <div className='grid gap-2 md:grid-cols-3'><input value={packName} onChange={event => setPackName(event.target.value)} placeholder='Pack name' aria-label='Pack name' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={packVersion} onChange={event => setPackVersion(event.target.value)} placeholder='Version' aria-label='Pack version' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={packReference} onChange={event => setPackReference(event.target.value)} placeholder='https://source.example/rules' aria-label='Pack source reference' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></div>
                        <textarea value={packJson} onChange={event => setPackJson(event.target.value)} aria-label='Pack JSON' className='w-full min-w-0 min-h-32 rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text' />
                        <button type='submit' className='min-w-0 h-10 justify-self-start rounded-md bg-ui-text px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50' disabled={!canManageRules || !packName.trim() || !packVersion.trim() || !packReference.trim()}>Import pack</button>
                    </form>
                </details>
                <details className='min-w-0 rounded-lg border border-ui-border'>
                    <summary className='cursor-pointer rounded-lg p-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ui-primary sm:p-5'>Import Sigma YAML</summary>
                    <form className='grid min-w-0 gap-4 border-t border-ui-border p-4 sm:p-5' onSubmit={event => { event.preventDefault(); void importSigmaPack() }}>
                        <p className='text-xs text-ui-muted'>Supports common selection, OR, and 1-of selection forms. Rules are bounded to normalized JSON fields; executable transforms are never run.</p>
                        <div className='grid gap-2 md:grid-cols-3'><input value={sigmaPackName} onChange={event => setSigmaPackName(event.target.value)} placeholder='Sigma pack name' aria-label='Sigma pack name' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={sigmaPackVersion} onChange={event => setSigmaPackVersion(event.target.value)} placeholder='Version' aria-label='Sigma pack version' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={sigmaPackReference} onChange={event => setSigmaPackReference(event.target.value)} placeholder='https://github.com/.../rule.yml' aria-label='Sigma pack source reference' className='min-w-0 h-10 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></div>
                        <textarea value={sigmaYaml} onChange={event => setSigmaYaml(event.target.value)} aria-label='Sigma YAML' className='w-full min-w-0 min-h-48 rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text' />
                        <button type='submit' className='min-w-0 h-10 justify-self-start rounded-md bg-ui-text px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50' disabled={!canManageRules || !sigmaPackName.trim() || !sigmaPackVersion.trim() || !sigmaPackReference.trim() || !sigmaYaml.trim()}>Import Sigma</button>
                    </form>
                </details>
            </DashboardPanel>}
            <DashboardPanel className='grid min-w-0 gap-6 p-4 sm:p-6' id='mill-rules'>
                <div><h2 className='font-semibold'>Rule library</h2><p className='mt-1 text-sm text-ui-muted'>Built-in rules can be tuned per organization. Custom rules match normalized JSON fields on new events.</p></div>
                {!rules.length && <p className='text-sm text-ui-muted'>No rules available for this organization.</p>}
                <ul className='grid min-w-0 gap-3' aria-label='Detection rules'>
                    {rules.map(rule => <li key={rule.id} className='flex min-w-0 items-center gap-4 rounded-lg border border-ui-border bg-ui-raised pr-4'>
                        <Link href={`/mill/rules/${encodeURIComponent(rule.id)}?organizationId=${encodeURIComponent(organizationId)}`} className='min-w-0 flex-1 rounded-lg p-4 hover:bg-ui-panel focus-visible:outline-2 focus-visible:outline-ui-primary'>
                            <div className='flex flex-wrap items-center gap-3'><h3 className='font-semibold text-ui-primary'>{rule.name}</h3><span className='text-xs'>{rule.enabled === false ? 'Disabled' : 'Enabled'}</span></div>
                            <p className='mt-1 break-all font-mono text-xs text-ui-muted'>{rule.id} · v{rule.version}</p>
                            <p className='mt-2 text-sm text-ui-muted'>{rule.explanation}</p>
                            <p className='mt-2 text-xs text-ui-muted'>{rule.family} · {rule.severity} · {rule.source === 'open_source' ? 'Imported rule' : rule.source === 'owned' ? 'Custom rule' : 'Hanasand rule'}</p>
                        </Link>
                        <button type='button' aria-label={`${rule.enabled === false ? 'Enable' : 'Disable'} ${rule.name}`} className='shrink-0 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50' disabled={!canManageRules} onClick={() => void toggleRule(rule)}>{rule.enabled === false ? 'Enable' : 'Disable'}</button>
                    </li>)}
                </ul>
            </DashboardPanel>
        </DashboardPage>
    )
}

export async function requestJson<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`); return payload as T }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Mill could not load this workspace.' }
