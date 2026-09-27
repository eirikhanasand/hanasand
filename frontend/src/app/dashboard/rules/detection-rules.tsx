'use client'

import CreateRuleDialog from './create-rule-dialog'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { useEffect, useRef, useState } from 'react'
import { ruleCategories, type RuleCategory } from './rule-categories'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import RulePageActions from './rule-page-actions'
import RuleLibrary from './rule-library'

export type Rule = { id: string, hitCount?: number | null, detectionLogic?: string, recordId?: string, rule_id?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: { stage?: 'analyze' | 'match' | 'detect', action?: 'drop' | 'keep', storeScope?: 'all' | 'custom_drop', match?: 'all', parameters?: Record<string, number>, protection?: Record<string, unknown>, failureConditions?: Array<{ path: string, operator: string, value: string, caseSensitive?: boolean }>, conditions?: Array<{ path: string, operator: string, value: string, caseSensitive?: boolean }> } }

export type InitialRules = { organizationId: string, category: RuleCategory, rules: Rule[], canManageRetention: boolean, error?: string }

export default function DetectionRules({ category, initial }: { category: RuleCategory, initial?: InitialRules }) {
    const latestOrganization = useRef(initial?.organizationId || '')
    const loadRequest = useRef(0)
    const [loading, setLoading] = useState(false)
    const { organizationId, organizations } = useWorkspace()
    const matchingInitial = initial?.organizationId === organizationId && initial.category === category ? initial : undefined
    const [rules, setRules] = useState<Rule[]>(matchingInitial?.rules || [])
    const [canManageRetention, setCanManageRetention] = useState(matchingInitial?.canManageRetention === true)
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
    const [liveHitsUnavailable, setLiveHitsUnavailable] = useState(false)
    const [error, setError] = useState(matchingInitial?.error || '')

    useEffect(() => {
        latestOrganization.current = organizationId
        if (initial?.organizationId === organizationId && initial.category === category) {
            setRules(initial.rules)
            setCanManageRetention(initial.canManageRetention)
            setError(initial.error || '')
            setLoading(false)
        } else {
            setRules([])
            setCanManageRetention(false)
            if (organizationId) void loadEvent(organizationId)
        }
        return () => { loadRequest.current++ }
    }, [organizationId, category, initial])

    useEffect(() => {
        if (!organizationId) return
        let active = true
        let pending = false
        const refreshHits = async () => {
            if (pending || document.visibilityState !== 'visible') return
            pending = true
            try {
                const payload = await requestJson<{ hitCounts?: Record<string, number | null> }>(`/api/backend/rules/hits?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
                if (!active || latestOrganization.current !== organizationId || !payload.hitCounts) return
                setLiveHitsUnavailable(false)
                setRules(current => current.map(rule => Object.hasOwn(payload.hitCounts!, rule.id)
                    ? { ...rule, hitCount: payload.hitCounts![rule.id] }
                    : rule))
            } catch {
                if (active && latestOrganization.current === organizationId) setLiveHitsUnavailable(true)
            } finally {
                pending = false
            }
        }
        void refreshHits()
        const interval = window.setInterval(() => void refreshHits(), 10_000)
        return () => { active = false; window.clearInterval(interval) }
    }, [organizationId])

    async function loadEvent(id: string) {
        latestOrganization.current = id
        const request = ++loadRequest.current
        setLoading(true)
        try {
            setError('')
            const payload = await requestJson<{ rules?: Rule[], canManageRetention?: boolean }>(`/api/backend/rules?organizationId=${encodeURIComponent(id)}&view=list&category=${category}`)
            if (loadRequest.current === request) { setRules(payload.rules || []); setCanManageRetention(payload.canManageRetention === true) }
        } catch (cause) { if (loadRequest.current === request) { setError(errorMessage(cause)); setRules([]) } }
        finally { if (loadRequest.current === request) setLoading(false) }
    }

    async function toggleRule(rule: Rule) {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/rules/${encodeURIComponent(rule.recordId || rule.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ action: rule.enabled === false ? 'enable' : 'disable' }) })
            setStatus(`${rule.name} ${rule.enabled === false ? 'enabled' : 'disabled'}.`)
            if (latestOrganization.current === organizationId) await loadEvent(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function importRulePack() {
        if (!organizationId) return
        try {
            const parsed = JSON.parse(packJson) as { rules?: unknown }
            await requestJson(`/api/backend/rules/packs?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName, packVersion, sourceReference: packReference, rules: parsed.rules }) })
            setStatus('Signature pack imported and enabled for new events.')
            setPackName(''); setPackVersion(''); setPackReference('')
            setShowImports(false)
            if (latestOrganization.current === organizationId) await loadEvent(organizationId)
        } catch (cause) { setError(cause instanceof SyntaxError ? 'Signature pack JSON is invalid.' : errorMessage(cause)) }
    }

    async function importSigmaPack() {
        if (!organizationId) return
        try {
            await requestJson(`/api/backend/rules/sigma?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName: sigmaPackName, packVersion: sigmaPackVersion, sourceReference: sigmaPackReference, yaml: sigmaYaml }) })
            setStatus('Sigma rules imported and enabled for new events.')
            setSigmaPackName(''); setSigmaPackVersion(''); setSigmaPackReference('')
            setShowImports(false)
            if (latestOrganization.current === organizationId) await loadEvent(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    const selectedOrganization = organizations.find(org => org.id === organizationId)
    const canManageRules = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'

    return (
        <DashboardPage className='!gap-6 !px-2 !py-4'>
            <div className='flex flex-wrap items-center justify-between gap-4'>
                <div><h1 className='text-2xl font-semibold'>{ruleCategories[category].label}</h1></div>
                <RulePageActions
                    category={category}
                    organizationId={organizationId}
                    showCreate={showCreate}
                    showImports={showImports}
                    onToggleCreate={() => { setShowCreate(open => !open); setShowImports(false) }}
                    onToggleImports={() => { setShowImports(open => !open); setShowCreate(false) }}
                />
            </div>
            {error && <div role='alert' className='rounded-lg border border-ui-danger/40 bg-ui-raised p-3 text-sm text-ui-text'>{error}</div>}
            {status && <div role='status' className='rounded-lg border border-ui-primary/40 bg-ui-primary/10 p-3 text-sm text-ui-on-primary'>{status}</div>}
            {liveHitsUnavailable && <div role='status' className='rounded-lg border border-ui-warning/40 bg-ui-raised p-3 text-sm text-ui-text'>Live hit counts are temporarily unavailable. Retrying automatically.</div>}
            {showCreate && <CreateRuleDialog key={organizationId} category={category} organizationId={organizationId} canManage={canManageRules} canManageRetention={canManageRetention} rules={rules} onClose={() => setShowCreate(false)} onCreated={rule => {
                setShowCreate(false); setStatus(`${rule.name} created.`); void loadEvent(organizationId)
            }} />}
            {showImports && <DashboardPanel className='grid min-w-0 gap-4 p-4 sm:p-6' id='event-rule-imports'>
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
            <RuleLibrary category={category} rules={rules} loading={loading} canManageRules={canManageRules} organizationId={organizationId} onToggleRule={rule => void toggleRule(rule)} />
        </DashboardPage>
    )
}

export async function requestJson<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`); return payload as T }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Event could not load this workspace.' }
