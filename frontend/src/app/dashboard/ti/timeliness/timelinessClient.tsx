'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, LoaderCircle, RefreshCw, Search, Send } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

type QueueStatus = 'unresolved_reference' | 'anomaly' | 'awaiting_alert' | 'awaiting_delivery' | 'complete'
type Metric = { sampleSize: number, medianSeconds: number | null, p95Seconds: number | null, p99Seconds: number | null }
type Item = {
    id: string
    incidentId: string
    captureId: string
    sourceId: string
    actorName?: string
    sourceName?: string
    sourceFamily?: string
    title?: string
    status: QueueStatus
    missingStages: string[]
    stages: Record<string, string | undefined>
    provenance: Record<string, Record<string, unknown> | undefined>
    reportReferences: Array<Record<string, unknown>>
    latencies: Record<string, number | undefined>
    timestampAnomalies: string[]
    updatedAt?: string
}
type GroupMetric = { name: string, recordCount: number, metrics: Record<string, Metric> }
type QualityGroup = { name: string, recordCount: number, missing: Record<string, number>, issues: Record<string, number> }
type ReferenceForm = { role: string, timestamp: string, referenceUrl: string, referenceTitle: string, evidencePath: string }
type Snapshot = {
    generatedAt: string
    summary: {
        recordCount: number
        unresolvedReferenceCount: number
        anomalyCount: number
        awaitingAlertCount: number
        awaitingDeliveryCount: number
        completeCount: number
        observedCoverage: number
        reviewedCoverage: number
        reportToAlertCoverage: number
        reportToDeliveredCoverage: number
        excludedMetricRecordCount: number
    }
    metrics: { overall: Record<string, Metric>, bySourceFamily: GroupMetric[], byActor: GroupMetric[], byStage: Array<{ name: string } & Metric> }
    quality: {
        fields: Array<{ name: string, presentCount: number, missingCount: number, coverage: number }>
        issues: Array<{ name: string, count: number }>
        bySourceClass: QualityGroup[]
    }
    items: Item[]
    page: { total: number, nextCursor: string | null }
}

const statuses: Array<{ value: '' | QueueStatus, label: string }> = [
    { value: '', label: 'All records' },
    { value: 'unresolved_reference', label: 'Needs first report' },
    { value: 'anomaly', label: 'Timestamp anomalies' },
    { value: 'awaiting_alert', label: 'Awaiting alert' },
    { value: 'awaiting_delivery', label: 'Awaiting delivery' },
    { value: 'complete', label: 'Complete' },
]
const stageOrder = ['observed', 'first_report', 'publication', 'collection', 'processing', 'first_visible', 'reviewed', 'alert_created', 'delivery_attempt', 'delivered']

export default function TimelinessClient() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
    const [selectedId, setSelectedId] = useState('')
    const [scope, setScope] = useState<'tenant' | 'global'>('global')
    const [tenantId, setTenantId] = useState('')
    const [status, setStatus] = useState<'' | QueueStatus>('')
    const [search, setSearch] = useState('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({ role: 'actor', timestamp: '', referenceUrl: '', referenceTitle: '', evidencePath: '' })

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        if (scope === 'tenant' && !tenantId.trim()) {
            setSnapshot(null)
            setLoading(false)
            return
        }
        try {
            const params = new URLSearchParams({ scope, limit: '200' })
            if (scope === 'tenant') params.set('tenantId', tenantId.trim())
            if (status) params.set('status', status)
            if (query) params.set('q', query)
            const next = await api<Snapshot>(`/api/ti/timeliness?${params}`)
            setSnapshot(next)
            setSelectedId(current => next.items.some(item => item.id === current) ? current : next.items[0]?.id || '')
        } catch (cause) {
            setError(message(cause))
        } finally {
            setLoading(false)
        }
    }, [query, scope, status, tenantId])

    useEffect(() => { void load() }, [load])
    const selected = snapshot?.items.find(item => item.id === selectedId)
    const coverage = snapshot?.summary
    const principalMetrics = useMemo(() => snapshot?.metrics.byStage.filter(metric => ['reportToPublicationSeconds', 'reportToVisibilitySeconds', 'reportToAlertSeconds', 'reportToDeliveredSeconds'].includes(metric.name)) ?? [], [snapshot])

    async function addReference(event: FormEvent) {
        event.preventDefault()
        if (!selected) return
        setSaving(true)
        setError('')
        try {
            const params = new URLSearchParams({ scope })
            if (scope === 'tenant') params.set('tenantId', tenantId.trim())
            const response = await api<{ item: Item }>('/api/ti/timeliness?' + params, {
                method: 'POST',
                body: JSON.stringify({ recordId: selected.id, ...form, referenceTitle: form.referenceTitle || undefined }),
            })
            setSelectedId(response.item.id)
            setForm({ role: 'actor', timestamp: '', referenceUrl: '', referenceTitle: '', evidencePath: '' })
            await load()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-end gap-2 border-b border-ui-border bg-ui-raised p-3'>
                    <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Scope
                        <select value={scope} onChange={event => setScope(event.target.value as 'tenant' | 'global')} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text'>
                            <option value='global'>Global records</option>
                            <option value='tenant'>Specific tenant</option>
                        </select>
                    </label>
                    {scope === 'tenant' ? <label className='grid min-w-64 flex-1 gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Tenant ID
                        <input value={tenantId} onChange={event => setTenantId(event.target.value)} placeholder='Organization or tenant UUID' className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text placeholder:text-ui-muted' />
                    </label> : null}
                    <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Queue
                        <select value={status} onChange={event => setStatus(event.target.value as '' | QueueStatus)} className='h-9 rounded-md border border-ui-border bg-ui-panel px-2 text-xs font-medium normal-case text-ui-text'>
                            {statuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <form onSubmit={event => { event.preventDefault(); setQuery(search.trim()) }} className='flex min-w-56 flex-1 gap-1'>
                        <label className='sr-only' htmlFor='timeliness-search'>Search incidents</label>
                        <div className='relative min-w-0 flex-1'>
                            <Search className='pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ui-muted' />
                            <input id='timeliness-search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Actor, source, incident, capture, anomaly' className='h-9 w-full rounded-md border border-ui-border bg-ui-panel pl-8 pr-2 text-xs text-ui-text placeholder:text-ui-muted' />
                        </div>
                        <button type='submit' className='h-9 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-muted/10'>Search</button>
                    </form>
                    <button type='button' onClick={() => void load()} disabled={loading} aria-label='Refresh timeliness records' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:opacity-50'>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {error ? <div role='alert' className='flex items-start gap-2 border-b border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
                <div className='grid grid-cols-2 divide-x divide-y divide-ui-border sm:grid-cols-4 lg:grid-cols-6'>
                    <Summary label='Retained' value={coverage?.recordCount ?? 0} />
                    <Summary label='Needs report' value={coverage?.unresolvedReferenceCount ?? 0} attention />
                    <Summary label='Anomalies' value={coverage?.anomalyCount ?? 0} attention />
                    <Summary label='Awaiting alert' value={coverage?.awaitingAlertCount ?? 0} />
                    <Summary label='Awaiting delivery' value={coverage?.awaitingDeliveryCount ?? 0} />
                    <Summary label='Complete' value={coverage?.completeCount ?? 0} />
                    <Summary label='Observed' value={percent(coverage?.observedCoverage)} />
                    <Summary label='Reviewed' value={percent(coverage?.reviewedCoverage)} />
                    <Summary label='Report → alert' value={percent(coverage?.reportToAlertCoverage)} />
                    <Summary label='Report → delivered' value={percent(coverage?.reportToDeliveredCoverage)} />
                    <Summary label='Excluded from metrics' value={coverage?.excludedMetricRecordCount ?? 0} attention />
                </div>
            </DashboardPanel>

            <div className='grid min-h-[42rem] gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='flex items-center justify-between border-b border-ui-border bg-ui-raised px-3 py-2 text-xs'>
                        <span className='font-semibold text-ui-text'>Retained evidence</span>
                        <span className='text-ui-muted'>{snapshot?.page.total ?? 0} matching</span>
                    </div>
                    <div className='max-h-[calc(100vh-13rem)] min-h-72 overflow-auto'>
                        {snapshot?.items.map(item => <QueueRow key={item.id} item={item} active={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />)}
                        {!snapshot?.items.length ? <div className='grid min-h-56 place-items-center p-6 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : 'No retained timeliness records match this scope and queue.'}</div> : null}
                    </div>
                </DashboardPanel>

                <div className='grid min-w-0 content-start gap-3'>
                    {selected ? <RecordDetail item={selected} form={form} setForm={setForm} saving={saving} onSubmit={addReference} /> : (
                        <DashboardPanel className='grid min-h-72 place-items-center p-6 text-center text-sm text-ui-muted'>Select a retained record to inspect its evidence path.</DashboardPanel>
                    )}
                    <QualityPanel quality={snapshot?.quality} />
                    <MetricsPanel stages={principalMetrics} sources={snapshot?.metrics.bySourceFamily ?? []} actors={snapshot?.metrics.byActor ?? []} />
                </div>
            </div>
        </>
    )
}

function QueueRow({ item, active, onClick }: { item: Item, active: boolean, onClick: () => void }) {
    return <button type='button' onClick={onClick} className={`grid w-full gap-1 border-b border-ui-border px-3 py-2.5 text-left hover:bg-ui-raised ${active ? 'bg-ui-raised' : ''}`}>
        <span className='flex min-w-0 items-center gap-2'><Status status={item.status} /><span className='truncate text-xs font-semibold text-ui-text'>{item.actorName || item.title || item.incidentId}</span></span>
        <span className='truncate text-[11px] text-ui-muted'>{item.sourceName || item.sourceId} · {item.title || item.incidentId}</span>
        {item.timestampAnomalies.length ? <span className='truncate text-[10px] text-ui-danger'>{item.timestampAnomalies.join(', ')}</span> : null}
    </button>
}

function RecordDetail({ item, form, setForm, saving, onSubmit }: { item: Item, form: ReferenceForm, setForm: (value: ReferenceForm) => void, saving: boolean, onSubmit: (event: FormEvent) => void }) {
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='flex flex-wrap items-start justify-between gap-2 border-b border-ui-border bg-ui-raised px-3 py-2.5'>
            <div className='min-w-0'><p className='text-[10px] font-semibold uppercase text-ui-primary'>{item.actorName || 'Unattributed actor'}</p><h2 className='mt-0.5 truncate text-sm font-semibold text-ui-text'>{item.title || item.incidentId}</h2><p className='mt-1 truncate text-[11px] text-ui-muted'>{item.sourceName || item.sourceId} · {item.incidentId}</p></div>
            <Status status={item.status} />
        </div>
        {item.timestampAnomalies.length ? <div className='border-b border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><strong>Ordering/source anomaly:</strong> {item.timestampAnomalies.join(', ')}</div> : null}
        <div className='grid lg:grid-cols-[minmax(0,1fr)_21rem]'>
            <section className='min-w-0 border-b border-ui-border p-3 lg:border-b-0 lg:border-r'>
                <h3 className='text-xs font-semibold text-ui-text'>Persisted event path</h3>
                <div className='mt-2 grid gap-1'>
                    {stageOrder.map(stage => <StageRow key={stage} stage={stage} timestamp={item.stages[stage]} provenance={item.provenance[stage]} />)}
                </div>
                <h3 className='mt-4 text-xs font-semibold text-ui-text'>Measured intervals</h3>
                <dl className='mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                    {Object.entries(item.latencies).map(([name, value]) => <div key={name} className='rounded-md border border-ui-border bg-ui-raised p-2'><dt className='text-[10px] text-ui-muted'>{label(name)}</dt><dd className='mt-1 text-xs font-semibold text-ui-text'>{duration(value)}</dd></div>)}
                </dl>
            </section>
            <form onSubmit={onSubmit} className='grid content-start gap-3 p-3'>
                <div><h3 className='text-xs font-semibold text-ui-text'>Add public first-report evidence</h3><p className='mt-1 text-[11px] leading-4 text-ui-muted'>Use the timestamp exactly as published by the actor, victim, or publisher and identify the source field.</p></div>
                <Field label='Reporting party'><select required value={form.role} onChange={event => setForm({ ...form, role: event.target.value })} className={inputClass}><option value='actor'>Actor</option><option value='victim'>Victim</option><option value='publisher'>Publisher</option></select></Field>
                <Field label='Timestamp with timezone'><input required value={form.timestamp} onChange={event => setForm({ ...form, timestamp: event.target.value })} placeholder='2026-07-22T10:00:00Z' className={inputClass} /></Field>
                <Field label='Public reference URL'><input required type='url' value={form.referenceUrl} onChange={event => setForm({ ...form, referenceUrl: event.target.value })} placeholder='https://…' className={inputClass} /></Field>
                <Field label='Source-field path'><input required value={form.evidencePath} onChange={event => setForm({ ...form, evidencePath: event.target.value })} placeholder='article.time[datetime]' className={inputClass} /></Field>
                <Field label='Reference title (optional)'><input value={form.referenceTitle} onChange={event => setForm({ ...form, referenceTitle: event.target.value })} className={inputClass} /></Field>
                <button type='submit' disabled={saving} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas hover:opacity-90 disabled:opacity-50'>{saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}Record evidence</button>
            </form>
        </div>
    </DashboardPanel>
}

function StageRow({ stage, timestamp, provenance }: { stage: string, timestamp?: string, provenance?: Record<string, unknown> }) {
    const url = typeof provenance?.referenceUrl === 'string' ? provenance.referenceUrl : undefined
    return <div className='grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 rounded-md border border-ui-border px-2.5 py-2 text-xs'>
        <span className='flex items-center gap-1.5 font-medium text-ui-muted'>{timestamp ? <CheckCircle2 className='h-3.5 w-3.5 text-ui-success' /> : <Clock3 className='h-3.5 w-3.5' />}{label(stage)}</span>
        <span className='min-w-0'><span className='block font-mono text-[11px] text-ui-text'>{timestamp ? date(timestamp) : 'Unknown'}</span>{provenance ? <span className='mt-0.5 block truncate text-[10px] text-ui-muted'>{String(provenance.evidencePath || provenance.event || 'stored provenance')}{url ? <> · <a href={url} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-0.5 text-ui-primary hover:underline'>reference<ExternalLink className='h-2.5 w-2.5' /></a></> : null}</span> : null}</span>
    </div>
}

function QualityPanel({ quality }: { quality?: Snapshot['quality'] }) {
    const importantFields = quality?.fields.filter(field => ['first_report', 'publication', 'reviewed', 'alert_created', 'delivered'].includes(field.name)) ?? []
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='border-b border-ui-border bg-ui-raised px-3 py-2'><h2 className='text-xs font-semibold text-ui-text'>Measured data quality</h2><p className='mt-0.5 text-[10px] text-ui-muted'>Bad or unproven timestamps remain visible and are excluded from latency distributions.</p></div>
        <div className='grid lg:grid-cols-[16rem_minmax(0,1fr)]'>
            <section className='border-b border-ui-border p-3 lg:border-b-0 lg:border-r'>
                <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Coverage and exclusions</h3>
                <dl className='mt-2 grid grid-cols-2 gap-2'>
                    {importantFields.map(field => <div key={field.name} className='rounded-md border border-ui-border bg-ui-raised p-2'><dt className='truncate text-[10px] text-ui-muted'>{label(field.name)}</dt><dd className='mt-1 text-xs font-semibold text-ui-text'>{percent(field.coverage)} <span className='font-normal text-ui-muted'>({field.missingCount} missing)</span></dd></div>)}
                </dl>
                <div className='mt-2 space-y-1'>{quality?.issues.map(issue => <p key={issue.name} className='flex justify-between gap-2 text-[10px] text-ui-danger'><span className='truncate'>{issue.name}</span><strong>{issue.count}</strong></p>)}{!quality?.issues.length ? <p className='text-[10px] text-ui-muted'>No excluded timestamp anomalies in this scope.</p> : null}</div>
            </section>
            <section className='min-w-0 p-3'><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Real source classes</h3><div className='mt-2 overflow-x-auto'><table className='w-full text-left text-[11px]'><thead className='text-ui-muted'><tr><th className='pb-1 font-medium'>Class</th><th className='pb-1 text-right font-medium'>Records</th><th className='pb-1 text-right font-medium'>No observed</th><th className='pb-1 text-right font-medium'>No report</th><th className='pb-1 text-right font-medium'>No publication</th><th className='pb-1 text-right font-medium'>No collection</th><th className='pb-1 text-right font-medium'>No processing</th><th className='pb-1 text-right font-medium'>No review</th><th className='pb-1 text-right font-medium'>Issues</th></tr></thead><tbody>{quality?.bySourceClass.map(group => <tr key={group.name} className='border-t border-ui-border'><td className='max-w-44 truncate py-1.5 text-ui-text'>{group.name}</td><td className='py-1.5 text-right text-ui-muted'>{group.recordCount}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.observed ?? 0}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.first_report ?? 0}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.publication ?? 0}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.collection ?? 0}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.processing ?? 0}</td><td className='py-1.5 text-right text-ui-text'>{group.missing.reviewed ?? 0}</td><td className='py-1.5 text-right text-ui-danger'>{Object.values(group.issues).reduce((sum, count) => sum + count, 0)}</td></tr>)}</tbody></table>{!quality?.bySourceClass.length ? <p className='py-4 text-center text-ui-muted'>No retained source classes in this scope.</p> : null}</div></section>
        </div>
    </DashboardPanel>
}

function MetricsPanel({ stages, sources, actors }: { stages: Array<{ name: string } & Metric>, sources: GroupMetric[], actors: GroupMetric[] }) {
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='border-b border-ui-border bg-ui-raised px-3 py-2'><h2 className='text-xs font-semibold text-ui-text'>Reproducible median / p95 / p99</h2></div>
        <div className='grid lg:grid-cols-3'>
            <MetricTable title='Stage' rows={stages.map(row => ({ ...row, name: label(row.name) }))} />
            <MetricTable title='Source family · report → delivered' rows={sources.map(row => ({ name: row.name, ...row.metrics.reportToDeliveredSeconds }))} />
            <MetricTable title='Actor · report → delivered' rows={actors.map(row => ({ name: row.name, ...row.metrics.reportToDeliveredSeconds }))} />
        </div>
    </DashboardPanel>
}

function MetricTable({ title, rows }: { title: string, rows: Array<{ name: string } & Metric> }) {
    return <section className='min-w-0 border-b border-ui-border p-3 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0'><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</h3><div className='mt-2 overflow-x-auto'><table className='w-full text-left text-[11px]'><thead className='text-ui-muted'><tr><th className='pb-1 font-medium'>Group</th><th className='pb-1 text-right font-medium'>n</th><th className='pb-1 text-right font-medium'>median</th><th className='pb-1 text-right font-medium'>p95</th><th className='pb-1 text-right font-medium'>p99</th></tr></thead><tbody>{rows.map(row => <tr key={row.name} className='border-t border-ui-border'><td className='max-w-32 truncate py-1.5 text-ui-text'>{row.name}</td><td className='py-1.5 text-right text-ui-muted'>{row.sampleSize}</td><td className='py-1.5 text-right text-ui-text'>{duration(row.medianSeconds ?? undefined)}</td><td className='py-1.5 text-right text-ui-text'>{duration(row.p95Seconds ?? undefined)}</td><td className='py-1.5 text-right text-ui-text'>{duration(row.p99Seconds ?? undefined)}</td></tr>)}</tbody></table>{!rows.length ? <p className='py-4 text-center text-ui-muted'>No eligible measurements.</p> : null}</div></section>
}

function Status({ status }: { status: QueueStatus }) {
    const bad = status === 'anomaly'
    const good = status === 'complete'
    return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${bad ? 'border-ui-danger/40 bg-ui-danger/10 text-ui-danger' : good ? 'border-ui-success/40 bg-ui-success/10 text-ui-success' : 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning'}`}>{label(status)}</span>
}

function Summary({ label: name, value, attention = false }: { label: string, value: string | number, attention?: boolean }) {
    return <div className='min-w-0 p-2.5'><p className='truncate text-[9px] font-semibold uppercase text-ui-muted'>{name}</p><p className={`mt-1 text-sm font-semibold ${attention && Number(value) ? 'text-ui-warning' : 'text-ui-text'}`}>{value}</p></div>
}

function Field({ label: name, children }: { label: string, children: ReactNode }) { return <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>{name}{children}</label> }
const inputClass = 'h-9 w-full rounded-md border border-ui-border bg-ui-raised px-2 text-xs font-normal normal-case text-ui-text placeholder:text-ui-muted'
function label(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) }
function date(value: string) { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value }
function duration(value?: number | null) { if (value === undefined || value === null) return '—'; if (value < 60) return `${value}s`; if (value < 3600) return `${(value / 60).toFixed(1)}m`; return `${(value / 3600).toFixed(1)}h` }
function percent(value?: number) { return value === undefined ? '—' : `${Math.round(value * 100)}%` }
function message(error: unknown) { return error instanceof Error ? error.message : 'The timeliness request failed.' }
async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error?.message || 'The timeliness request failed.'); return payload as T }
