'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSearch, Radio, ShieldAlert } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

type Organization = { id: string, name?: string, slug?: string, role?: string }
type Finding = { id: string, rule_id: string, severity: string, status: string, summary: string, evidence: Record<string, unknown>, event_ids: string[], first_observed: string, last_observed: string, analyst_note?: string }
type Event = { id: string, event_timestamp: string, event_type: string, action: string, outcome: string, user_id?: string, user_email?: string, source_ip?: string, source_country?: string, source_city?: string, source_vendor: string, source_product: string, original: Record<string, unknown> }
type Member = { userId: string, name?: string, email?: string, role?: string, status?: string }
type MillRule = { id: string, recordId?: string, rule_id?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: { conditions?: Array<{ path: string, operator: string, value: string }> } }

export default function MillWorkspace() {
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [organizationId, setOrganizationId] = useState('')
    const [findings, setFindings] = useState<Finding[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [rules, setRules] = useState<MillRule[]>([])
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
    const [selectedId, setSelectedId] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [severityFilter, setSeverityFilter] = useState('all')
    const [sourceFilter, setSourceFilter] = useState('all')
    const [userFilter, setUserFilter] = useState('all')
    const [note, setNote] = useState('')
    const [assigneeId, setAssigneeId] = useState('')
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')

    const selected = useMemo(() => findings.find(finding => finding.id === selectedId) || findings[0], [findings, selectedId])
    useEffect(() => { void loadOrganizations() }, [])
    useEffect(() => { if (organizationId) void loadMill(organizationId) }, [organizationId])

    async function loadOrganizations() {
        try {
            const payload = await requestJson<{ organizations?: Organization[] }>('/api/organizations')
            const next = payload.organizations || []
            setOrganizations(next)
            setOrganizationId(next[0]?.id || '')
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function loadMill(id: string) {
        try {
            setError('')
            const [findingPayload, eventPayload, memberPayload, rulePayload] = await Promise.all([
                requestJson<{ findings?: Finding[] }>(`/api/mill/findings?organizationId=${encodeURIComponent(id)}`),
                requestJson<{ events?: Event[] }>(`/api/mill/events?organizationId=${encodeURIComponent(id)}&limit=80`),
                requestJson<{ members?: Member[] }>(`/api/organizations/${encodeURIComponent(id)}/members`),
                requestJson<{ rules?: MillRule[] }>(`/api/mill/rules?organizationId=${encodeURIComponent(id)}`),
            ])
            setFindings(findingPayload.findings || [])
            setEvents(eventPayload.events || [])
            setMembers((memberPayload.members || []).filter(member => member.status !== 'removed'))
            setRules(rulePayload.rules || [])
        } catch (cause) { setError(errorMessage(cause)); setFindings([]); setEvents([]); setRules([]) }
    }

    async function updateFinding(nextStatus: string) {
        if (!selected) return
        try {
            await requestJson(`/api/mill/findings/${encodeURIComponent(selected.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ status: nextStatus, note: note || undefined, assigneeId: assigneeId || undefined }) })
            setStatus(`Finding marked ${nextStatus}.`)
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function createRule() {
        if (!organizationId) return
        try {
            await requestJson(`/api/mill/rules?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ name: ruleName, explanation: ruleExplanation, severity: ruleSeverity, conditions: [{ path: rulePath, operator: ruleOperator, value: ruleValue }] }) })
            setStatus('Custom rule created and enabled for new events.')
            setRuleName(''); setRuleExplanation(''); setRuleValue('')
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function toggleRule(rule: MillRule) {
        if (!organizationId) return
        try {
            await requestJson(`/api/mill/rules/${encodeURIComponent(rule.recordId || rule.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ action: rule.enabled === false ? 'enable' : 'disable' }) })
            setStatus(`${rule.name} ${rule.enabled === false ? 'enabled' : 'disabled'}.`)
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    async function importRulePack() {
        if (!organizationId) return
        try {
            const parsed = JSON.parse(packJson) as { rules?: unknown }
            await requestJson(`/api/mill/rules/packs?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ packName, packVersion, sourceReference: packReference, rules: parsed.rules }) })
            setStatus('Signature pack imported and enabled for new events.')
            setPackName(''); setPackVersion(''); setPackReference('')
            await loadMill(organizationId)
        } catch (cause) { setError(cause instanceof SyntaxError ? 'Signature pack JSON is invalid.' : errorMessage(cause)) }
    }

    const sourceOptions = Array.from(new Set(events.map(event => `${event.source_vendor}/${event.source_product}`).filter(Boolean))).sort()
    const userOptions = Array.from(new Set(events.map(event => event.user_email || event.user_id || '').filter(Boolean))).sort()
    const visibleFindings = findings.filter(finding => {
        const related = events.filter(event => finding.event_ids?.includes(event.id))
        return (statusFilter === 'all' || finding.status === statusFilter)
            && (severityFilter === 'all' || finding.severity === severityFilter)
            && (sourceFilter === 'all' || related.some(event => `${event.source_vendor}/${event.source_product}` === sourceFilter))
            && (userFilter === 'all' || related.some(event => (event.user_email || event.user_id) === userFilter))
    })
    const relatedEvents = selected ? events.filter(event => selected.event_ids?.includes(event.id)) : []
    const relatedTimeline = [...relatedEvents].sort((left, right) => new Date(left.event_timestamp).getTime() - new Date(right.event_timestamp).getTime())
    const selectedRule = selected ? rules.find(rule => rule.id === selected.rule_id || rule.rule_id === selected.rule_id) : undefined
    const selectedOrganization = organizations.find(org => org.id === organizationId)
    const canManageRules = selectedOrganization?.role === 'owner' || selectedOrganization?.role === 'admin'
    const openCount = findings.filter(finding => !['resolved', 'benign', 'suppressed'].includes(finding.status)).length

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Managed detection' title='Mill' description='Review suspicious activity from customer log events.' actions={<select value={organizationId} onChange={event => setOrganizationId(event.target.value)} className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text' aria-label='Organization'>{organizations.map(org => <option key={org.id} value={org.id}>{org.name || org.slug || org.id}</option>)}</select>} />
            {error && <div role='alert' className='rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200'>{error}</div>}
            {status && <div className='rounded-lg border border-ui-primary/40 bg-ui-primary/10 p-3 text-sm text-ui-text'>{status}</div>}
            <section className='grid gap-3 sm:grid-cols-3'>
                <Metric label='Open findings' value={String(openCount)} icon={<ShieldAlert className='h-4 w-4' />} />
                <Metric label='Events received' value={String(events.length)} icon={<Radio className='h-4 w-4' />} />
                <Metric label='Detection rules' value={String(new Set(findings.map(finding => finding.rule_id)).size)} icon={<FileSearch className='h-4 w-4' />} />
            </section>
            <DashboardPanel className='grid gap-4' data-mill-rules='true'>
                <div><h2 className='font-semibold'>Detection rules</h2><p className='mt-1 text-sm text-ui-muted'>Built-in rules can be tuned per organization. Custom rules match normalized JSON fields on new events.</p></div>
                <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-3'>
                    {rules.map(rule => <div key={rule.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'><div className='flex items-start justify-between gap-2'><div><p className='font-semibold text-ui-text'>{rule.name}</p><p className='mt-1 text-xs text-ui-muted'>{rule.family} · {rule.severity} · {rule.source === 'open_source' ? 'open-source pack' : rule.source === 'owned' ? 'owned rule' : 'Hanasand rule'}</p></div><button type='button' className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text disabled:opacity-50' disabled={!canManageRules} onClick={() => void toggleRule(rule)}>{rule.enabled === false ? 'Enable' : 'Disable'}</button></div><p className='mt-2 text-xs text-ui-muted'>{rule.explanation}</p>{rule.sourceReference && <a className='mt-2 block truncate text-xs text-ui-primary hover:underline' href={rule.sourceReference} target='_blank' rel='noopener noreferrer'>Source reference</a>}</div>)}
                </div>
                <form className='grid gap-2 rounded-lg border border-dashed border-ui-border p-3' onSubmit={event => { event.preventDefault(); void createRule() }}>
                    <p className='text-sm font-semibold'>Add owned JSON rule</p>
                    <div className='grid gap-2 md:grid-cols-3'><input value={ruleName} onChange={event => setRuleName(event.target.value)} placeholder='Rule name' aria-label='Rule name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><select value={ruleSeverity} onChange={event => setRuleSeverity(event.target.value)} aria-label='Rule severity' className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'><option value='low'>Low</option><option value='medium'>Medium</option><option value='high'>High</option><option value='critical'>Critical</option></select><input value={ruleExplanation} onChange={event => setRuleExplanation(event.target.value)} placeholder='Why this matters (10-500 chars)' aria-label='Rule explanation' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></div>
                    <div className='grid gap-2 md:grid-cols-[1fr_auto_1fr_auto]'><input value={rulePath} onChange={event => setRulePath(event.target.value)} placeholder='event_type' aria-label='Rule field path' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><select value={ruleOperator} onChange={event => setRuleOperator(event.target.value)} aria-label='Rule operator' className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-sm text-ui-text'><option value='equals'>equals</option><option value='contains'>contains</option><option value='regex'>regex</option></select><input value={ruleValue} onChange={event => setRuleValue(event.target.value)} placeholder='authentication' aria-label='Rule value' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><button type='submit' className='h-9 rounded-md bg-ui-text px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50' disabled={!canManageRules || !ruleName.trim() || !ruleExplanation.trim() || !rulePath.trim() || !ruleValue.trim()}>Create rule</button></div>
                    {!canManageRules && <p className='text-xs text-ui-muted'>Owner or admin access is required to change organization rules.</p>}
                </form>
                <form className='grid gap-2 rounded-lg border border-dashed border-ui-border p-3' onSubmit={event => { event.preventDefault(); void importRulePack() }}>
                    <p className='text-sm font-semibold'>Import open-source signature pack</p>
                    <p className='text-xs text-ui-muted'>Use the bounded Mill JSON shape; raw Sigma YAML and executable rule code are not accepted at this boundary.</p>
                    <div className='grid gap-2 md:grid-cols-3'><input value={packName} onChange={event => setPackName(event.target.value)} placeholder='Pack name' aria-label='Pack name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={packVersion} onChange={event => setPackVersion(event.target.value)} placeholder='Version' aria-label='Pack version' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /><input value={packReference} onChange={event => setPackReference(event.target.value)} placeholder='https://source.example/rules' aria-label='Pack source reference' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></div>
                    <textarea value={packJson} onChange={event => setPackJson(event.target.value)} aria-label='Pack JSON' className='min-h-32 rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text' />
                    <button type='submit' className='h-9 justify-self-start rounded-md bg-ui-text px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50' disabled={!canManageRules || !packName.trim() || !packVersion.trim() || !packReference.trim()}>Import pack</button>
                </form>
            </DashboardPanel>
            <div className='grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]'>
                {selected && <DashboardPanel className='overflow-hidden p-0'><div className='border-b border-ui-border bg-ui-raised p-4'><h2 className='font-semibold'>Rule explanation</h2><p className='mt-1 text-sm font-semibold text-ui-text'>{selectedRule?.name || selected.rule_id}</p><p className='mt-1 text-sm text-ui-muted'>{selectedRule?.explanation || 'Rule metadata is unavailable for this finding.'}</p>{selectedRule?.evidence.length ? <p className='mt-2 text-xs text-ui-muted'>Evidence expected: {selectedRule.evidence.join(', ')}.</p> : null}</div></DashboardPanel>}
                <DashboardPanel className='overflow-hidden p-0'>
                    <div className='grid gap-3 border-b border-ui-border bg-ui-raised p-4'><div><h2 className='font-semibold'>Findings queue</h2><p className='mt-1 text-sm text-ui-muted'>Prioritized by severity and recent activity.</p></div><div className='flex flex-wrap gap-2'><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text' aria-label='Filter by status'><option value='all'>All statuses</option><option value='new'>New</option><option value='investigating'>Investigating</option><option value='benign'>Benign</option><option value='resolved'>Resolved</option><option value='suppressed'>Suppressed</option></select><select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text' aria-label='Filter by severity'><option value='all'>All severities</option><option value='critical'>Critical</option><option value='high'>High</option><option value='medium'>Medium</option><option value='low'>Low</option></select><select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} className='h-9 max-w-full rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text' aria-label='Filter by source'><option value='all'>All sources</option>{sourceOptions.map(source => <option key={source} value={source}>{source}</option>)}</select><select value={userFilter} onChange={event => setUserFilter(event.target.value)} className='h-9 max-w-full rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text' aria-label='Filter by user'><option value='all'>All users</option>{userOptions.map(user => <option key={user} value={user}>{user}</option>)}</select></div></div>
                    <div className='divide-y divide-ui-border'>
                        {visibleFindings.length === 0 ? <div className='p-6 text-sm text-ui-muted'>{findings.length ? 'No findings match these filters.' : <>No findings for this organization yet. Send JSON authentication events to <code>api.hanasand.com/mill</code> to begin analysis.</>}</div> : visibleFindings.map(finding => <button type='button' key={finding.id} onClick={() => { setSelectedId(finding.id); setNote(finding.analyst_note || ''); setAssigneeId('') }} className={`grid w-full gap-2 p-4 text-left transition hover:bg-ui-raised ${selected?.id === finding.id ? 'bg-ui-primary/10' : ''}`}><div className='flex items-center justify-between gap-3'><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${finding.severity === 'high' ? 'border-red-400/40 text-red-300' : 'border-ui-border text-ui-primary'}`}>{finding.severity}</span><span className='text-xs text-ui-muted'>{finding.status}</span></div><span className='font-semibold text-ui-text'>{finding.summary}</span><span className='text-xs text-ui-muted'>{finding.rule_id} · {formatDate(finding.last_observed)}</span></button>)}
                    </div>
                </DashboardPanel>
                <DashboardPanel className='overflow-hidden p-0'>
                    {!selected ? <div className='grid min-h-64 place-items-center p-8 text-center text-sm text-ui-muted'><CheckCircle2 className='mb-3 h-7 w-7 text-ui-primary' /><p>Select a finding when Mill identifies suspicious activity.</p></div> : <><div className='border-b border-ui-border bg-ui-raised p-4'><div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase text-ui-primary'>Finding detail</p><h2 className='mt-1 text-xl font-semibold'>{selected.summary}</h2><p className='mt-1 text-sm text-ui-muted'>{selected.rule_id} · first observed {formatDate(selected.first_observed)}</p></div><div className='flex flex-wrap gap-2'><button type='button' onClick={() => updateFinding(selected.status)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas'>Save decision</button>{['investigating', 'benign', 'resolved'].map(next => <button key={next} type='button' onClick={() => updateFinding(next)} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text hover:border-ui-primary'>{next}</button>)}</div></div></div><div className='grid gap-5 p-4'><div><h3 className='text-sm font-semibold'>Evidence</h3><pre className='mt-2 max-h-48 overflow-auto rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs text-ui-muted'>{JSON.stringify(selected.evidence, null, 2)}</pre></div><div><h3 className='text-sm font-semibold'>Evidence timeline</h3>{relatedTimeline.length ? <ol className='mt-3 grid gap-3 border-l border-ui-border pl-4'>{relatedTimeline.map(event => <li key={event.id} className='relative rounded-lg border border-ui-border bg-ui-raised p-3 text-sm before:absolute before:-left-[1.35rem] before:top-4 before:h-2 before:w-2 before:rounded-full before:bg-ui-primary'><div className='flex flex-wrap justify-between gap-2'><span className='font-semibold'>{event.outcome} login · {event.user_email || event.user_id || 'Unknown user'}</span><span className='text-xs text-ui-muted'>{formatDate(event.event_timestamp)}</span></div><p className='mt-1 text-xs text-ui-muted'>{event.source_country || 'unknown country'} · {event.source_city || 'unknown city'} · {event.source_ip || 'unknown IP'} · {event.source_vendor}/{event.source_product}</p></li>)}</ol> : <p className='mt-2 text-sm text-ui-muted'>Related event details are not in the current sample.</p>}</div><div><h3 className='text-sm font-semibold'>Analyst decision</h3><div className='mt-2 grid gap-2 sm:grid-cols-[1fr_auto]'><textarea value={note} onChange={event => setNote(event.target.value)} placeholder='Why is this finding benign, escalated, or resolved?' className='min-h-20 rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm text-ui-text' aria-label='Analyst note' /><select value={assigneeId} onChange={event => setAssigneeId(event.target.value)} className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text' aria-label='Assign analyst'><option value=''>Keep current assignee</option>{members.map(member => <option key={member.userId} value={member.userId}>{member.name || member.email || member.userId}</option>)}</select></div></div><div><h3 className='text-sm font-semibold'>Original event sample</h3><pre className='mt-2 max-h-56 overflow-auto rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs text-ui-muted'>{JSON.stringify(relatedTimeline[0]?.original || {}, null, 2)}</pre></div></div></>}
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) { return <DashboardPanel className='flex items-center gap-3'><span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>{icon}</span><div><p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p><p className='mt-1 text-xl font-semibold'>{value}</p></div></DashboardPanel> }
async function requestJson<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`); return payload as T }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Mill could not load this workspace.' }
function formatDate(value?: string) { if (!value) return 'Unknown time'; return new Date(value).toLocaleString() }
