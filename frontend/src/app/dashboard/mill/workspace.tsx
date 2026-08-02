'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSearch, Radio, ShieldAlert } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

type Organization = { id: string, name?: string, slug?: string }
type Finding = { id: string, rule_id: string, severity: string, status: string, summary: string, evidence: Record<string, unknown>, event_ids: string[], first_observed: string, last_observed: string, analyst_note?: string }
type Event = { id: string, event_timestamp: string, event_type: string, action: string, outcome: string, user_id?: string, user_email?: string, source_ip?: string, source_country?: string, source_city?: string, source_vendor: string, source_product: string, original: Record<string, unknown> }

export default function MillWorkspace() {
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [organizationId, setOrganizationId] = useState('')
    const [findings, setFindings] = useState<Finding[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [selectedId, setSelectedId] = useState('')
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
            const [findingPayload, eventPayload] = await Promise.all([
                requestJson<{ findings?: Finding[] }>(`/api/mill/findings?organizationId=${encodeURIComponent(id)}`),
                requestJson<{ events?: Event[] }>(`/api/mill/events?organizationId=${encodeURIComponent(id)}&limit=80`),
            ])
            setFindings(findingPayload.findings || [])
            setEvents(eventPayload.events || [])
        } catch (cause) { setError(errorMessage(cause)); setFindings([]); setEvents([]) }
    }

    async function updateFinding(nextStatus: string) {
        if (!selected) return
        try {
            await requestJson(`/api/mill/findings/${encodeURIComponent(selected.id)}/actions?organizationId=${encodeURIComponent(organizationId)}`, { method: 'POST', body: JSON.stringify({ status: nextStatus }) })
            setStatus(`Finding marked ${nextStatus}.`)
            await loadMill(organizationId)
        } catch (cause) { setError(errorMessage(cause)) }
    }

    const relatedEvents = selected ? events.filter(event => selected.event_ids?.includes(event.id)) : []
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
            <div className='grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]'>
                <DashboardPanel className='overflow-hidden p-0'>
                    <div className='border-b border-ui-border bg-ui-raised p-4'><h2 className='font-semibold'>Findings queue</h2><p className='mt-1 text-sm text-ui-muted'>Prioritized by severity and recent activity.</p></div>
                    <div className='divide-y divide-ui-border'>
                        {findings.length === 0 ? <div className='p-6 text-sm text-ui-muted'>No findings for this organization yet. Send JSON authentication events to <code>api.hanasand.com/mill</code> to begin analysis.</div> : findings.map(finding => <button type='button' key={finding.id} onClick={() => setSelectedId(finding.id)} className={`grid w-full gap-2 p-4 text-left transition hover:bg-ui-raised ${selected?.id === finding.id ? 'bg-ui-primary/10' : ''}`}><div className='flex items-center justify-between gap-3'><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${finding.severity === 'high' ? 'border-red-400/40 text-red-300' : 'border-ui-border text-ui-primary'}`}>{finding.severity}</span><span className='text-xs text-ui-muted'>{finding.status}</span></div><span className='font-semibold text-ui-text'>{finding.summary}</span><span className='text-xs text-ui-muted'>{finding.rule_id} · {formatDate(finding.last_observed)}</span></button>)}
                    </div>
                </DashboardPanel>
                <DashboardPanel className='overflow-hidden p-0'>
                    {!selected ? <div className='grid min-h-64 place-items-center p-8 text-center text-sm text-ui-muted'><CheckCircle2 className='mb-3 h-7 w-7 text-ui-primary' /><p>Select a finding when Mill identifies suspicious activity.</p></div> : <><div className='border-b border-ui-border bg-ui-raised p-4'><div className='flex flex-wrap items-start justify-between gap-3'><div><p className='text-xs font-semibold uppercase text-ui-primary'>Finding detail</p><h2 className='mt-1 text-xl font-semibold'>{selected.summary}</h2><p className='mt-1 text-sm text-ui-muted'>{selected.rule_id} · first observed {formatDate(selected.first_observed)}</p></div><div className='flex flex-wrap gap-2'>{['investigating', 'benign', 'resolved'].map(next => <button key={next} type='button' onClick={() => updateFinding(next)} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text hover:border-ui-primary'>{next}</button>)}</div></div></div><div className='grid gap-5 p-4'><div><h3 className='text-sm font-semibold'>Evidence</h3><pre className='mt-2 max-h-48 overflow-auto rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs text-ui-muted'>{JSON.stringify(selected.evidence, null, 2)}</pre></div><div><h3 className='text-sm font-semibold'>Related events</h3><div className='mt-2 grid gap-2'>{relatedEvents.length ? relatedEvents.map(event => <div key={event.id} className='rounded-lg border border-ui-border bg-ui-raised p-3 text-sm'><div className='flex flex-wrap justify-between gap-2'><span className='font-semibold'>{event.user_email || event.user_id || 'Unknown user'}</span><span className='text-xs text-ui-muted'>{formatDate(event.event_timestamp)}</span></div><p className='mt-1 text-xs text-ui-muted'>{event.outcome} login · {event.source_country || 'unknown country'} · {event.source_ip || 'unknown IP'} · {event.source_vendor}/{event.source_product}</p></div>) : <p className='text-sm text-ui-muted'>Related event details are not in the current sample.</p>}</div></div><div><h3 className='text-sm font-semibold'>Original event sample</h3><pre className='mt-2 max-h-56 overflow-auto rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs text-ui-muted'>{JSON.stringify(relatedEvents[0]?.original || {}, null, 2)}</pre></div></div></>}
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) { return <DashboardPanel className='flex items-center gap-3'><span className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>{icon}</span><div><p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p><p className='mt-1 text-xl font-semibold'>{value}</p></div></DashboardPanel> }
async function requestJson<T>(url: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status})`); return payload as T }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Mill could not load this workspace.' }
function formatDate(value?: string) { if (!value) return 'Unknown time'; return new Date(value).toLocaleString() }
