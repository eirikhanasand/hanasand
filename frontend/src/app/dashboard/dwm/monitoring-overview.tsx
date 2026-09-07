'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DwmActorOverview, DwmProductSnapshot } from '@/utils/dwm/product'
import { customerAlertSummary, safeEvidenceExcerpt } from '@/utils/dwm/display'
import type { DwmDataHealth, OperationsSnapshot, PortalAlert } from './dwm-analyst-portal'

const panel = 'min-w-0 rounded-lg border border-ui-border bg-ui-panel'
const control = 'rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text'
const link = 'text-sm font-semibold text-ui-primary underline-offset-2 hover:underline'
const pageSize = 20
const needsReview = (alert: PortalAlert) => !['resolved', 'closed', 'false_positive', 'suppressed'].includes(alert.reviewState) && alert.deliveryState !== 'muted'
const label = (value: string) => value.replaceAll('_', ' ')

function Timestamp({ value }: { value?: string }) {
    if (!value || !Number.isFinite(Date.parse(value))) return <span>Not recorded</span>
    return <time dateTime={value}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC</time>
}

function LoadState({ state, subject, onRetry }: { state: string, subject: string, onRetry: () => void }) {
    if (state === 'live') return null
    return <div role={state === 'error' ? 'alert' : 'status'} className='p-4 text-sm text-ui-muted'>
        {state === 'error' ? <>{subject} could not be loaded. <button onClick={onRetry} className={link}>Retry</button></> : `Loading ${subject.toLowerCase()}…`}
    </div>
}

function Pages({ count, page, setPage }: { count: number, page: number, setPage: (page: number) => void }) {
    if (count <= pageSize) return null
    return <nav aria-label='Results pages' className='flex items-center justify-between gap-3 border-t border-ui-border p-3 text-sm'>
        <button className={control} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count}</span>
        <button className={control} disabled={(page + 1) * pageSize >= count} onClick={() => setPage(page + 1)}>Next</button>
    </nav>
}

export function MonitoringOverview({ snapshot, operations, alerts, dataHealth, organizationId, initialAlertId, busyAction, actionMessage, onRefresh, onOpenCase, canOpenCase, caseHref }: {
    snapshot: DwmProductSnapshot
    operations: OperationsSnapshot | null
    alerts: PortalAlert[]
    dataHealth: DwmDataHealth
    organizationId?: string
    initialAlertId?: string
    busyAction: string | null
    actionMessage: { ok: boolean, text: string } | null
    onRefresh: () => void
    onOpenCase: (alert: PortalAlert) => Promise<void>
    canOpenCase: (alert: PortalAlert) => boolean
    caseHref: (alert: PortalAlert) => string | undefined
}) {
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(0)
    const pending = alerts.filter(needsReview).length
    const rows = alerts.filter(alert => (filter === 'all' || needsReview(alert)) && [alert.company, alert.actor, alert.matchedTerm.value].some(value => value?.toLowerCase().includes(query.toLowerCase())))
        .sort((a, b) => (Date.parse(b.lastSeenAt || b.firstSeenAt) || 0) - (Date.parse(a.lastSeenAt || a.firstSeenAt) || 0))
    const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
    const scopedHref = (path: string) => organizationId ? `${path}?organizationId=${encodeURIComponent(organizationId)}` : path
    return <div className='grid min-w-0 gap-4' data-dwm-overview>
        <header className='flex flex-wrap items-start justify-between gap-3'>
            <div><h1 className='text-xl font-semibold text-ui-text'>Dark web monitoring</h1><p className='mt-1 text-sm text-ui-muted'>Findings matching your watchlist and the sources behind them.</p></div>
            <button onClick={onRefresh} className={control}>Refresh</button>
        </header>
        <section className={`${panel} p-4`}>
            <div className='flex flex-wrap items-center justify-between gap-2'><h2 className='font-semibold text-ui-text'>Your watchlist</h2><Link className={link} href={scopedHref('/dwm/watchlists')}>Manage watchlist</Link></div>
            <LoadState state={dataHealth.snapshot.state} subject='Watchlist' onRetry={onRefresh} />
            {dataHealth.snapshot.state === 'live' && (snapshot.watchlist.length ? <ul className='mt-3 flex flex-wrap gap-2'>{snapshot.watchlist.map(term => <li key={`${term.kind}:${term.value}`} className='max-w-full break-words rounded-md bg-ui-raised px-3 py-1 text-sm text-ui-text'>{term.value} <span className='text-ui-muted'>· {label(term.kind)}</span></li>)}</ul> : <p className='mt-2 text-sm text-ui-muted'>Add a company, domain, brand, or other term to start matching findings.</p>)}
        </section>
        <section className={panel}>
            <header className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                <div><h2 className='font-semibold text-ui-text'>Recent findings</h2>{dataHealth.alerts.state === 'live' && <p className='mt-1 text-sm text-ui-muted'>{alerts.length} findings · {pending} needing review</p>}</div>
                <div className='flex flex-wrap gap-2'><input aria-label='Search findings' placeholder='Company, domain, or actor' className={`${control} min-w-0 max-w-full`} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /><select aria-label='Filter findings' className={control} value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}><option value='all'>All findings</option><option value='review'>Needs review</option></select></div>
            </header>
            <LoadState state={dataHealth.alerts.state} subject='Findings' onRetry={onRefresh} />
            {actionMessage && <p role={actionMessage.ok ? 'status' : 'alert'} className={`p-4 text-sm ${actionMessage.ok ? 'text-ui-text' : 'text-ui-danger'}`}>{actionMessage.text}</p>}
            {dataHealth.alerts.state === 'live' && !rows.length && <p className='p-6 text-sm text-ui-muted'>{alerts.length ? 'No findings match this filter.' : snapshot.watchlist.length ? 'No saved findings match your watchlist yet. Check collection health below to see whether sources have been collected.' : 'No saved findings yet. Add watchlist terms to monitor what matters to you.'}</p>}
            {dataHealth.alerts.state === 'live' && <div className='divide-y divide-ui-border'>{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(alert => {
                const href = caseHref(alert)
                const evidence = alert.evidence || []
                return <article key={alert.id} className='min-w-0 p-4' data-finding-id={alert.id}>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0'><h3 className='break-words font-semibold text-ui-text'>{alert.company || alert.matchedTerm.value}</h3><p className='mt-1 text-xs text-ui-muted'>Matched {alert.matchedTerm.value} · {label(alert.severity)} · {label(alert.reviewState)}</p></div>
                        {href ? <Link href={href} className={link}>Open case</Link> : <button className={`${control} disabled:cursor-not-allowed disabled:opacity-50`} disabled={busyAction === `case:${alert.id}` || !canOpenCase(alert)} title={canOpenCase(alert) ? undefined : 'Case creation requires retained source evidence and permission.'} onClick={() => void onOpenCase(alert)}>{busyAction === `case:${alert.id}` ? 'Opening…' : 'Open case'}</button>}
                    </div>
                    <p className='mt-2 break-words text-sm leading-6 text-ui-text'>{customerAlertSummary(alert)}</p>
                    <p className='mt-2 text-xs text-ui-muted'>{alert.matchTiming?.kind === 'new_evidence' ? 'New observation' : alert.matchTiming?.kind === 'historical_backfill' ? 'Historical match' : 'Observation'} · <Timestamp value={alert.evidenceSummary?.lastObservedAt || alert.lastSeenAt || alert.firstSeenAt} /> · {evidence.length} evidence records</p>
                    <details className='mt-3' open={initialAlertId === alert.id || undefined}>
                        <summary className={`${link} cursor-pointer`}>Investigate finding</summary>
                        <p className='mt-3 text-sm text-ui-muted'>{alert.recommendedAction}</p>
                        {alert.actor && <Link className={`${link} mt-2 inline-block`} href={`/ti/${encodeURIComponent(alert.actor)}`}>Open {alert.actor} profile</Link>}
                        {!evidence.length && <p className='mt-3 text-sm text-ui-muted'>No retained evidence is attached to this finding.</p>}
                        <ul className='mt-3 grid gap-3'>{evidence.map(item => <li key={item.id} className='min-w-0 rounded-md border border-ui-border bg-ui-canvas p-3'>
                            <p className='text-sm font-semibold text-ui-text'>{item.sourceName} <span className='font-normal text-ui-muted'>· {label(item.captureMode)}</span></p>
                            <p className='mt-1 text-xs text-ui-muted'>Observed: <Timestamp value={item.observedAt || item.firstSeenAt || item.provenance?.publishedAt} /></p>
                            <p className='mt-1 text-xs text-ui-muted'>Collected: <Timestamp value={item.provenance?.collectedAt} /></p>
                            <blockquote className='mt-2 break-words text-sm leading-6 text-ui-text'>{safeEvidenceExcerpt(item.excerpt)}</blockquote>
                            {item.provenance?.captureId && <p className='mt-2 break-all text-xs text-ui-muted'>Capture: {item.provenance.captureId}</p>}
                            {item.contentHash && <p className='mt-1 break-all font-mono text-xs text-ui-muted'>Hash: {item.contentHash}</p>}
                        </li>)}</ul>
                    </details>
                </article>
            })}</div>}
            <Pages count={rows.length} page={currentPage} setPage={setPage} />
        </section>
        <SourceCollectionStatus operations={operations} state={dataHealth.operations.state} onRetry={onRefresh} />
        <Link className={link} href={scopedHref('/dwm/actors')}>Browse monitored actors</Link>
    </div>
}

function SourceCollectionStatus({ operations, state, onRetry }: { operations: OperationsSnapshot | null, state: string, onRetry: () => void }) {
    const [page, setPage] = useState(0)
    const rows = operations?.sourceHealth || []
    const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
    const statuses: Record<string, string> = { succeeded: 'Last attempt succeeded', failed: 'Collection failed', degraded: 'Collected with warnings', not_collected: 'No successful collection', paused: 'Collection paused' }
    return <section className={panel}>
        <header className='border-b border-ui-border p-4'><h2 className='font-semibold text-ui-text'>Collection health</h2><p className='mt-1 text-sm text-ui-muted'>Recorded results and successful collection times. Configuration alone does not confirm collection.</p></header>
        <LoadState state={state} subject='Collection health' onRetry={onRetry} />
        {state === 'live' && !rows.length && <p className='p-4 text-sm text-ui-muted'>No sources are available in this monitoring scope.</p>}
        {state === 'live' && <ul className='divide-y divide-ui-border'>{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(source => <li key={source.sourceId} className='grid gap-2 p-4 sm:grid-cols-3'>
            <div className='min-w-0'><p className='break-words text-sm font-semibold text-ui-text'>{source.sourceName}</p><p className='mt-1 text-xs text-ui-muted'>{label(source.family)} · {source.approvedMetadataOnly ? 'Metadata only' : 'Content collection'}</p></div>
            <div className='text-sm text-ui-text'>{source.collectionStatus ? statuses[source.collectionStatus] : 'Collection result not recorded'}<p className='mt-1 text-xs text-ui-muted'>Last attempt: <Timestamp value={source.lastAttemptAt} /></p></div>
            <p className='text-xs text-ui-muted'>Last success: <Timestamp value={source.lastSuccessAt || source.lastCollectedAt} /></p>
        </li>)}</ul>}
        <Pages count={rows.length} page={currentPage} setPage={setPage} />
    </section>
}

export function ActorDirectory({ actors, state, onRetry }: { actors: DwmActorOverview[], state: string, onRetry: () => void }) {
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(0)
    const rows = actors.filter(actor => [actor.actor, ...actor.aliases].some(name => name.toLowerCase().includes(query.toLowerCase())))
    const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
    return <section>
        <LoadState state={state} subject='Actor profiles' onRetry={onRetry} />
        {state === 'live' && <>
            <div className='p-4'><p className='mb-3 text-sm text-ui-muted'>Profiles linked to available sources and observations. A listed source does not confirm active monitoring.</p><input aria-label='Search actors' placeholder='Search actors or aliases' className={`${control} w-full`} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></div>
            {!rows.length && <p className='p-4 text-sm text-ui-muted'>{actors.length ? 'No actors match this search.' : 'No actor profiles are linked to this monitoring scope yet.'}</p>}
            <ul className='divide-y divide-ui-border'>{rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(actor => <li key={actor.actor} className='flex flex-wrap items-center justify-between gap-3 p-4'>
                <div className='min-w-0'><Link className={`${link} break-words`} href={`/ti/${encodeURIComponent(actor.actor)}`}>{actor.actor}</Link><p className='mt-1 text-xs text-ui-muted'>{actor.sourceCount} sources · {actor.captureCount} captures · {actor.captureCount ? 'Recorded observations' : 'No captured observations'}</p><p className='mt-1 text-xs text-ui-muted'>Latest observation: <Timestamp value={actor.latestSeenAt} /></p>{actor.sourceFamilies.includes('darkweb_metadata') && <p className='mt-1 text-xs text-ui-muted'>Includes metadata-only sources</p>}</div>
                <Link className={link} href={`/ti/${encodeURIComponent(actor.actor)}`} aria-label={`Open ${actor.actor} profile`}>Open profile</Link>
            </li>)}</ul>
            <Pages count={rows.length} page={currentPage} setPage={setPage} />
        </>}
    </section>
}
