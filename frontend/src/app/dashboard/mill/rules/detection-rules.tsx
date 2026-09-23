'use client'

import CreateRuleDialog from './create-rule-dialog'
import Link from '@/components/organizations/workspaceLink'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { useEffect, useRef, useState } from 'react'
import { getRuleCategory, ruleCategories, type RuleCategory } from './rule-categories'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export type MillRule = { id: string, hitCount?: number | null, detectionLogic?: string, recordId?: string, rule_id?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: { stage?: 'analyze' | 'match' | 'detect', action?: 'drop' | 'keep', match?: 'all', parameters?: Record<string, number>, failureConditions?: Array<{ path: string, operator: string, value: string }>, conditions?: Array<{ path: string, operator: string, value: string }> } }

export default function DetectionRules({ category }: { category: RuleCategory }) {
    const latestOrganization = useRef('')
    const { organizationId, organizations } = useWorkspace()
    const [rules, setRules] = useState<MillRule[]>([])
    const [canManageRetention, setCanManageRetention] = useState(false)
    const [titleFilter, setTitleFilter] = useState('')
    const [textFilter, setTextFilter] = useState('')
    const [enabledFilter, setEnabledFilter] = useState('all')
    const [severityFilter, setSeverityFilter] = useState('all')
    const [showImports, setShowImports] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
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

    useEffect(() => { if (organizationId) void loadMill(organizationId) }, [organizationId])

    async function loadMill(id: string) {
        latestOrganization.current = id
        try {
            setError('')
            const payload = await requestJson<{ rules?: MillRule[], canManageRetention?: boolean }>(`/api/backend/mill/rules?organizationId=${encodeURIComponent(id)}`)
            if (latestOrganization.current === id) { setRules(payload.rules || []); setCanManageRetention(payload.canManageRetention === true) }
        } catch (cause) { if (latestOrganization.current === id) { setError(errorMessage(cause)); setRules([]) } }
    }

    async function toggleRule(rule: MillRule) {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/mill/rules/${encodeURIComponent(rule.recordId || rule.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ action: rule.enabled === false ? 'enable' : 'disable' }) })
            setStatus(`${rule.name} ${rule.enabled === false ? 'enabled' : 'disabled'}.`)
            if (latestOrganization.current === organizationId) await loadMill(organizationId)
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
            if (latestOrganization.current === organizationId) await loadMill(organizationId)
        } catch (cause) { setError(cause instanceof SyntaxError ? 'Signature pack JSON is invalid.' : errorMessage(cause)) }
    }

    async function importSigmaPack() {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/mill/rules/sigma?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName: sigmaPackName, packVersion: sigmaPackVersion, sourceReference: sigmaPackReference, yaml: sigmaYaml }) })
            setStatus('Sigma rules imported and enabled for new events.')
            setSigmaPackName(''); setSigmaPackVersion(''); setSigmaPackReference('')
            setShowImports(false)
            if (latestOrganization.current === organizationId) await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    const selectedOrganization = organizations.find(org => org.id === organizationId)
    const canManageRules = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'

    const titleQuery = titleFilter.trim().toLowerCase()
    const textQuery = textFilter.trim().toLowerCase()
    const categoryRules = rules.filter(rule => getRuleCategory(rule) === category)
    const filteredRules = categoryRules.filter(rule =>
        rule.name.toLowerCase().includes(titleQuery)
        && (!textQuery || [rule.name, rule.id, rule.rule_id, rule.explanation, rule.family, rule.severity, rule.sourceReference, rule.detectionLogic, ...(rule.evidence || []), ...(rule.definition?.conditions || []).flatMap(condition => [condition.path, condition.operator, condition.value])].join(' ').toLowerCase().includes(textQuery))
        && (enabledFilter === 'all' || (rule.enabled !== false) === (enabledFilter === 'enabled'))
        && (severityFilter === 'all' || rule.severity.toLowerCase() === severityFilter)
    )
    const severities = Array.from(new Set(['informational', 'low', 'medium', 'high', 'critical', ...categoryRules.map(rule => rule.severity.toLowerCase())]))
    const hasFilters = Boolean(titleFilter || textFilter || enabledFilter !== 'all' || severityFilter !== 'all')
    function clearFilters() { setTitleFilter(''); setTextFilter(''); setEnabledFilter('all'); setSeverityFilter('all') }

    return (
        <DashboardPage className='!gap-6 !p-4 lg:!p-6'>
            <div className='flex flex-wrap items-center justify-between gap-4'>
                <div><p className='text-sm text-ui-muted'>Security tools</p><h1 className='mt-1 text-2xl font-semibold'>{ruleCategories[category].label}</h1></div>
                <div className='flex max-w-full flex-wrap items-center gap-3'>

                    <button type='button' aria-expanded={showCreate} aria-controls='mill-rule-create' onClick={() => { setShowCreate(open => !open); setShowImports(false) }} className='rounded-lg border border-ui-border px-4 py-2 text-sm font-semibold text-ui-primary hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>Create</button>
                    <button type='button' aria-expanded={showImports} aria-controls='mill-rule-imports' onClick={() => { setShowImports(open => !open); setShowCreate(false) }} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'>Import</button>
                    <Link href='/cases' className='rounded-lg border border-ui-border px-4 py-2 text-sm font-semibold text-ui-primary hover:bg-ui-raised'>Cases</Link>
                </div>
            </div>
            {error && <div role='alert' className='rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200'>{error}</div>}
            {status && <div role='status' className='rounded-lg border border-ui-primary/40 bg-ui-primary/10 p-3 text-sm text-ui-text'>{status}</div>}
            {showCreate && <CreateRuleDialog key={organizationId} category={category} organizationId={organizationId} canManage={canManageRules} canManageRetention={canManageRetention} rules={rules} onClose={() => setShowCreate(false)} onCreated={rule => {
                setShowCreate(false); setStatus(`${rule.name} created.`); void loadMill(organizationId)
            }} />}
            {showImports && <DashboardPanel className='grid min-w-0 gap-4 p-4 sm:p-6' id='mill-rule-imports'>
                <h2 className='font-semibold'>Import rules</h2>
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
            <DashboardPanel className='grid min-w-0 gap-4 p-4 sm:p-6' id='mill-rules'>
                <h2 className='font-semibold'>Rule library</h2>
                <div role='search' aria-label='Filter rules' className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_auto_auto_auto]'>
                    <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Title<input type='search' value={titleFilter} onChange={event => setTitleFilter(event.target.value)} placeholder='Filter by title' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Search text<input type='search' value={textFilter} onChange={event => setTextFilter(event.target.value)} placeholder='Search descriptions, IDs, evidence…' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Status<select value={enabledFilter} onChange={event => setEnabledFilter(event.target.value)} className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All statuses</option><option value='enabled'>Enabled</option><option value='disabled'>Disabled</option></select></label>
                    <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Severity<select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)} className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All severities</option>{severities.map(severity => <option key={severity} value={severity}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</option>)}</select></label>
                    <button type='button' onClick={clearFilters} disabled={!hasFilters} className='h-9 self-end rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>Clear filters</button>
                </div>
                <p role='status' className='text-xs text-ui-muted'>{filteredRules.length} of {categoryRules.length} rules</p>
                <div role='region' aria-label={`${ruleCategories[category].label} rules`} tabIndex={0} className='min-w-0 overflow-x-auto rounded-md border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    <table className='w-full min-w-[1000px] table-fixed text-left text-sm' aria-label={`${ruleCategories[category].label} rules`}>
                        <colgroup><col className='w-[22%]' /><col className={category === 'analysis' ? 'w-[15%]' : 'w-[23%]'} /><col className='w-[10%]' /><col className='w-[8%]' /><col className='w-[8%]' /><col className='w-[10%]' /><col className='w-[10%]' />{category === 'analysis' && <col className='w-[8%]' />}<col className='w-[9%]' /></colgroup>
                        <thead className='bg-ui-raised text-xs text-ui-muted'><tr>{['Title', 'Description', 'Family', 'Severity', 'Status', 'Source', 'Hits', ...(category === 'analysis' ? ['Action', 'Controls'] : ['Action'])].map(column => <th key={column} scope='col' className='px-3 py-2 font-medium'>{column}</th>)}</tr></thead>
                        <tbody className='divide-y divide-ui-border'>
                            {filteredRules.map(rule => <tr key={rule.id} className='h-16 hover:bg-ui-raised'>
                                <th scope='row' className='px-3 py-2 font-normal'>
                                    <Link href={`/mill/rules/${category}/${encodeURIComponent(rule.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`} className='block rounded-sm focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                        <span className='block truncate font-semibold text-ui-primary' title={rule.name}>{rule.name}</span>
                                        <span className='mt-1 block truncate text-xs text-ui-muted' title={rule.id.replace(/\.v\d+$/, '')}>{rule.id.replace(/\.v\d+$/, '')}</span>
                                    </Link>
                                </th>
                                <td className='px-3 py-2 text-xs text-ui-muted'><span className='line-clamp-2' title={rule.explanation}>{rule.explanation}</span></td>
                                <td className='px-3 py-2 text-xs text-ui-muted'><span className='line-clamp-2' title={rule.family}>{rule.family}</span></td>
                                <td className='px-3 py-2 text-xs capitalize'>{rule.severity}</td>
                                <td className='px-3 py-2 text-xs'>{rule.enabled === false ? 'Disabled' : 'Enabled'}</td>
                                <td className='px-3 py-2 text-xs text-ui-muted'>{rule.source === 'open_source' ? 'Imported rule' : rule.source === 'owned' ? 'Custom rule' : 'Hanasand rule'}</td>
                                <td className='px-3 py-2 text-xs tabular-nums'>{rule.hitCount?.toLocaleString('en-US') ?? '—'}</td>
                                {category === 'analysis' && <td className='px-3 py-2 text-xs'>{rule.definition?.action === 'drop' ? 'Drop' : 'Store'}</td>}
                                <td className='px-2 py-2'><button type='button' aria-label={`${rule.enabled === false ? 'Enable' : 'Disable'} ${rule.name}`} className='rounded-md border border-ui-border px-2 py-2 text-xs font-semibold disabled:opacity-50' disabled={!canManageRules} onClick={() => void toggleRule(rule)}>{rule.enabled === false ? 'Enable' : 'Disable'}</button></td>
                            </tr>)}
                            {!filteredRules.length && <tr><td colSpan={category === 'analysis' ? 9 : 8} className='px-3 py-6 text-center text-sm text-ui-muted'>{hasFilters ? 'No rules in this category match these filters.' : 'No rules in this category.'}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

export async function requestJson<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`); return payload as T }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Mill could not load this workspace.' }
