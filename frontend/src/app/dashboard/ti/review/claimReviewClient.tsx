'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, LoaderCircle, RefreshCw, Search, ShieldAlert, X } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

type Claim = {
    id: string
    claimType?: string
    summary?: string
    value?: unknown
    confidence?: number
    reviewState?: string
    corroborationState?: string
    evidenceStage?: string
    sourceIds?: string[]
    captureIds?: string[]
    createdAt?: string
    updatedAt?: string
}

type ClaimsResponse = { claims: Claim[], total: number, nextCursor?: string }
type ReviewAction = 'confirm' | 'reject' | 'mark_needs_review' | 'mark_contradicted'
const filters = ['open', 'confirmed', 'rejected', 'contradicted', 'all'] as const

export default function ClaimReviewClient() {
    const [scope, setScope] = useState<'default' | 'global'>('default')
    const [filter, setFilter] = useState<(typeof filters)[number]>('open')
    const [queryInput, setQueryInput] = useState('')
    const [query, setQuery] = useState('')
    const [claims, setClaims] = useState<Claim[]>([])
    const [total, setTotal] = useState(0)
    const [nextCursor, setNextCursor] = useState<string>()
    const [selectedId, setSelectedId] = useState('')
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = useCallback(async (cursor?: string, append = false) => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({ scope, limit: '100' })
            if (query) params.set('q', query)
            if (cursor) params.set('cursor', cursor)
            const payload = await api<ClaimsResponse>(`/api/ti/claims?${params}`)
            setClaims(current => append ? dedupe([...current, ...payload.claims]) : payload.claims)
            setTotal(payload.total)
            setNextCursor(payload.nextCursor)
            if (!append) setSelectedId(current => payload.claims.some(claim => claim.id === current) ? current : payload.claims[0]?.id || '')
        } catch (cause) {
            setError(message(cause))
        } finally {
            setLoading(false)
        }
    }, [query, scope])

    useEffect(() => { void load() }, [load])

    const visible = useMemo(() => claims.filter(claim => matchesFilter(claim, filter)), [claims, filter])
    const selected = visible.find(claim => claim.id === selectedId) || visible[0]
    const counts = useMemo(() => ({
        open: claims.filter(claim => ['unreviewed', 'needs_review'].includes(claim.reviewState || 'unreviewed')).length,
        confirmed: claims.filter(claim => claim.reviewState === 'confirmed').length,
        rejected: claims.filter(claim => claim.reviewState === 'rejected').length,
        contradicted: claims.filter(claim => claim.reviewState === 'contradicted').length,
    }), [claims])

    async function review(action: ReviewAction) {
        if (!selected || reason.trim().length < 8) {
            setError('Record a specific review reason of at least 8 characters.')
            return
        }
        setSaving(true)
        setError('')
        try {
            await api(`/api/ti/claims/${encodeURIComponent(selected.id)}/reviews?scope=${scope}`, {
                method: 'POST',
                body: JSON.stringify({ action, reason: reason.trim() }),
            })
            setReason('')
            await load()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setSaving(false)
        }
    }

    function search(event: FormEvent) {
        event.preventDefault()
        setQuery(queryInput.trim())
    }

    return (
        <div className='grid gap-3'>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
                    <div className='flex flex-wrap items-center gap-1' aria-label='Claim scope'>
                        {(['default', 'global'] as const).map(item => (
                            <button key={item} type='button' onClick={() => setScope(item)} className={`h-8 rounded-md px-3 text-xs font-semibold ${scope === item ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:bg-ui-panel hover:text-ui-text'}`}>{item === 'default' ? 'Customer tenant' : 'Global intelligence'}</button>
                        ))}
                    </div>
                    <form onSubmit={search} className='flex min-w-0 flex-1 justify-end gap-1 sm:max-w-md'>
                        <label className='sr-only' htmlFor='claim-search'>Search claims</label>
                        <input id='claim-search' value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder='Search claims' className='h-9 min-w-0 flex-1 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none focus:border-ui-primary' />
                        <button type='submit' title='Search claims' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text'><Search className='h-4 w-4' /></button>
                        <button type='button' onClick={() => void load()} disabled={loading} title='Refresh claims' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:opacity-50'><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
                    </form>
                </div>
                <div className='grid grid-cols-2 gap-px bg-ui-border sm:grid-cols-5'>
                    <Metric label='Scope total' value={total} />
                    <Metric label='Open loaded' value={counts.open} tone={counts.open ? 'warn' : 'ok'} />
                    <Metric label='Confirmed' value={counts.confirmed} />
                    <Metric label='Rejected' value={counts.rejected} />
                    <Metric label='Contradicted' value={counts.contradicted} />
                </div>
                {error ? <div role='alert' className='flex items-start gap-2 border-t border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
            </DashboardPanel>

            <div className='grid min-h-[38rem] gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='grid grid-cols-5 border-b border-ui-border bg-ui-raised p-1'>
                        {filters.map(item => <button key={item} type='button' onClick={() => setFilter(item)} className={`h-8 px-1 text-[10px] font-semibold capitalize ${filter === item ? 'bg-ui-panel text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{item}</button>)}
                    </div>
                    <div className='max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'>
                        {visible.map(claim => (
                            <button key={claim.id} type='button' onClick={() => setSelectedId(claim.id)} className={`flex w-full items-center gap-2 border-b border-ui-border px-3 py-2.5 text-left hover:bg-ui-raised ${selected?.id === claim.id ? 'bg-ui-raised' : ''}`}>
                                <ClaimStateIcon state={claim.reviewState} />
                                <span className='min-w-0 flex-1'>
                                    <span className='block truncate text-xs font-semibold text-ui-text'>{claim.summary || claim.claimType || 'Intelligence claim'}</span>
                                    <span className='mt-0.5 block truncate text-[11px] text-ui-muted'>{claim.claimType || 'untyped'} · {label(claim.reviewState || 'unreviewed')}</span>
                                </span>
                                <ChevronRight className='h-3.5 w-3.5 shrink-0 text-ui-muted' />
                            </button>
                        ))}
                        {!visible.length ? <div className='grid min-h-56 place-items-center p-5 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : 'No claims match this view.'}</div> : null}
                        {nextCursor ? <button type='button' onClick={() => void load(nextCursor, true)} disabled={loading} className='h-10 w-full border-t border-ui-border text-xs font-semibold text-ui-primary hover:bg-ui-raised disabled:opacity-50'>Load more</button> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    {selected ? (
                        <div className='grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                            <section className='min-w-0 border-b border-ui-border lg:border-b-0 lg:border-r'>
                                <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='text-[10px] font-semibold uppercase text-ui-primary'>{selected.claimType || 'claim'}</p>
                                            <h2 className='mt-1 break-words text-base font-semibold text-ui-text'>{selected.summary || 'Extracted intelligence claim'}</h2>
                                        </div>
                                        <StateBadge state={selected.reviewState || 'unreviewed'} />
                                    </div>
                                </div>
                                <div className='grid gap-4 p-4'>
                                    <dl className='grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4'>
                                        <Datum label='Confidence' value={formatConfidence(selected.confidence)} />
                                        <Datum label='Corroboration' value={label(selected.corroborationState || 'unknown')} />
                                        <Datum label='Evidence stage' value={label(selected.evidenceStage || 'unspecified')} />
                                        <Datum label='Updated' value={formatDate(selected.updatedAt || selected.createdAt)} />
                                        <Datum label='Sources' value={String(selected.sourceIds?.length || 0)} />
                                        <Datum label='Captures' value={String(selected.captureIds?.length || 0)} />
                                        <Datum label='Claim ID' value={selected.id} wide />
                                    </dl>
                                    <div>
                                        <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Structured value</h3>
                                        <pre className='mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-text'>{formatValue(selected.value)}</pre>
                                    </div>
                                </div>
                            </section>
                            <aside className='grid content-start gap-3 bg-ui-canvas p-3'>
                                <div>
                                    <label htmlFor='claim-review-reason' className='text-[10px] font-semibold uppercase text-ui-muted'>Decision reason</label>
                                    <textarea id='claim-review-reason' value={reason} onChange={event => setReason(event.target.value)} rows={6} maxLength={1000} placeholder='State the evidence basis for this decision.' className='mt-1 w-full resize-y rounded-md border border-ui-border bg-ui-panel p-3 text-sm leading-5 text-ui-text outline-none focus:border-ui-primary' />
                                    <p className='mt-1 text-[11px] text-ui-muted'>{reason.trim().length}/1000</p>
                                </div>
                                <div className='grid grid-cols-2 gap-2'>
                                    <DecisionButton icon={<Check className='h-4 w-4' />} label='Confirm' onClick={() => void review('confirm')} disabled={saving} tone='primary' />
                                    <DecisionButton icon={<X className='h-4 w-4' />} label='Reject' onClick={() => void review('reject')} disabled={saving} tone='danger' />
                                    <DecisionButton icon={<ShieldAlert className='h-4 w-4' />} label='Contradict' onClick={() => void review('mark_contradicted')} disabled={saving} />
                                    <DecisionButton icon={<RefreshCw className='h-4 w-4' />} label='Needs review' onClick={() => void review('mark_needs_review')} disabled={saving} />
                                </div>
                            </aside>
                        </div>
                    ) : <div className='grid min-h-96 place-items-center p-6 text-sm text-ui-muted'>Select a claim to review.</div>}
                </DashboardPanel>
            </div>
        </div>
    )
}

function matchesFilter(claim: Claim, filter: (typeof filters)[number]) {
    const state = claim.reviewState || 'unreviewed'
    if (filter === 'all') return true
    if (filter === 'open') return state === 'unreviewed' || state === 'needs_review'
    return state === filter
}

function dedupe(claims: Claim[]) { return [...new Map(claims.map(claim => [claim.id, claim])).values()] }
function label(value: string) { return value.replaceAll('_', ' ') }
function formatConfidence(value?: number) { return Number.isFinite(value) ? `${Math.round(Number(value) * 100)}%` : 'Not scored' }
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unknown' }
function formatValue(value: unknown) { if (value === undefined) return 'No structured value stored.'; try { return typeof value === 'string' ? value : JSON.stringify(value, null, 2) } catch { return 'Value could not be displayed.' } }
function message(error: unknown) { return error instanceof Error ? error.message : 'The claim review request failed.' }

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status}).`)
    return payload as T
}

function Metric({ label: metricLabel, value, tone = 'neutral' }: { label: string, value: number, tone?: 'neutral' | 'ok' | 'warn' }) {
    return <div className='bg-ui-panel px-3 py-2.5'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{metricLabel}</p><p className={`mt-1 text-lg font-semibold ${tone === 'warn' ? 'text-ui-warning' : tone === 'ok' ? 'text-ui-success' : 'text-ui-text'}`}>{value}</p></div>
}

function Datum({ label: datumLabel, value, wide = false }: { label: string, value: string, wide?: boolean }) {
    return <div className={wide ? 'min-w-0 sm:col-span-2 xl:col-span-2' : 'min-w-0'}><dt className='text-[10px] font-semibold uppercase text-ui-muted'>{datumLabel}</dt><dd className='mt-1 break-all font-medium text-ui-text'>{value}</dd></div>
}

function ClaimStateIcon({ state }: { state?: string }) {
    return state === 'confirmed' ? <Check className='h-4 w-4 shrink-0 text-ui-success' /> : state === 'rejected' ? <X className='h-4 w-4 shrink-0 text-ui-danger' /> : <AlertTriangle className='h-4 w-4 shrink-0 text-ui-warning' />
}

function StateBadge({ state }: { state: string }) {
    const tone = state === 'confirmed' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : state === 'rejected' || state === 'contradicted' ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
    return <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>{label(state)}</span>
}

function DecisionButton({ icon, label: buttonLabel, onClick, disabled, tone = 'neutral' }: { icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean, tone?: 'neutral' | 'primary' | 'danger' }) {
    const color = tone === 'primary' ? 'border-ui-primary bg-ui-primary text-ui-canvas' : tone === 'danger' ? 'border-ui-danger/40 text-ui-danger hover:bg-ui-danger/10' : 'border-ui-border text-ui-text hover:bg-ui-raised'
    return <button type='button' onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-2 text-xs font-semibold disabled:opacity-50 ${color}`}>{icon}{buttonLabel}</button>
}
