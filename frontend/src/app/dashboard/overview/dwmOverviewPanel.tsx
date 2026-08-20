'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, FileText, Loader2, Radar, ShieldAlert, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DwmProductSnapshot } from '@/utils/dwm/product'

type CaseRow = { status?: string }
type LoadState = { status: 'loading' } | { status: 'ready', snapshot: DwmProductSnapshot, openCases: number | null } | { status: 'error', message: string }

export default function DwmOverviewPanel({ organizationId }: { organizationId?: string }) {
    const [state, setState] = useState<LoadState>({ status: 'loading' })

    useEffect(() => {
        const controller = new AbortController()
        const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
        const casesQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
        Promise.all([
            fetch(`/api/dwm/product${query}`, { cache: 'no-store', signal: controller.signal }),
            fetch(`/api/cases${casesQuery}`, { cache: 'no-store', signal: controller.signal }).catch(() => null),
        ])
            .then(async ([snapshotResponse, casesResponse]) => {
                const body = await snapshotResponse.json().catch(() => null) as DwmProductSnapshot | { error?: { message?: string } } | null
                const errorMessage = body && 'error' in body ? body.error?.message : undefined
                if (!snapshotResponse.ok || !body || !('schemaVersion' in body)) throw new Error(errorMessage || 'Tenant monitoring is unavailable.')
                if (organizationId && body.tenantId !== organizationId) throw new Error('Organization monitoring returned an unexpected tenant scope.')
                const caseBody = casesResponse?.ok ? await casesResponse.json().catch(() => null) as { items?: CaseRow[], cases?: CaseRow[] } | null : null
                const cases = Array.isArray(caseBody?.items) ? caseBody.items : Array.isArray(caseBody?.cases) ? caseBody.cases : null
                const openCases = cases?.filter(row => !['closed', 'resolved', 'false_positive', 'suppressed'].includes(String(row.status || '').toLowerCase())).length ?? null
                setState({ status: 'ready', snapshot: body, openCases })
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setState({ status: 'error', message: error instanceof Error ? error.message : 'Tenant monitoring is unavailable.' })
            })
        return () => controller.abort()
    }, [organizationId])

    const scopeLabel = organizationId ? 'Organization monitoring' : 'Personal monitoring'
    if (state.status === 'loading') return <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' aria-label={scopeLabel}><div className='flex items-center gap-2 text-sm text-ui-muted'><Loader2 className='h-4 w-4 animate-spin text-ui-primary' />Loading {scopeLabel.toLowerCase()}…</div></section>
    if (state.status === 'error') return <section className='rounded-lg border border-ui-warning/40 bg-ui-panel p-4 shadow-sm' aria-label={scopeLabel}><div className='flex items-center gap-2 text-sm font-semibold text-ui-text'><AlertTriangle className='h-4 w-4 text-ui-warning' />{scopeLabel} needs review</div><p className='mt-2 text-sm text-ui-muted'>{state.message}</p><Link href={organizationId ? `/dashboard/dwm?organizationId=${encodeURIComponent(organizationId)}` : '/dashboard/dwm'} className='mt-3 inline-flex text-sm font-semibold text-ui-primary hover:underline'>Open DWM</Link></section>

    const { snapshot, openCases } = state
    const healthySources = snapshot.sourceCoverage.filter(source => source.health === 'healthy').length
    const hasWatchlist = snapshot.watchlist.length > 0
    if (!hasWatchlist) {
        const watchlistHref = organizationId
            ? `/dashboard/dwm/watchlists?organizationId=${encodeURIComponent(organizationId)}`
            : '/dashboard/dwm/watchlists'
        return <section className='grid min-h-[26rem] place-items-center rounded-lg border border-ui-border bg-ui-panel p-6 text-center shadow-sm' aria-label={scopeLabel}>
            <div className='grid max-w-md justify-items-center gap-4'>
                <span className='grid h-14 w-14 place-items-center rounded-2xl border border-ui-primary/30 bg-ui-primary/10 text-ui-primary shadow-[0_0_28px_rgba(157,180,255,0.14)]'>
                    <Radar className='h-7 w-7' />
                </span>
                <div>
                    <h2 className='mt-2 text-2xl font-semibold text-ui-text'>Welcome to Hanasand</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted'>Create your first watchlist to start monitoring companies, domains, brands, and vendors.</p>
                </div>
                <Link href={watchlistHref} className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                    Create watchlist
                    <ArrowRight className='h-4 w-4' />
                </Link>
            </div>
        </section>
    }
    const openAlerts = snapshot.alerts.filter(alert => !['closed', 'resolved', 'false_positive', 'suppressed'].includes(alert.reviewState.toLowerCase()))
    const recentMatches = snapshot.alerts.filter(alert => Date.now() - new Date(alert.firstSeenAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length
    const latestEvidence = snapshot.alerts.flatMap(alert => alert.evidence).sort((a, b) => {
        const left = new Date(a.provenance?.collectedAt || a.observedAt || a.firstSeenAt || 0).getTime()
        const right = new Date(b.provenance?.collectedAt || b.observedAt || b.firstSeenAt || 0).getTime()
        return right - left
    })[0]
    const readiness = snapshot.readiness.decision === 'production_ready_with_live_sources' ? 'Collection is active' : 'Collection needs setup'
    const readinessTone = snapshot.readiness.decision === 'production_ready_with_live_sources' ? 'text-ui-success' : 'text-ui-warning'
    const overviewHref = organizationId ? `/dashboard/dwm?organizationId=${encodeURIComponent(organizationId)}` : '/dashboard/dwm'

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' aria-label={scopeLabel}>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
                <p className='text-xs font-semibold uppercase tracking-[0.08em] text-ui-primary'>{scopeLabel}</p>
                <h2 className='mt-1 text-base font-semibold text-ui-text'>Monitoring overview</h2>
                <p className='mt-1 text-sm text-ui-muted'>What Hanasand found for the terms you are watching.</p>
            </div>
            <Link href={overviewHref} className='inline-flex h-9 w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'><Radar className='h-4 w-4 text-ui-primary' />Open monitoring</Link>
        </div>
        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            <Metric icon={<Radar className='h-4 w-4' />} label='Active watch terms' value={snapshot.watchlist.length} detail='companies, domains, brands, and vendors' />
            <Metric icon={<ShieldAlert className='h-4 w-4' />} label='New matches · 7 days' value={recentMatches} detail={recentMatches ? 'relevant activity found' : 'no new matches'} />
            <Metric icon={<BellRing className='h-4 w-4' />} label='Open alerts' value={openAlerts.length} detail={openAlerts.length ? 'ready to review' : 'no new alerts'} />
            <Metric icon={<Ticket className='h-4 w-4' />} label='Open cases' value={openCases ?? '—'} detail={openCases === null ? 'case data unavailable' : openCases ? 'active customer work' : 'no open cases'} />
            <Metric icon={<CheckCircle2 className='h-4 w-4' />} label='Source health' value={snapshot.sourceCoverage.length ? `${healthySources}/${snapshot.sourceCoverage.length}` : '—'} detail={snapshot.sourceCoverage.length ? 'healthy source families' : 'No source coverage yet'} />
            <Metric icon={<FileText className='h-4 w-4' />} label='Latest evidence' value={latestEvidence ? 'Available' : 'None yet'} detail={latestEvidence?.sourceName || 'No retained evidence'} />
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-sm'>
            <span className={`inline-flex items-center gap-2 font-semibold ${readinessTone}`}><span className='h-2 w-2 rounded-full bg-current' />{readiness}</span>
            <span className='text-xs text-ui-muted'>Updated {formatAge(snapshot.generatedAt)}{snapshot.readiness.blockers[0] ? ` · ${snapshot.readiness.blockers[0]}` : ''}</span>
        </div>
        {!openAlerts.length && <p className='mt-3 text-sm text-ui-muted'>No new <Link href={overviewHref} className='font-semibold text-ui-primary underline underline-offset-2'>alerts</Link>.</p>}
    </section>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode, label: string, value: number | string, detail: string }) {
    return <div className='rounded-md border border-ui-border bg-ui-canvas p-3'><div className='flex items-center justify-between gap-2 text-ui-muted'><span className='text-xs font-semibold uppercase tracking-[0.08em]'>{label}</span>{icon}</div><p className='mt-2 text-2xl font-semibold text-ui-text'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></div>
}

function formatAge(value: string) {
    const timestamp = new Date(value).getTime()
    if (!Number.isFinite(timestamp)) return 'recently'
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}
