'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, BellRing, CheckCircle2, Copy, Loader2, RotateCcw, Send, ShieldCheck, UserRound, XCircle } from 'lucide-react'
import { safeEvidenceExcerpt } from '@/utils/dwm/display'

export type CaseDetail = {
    schemaVersion?: string
    generatedAt?: string
    access?: { readOnly?: boolean, role?: string, blockerCodes?: string[] }
    case?: {
        id: string
        title?: string
        status?: string
        priority?: string
        organizationId?: string
        tenantId?: string
        alertId?: string
        assignedOwner?: string
        createdAt?: string
        updatedAt?: string
        closedAt?: string
        lastDecision?: string
        events?: CaseEvent[]
        handoffActionReceipts?: unknown[]
        customerNotifications?: unknown[]
    }
    workflowState?: {
        status?: string
        assignedOwner?: string
        lastDecision?: string
        eventCount?: number
    }
    workflowActionPolicy?: {
        summary?: {
            enabledActionIds?: string[]
            blockedActionIds?: string[]
            blockerCodes?: string[]
            readOnly?: boolean
        }
        actions?: CaseAction[]
    }
    alert?: CaseAlert
    alertContext?: {
        id?: string
        reviewState?: string
        deliveryState?: string
        assignedOwner?: string
        workflowNote?: string
        provenance?: CaseAlert['provenance']
        workflowEvents?: Array<{ id?: string, at?: string, actor?: string, note?: string, toReviewState?: string, toDeliveryState?: string }>
    }
    watchlists?: Array<{
        id?: string
        name?: string
        matchedTerms?: Array<{ id?: string, kind?: string, value?: string }>
    }>
    deliveryContext?: {
        deliveryCount?: number
        latestDelivery?: DeliveryRow
        delivered?: boolean
        retryable?: boolean
        failed?: DeliveryRow[]
    }
    handoffActionReadiness?: { ready?: boolean, blockers?: string[], actions?: unknown[] }
    handoffActionReceipts?: unknown[]
    customerNotificationContext?: { count?: number, latestAt?: string, ready?: boolean, blockers?: string[] }
    deliveries?: DeliveryRow[]
    evidence?: EvidenceRow[]
    timeline?: TimelineRow[]
    nextActions?: Array<{ id?: string, label?: string, detail?: string, route?: string, enabled?: boolean }>
    nextAllowedActions?: CaseAction[]
}

export type CaseExport = {
    schemaVersion?: string
    summary?: {
        caseId?: string
        alertId?: string
        evidenceCount?: number
        deliveryCount?: number
        delivered?: boolean
        dedupeKey?: string
        recommendedRoute?: string
    }
    evidenceSummary?: EvidenceRow[]
    timelineSummary?: TimelineRow[]
    deliveryEvidence?: DeliveryRow[]
    copyText?: string
    exportChecksum?: string
}

type CaseAction = {
    id: string
    label?: string
    method?: string
    requiresRationale?: boolean
    enabled?: boolean
    disabledReason?: string
}

type CaseEvent = {
    id?: string
    at?: string
    action?: string
    actor?: string
    note?: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
}

type CaseAlert = {
    id?: string
    severity?: string
    reviewState?: string
    deliveryState?: string
    matchedTerm?: { kind?: string, value?: string }
    sourceFamily?: string
    firstSeenAt?: string
    lastSeenAt?: string
    confidence?: number
    dedupeKey?: string
    provenance?: {
        sourceIds?: string[]
        captureIds?: string[]
        contentHashes?: string[]
    }
    webhookDelivery?: {
        dedupeKey?: string
        endpointHash?: string
        payloadHash?: string
    }
}

type EvidenceRow = {
    id?: string
    sourceName?: string
    sourceFamily?: string
    observedAt?: string
    collectedAt?: string
    contentHash?: string
    safeExcerpt?: string
    excerpt?: string
    redaction?: { redacted?: boolean }
    provenance?: { sourceId?: string, captureId?: string, contentHash?: string }
}

type DeliveryRow = {
    id?: string
    alertId?: string
    caseId?: string
    requestId?: string
    auditEventId?: string
    status?: string
    attemptedAt?: string
    endpointHash?: string
    endpointHint?: string
    webhookDestinationId?: string
    destinationId?: string
    payloadHash?: string
    dedupeKey?: string
    dryRun?: boolean
    httpStatus?: number
    error?: string
    errorClass?: string
    attemptCount?: number | null
    retryCount?: number | null
    nextRetryAt?: string | null
}

type TimelineRow = {
    id?: string
    timestamp?: string
    at?: string
    eventType?: string
    action?: string
    actor?: string
    source?: string
    rationale?: string
    note?: string
    related?: Record<string, unknown>
    workflow?: {
        fromStatus?: string
        toStatus?: string
        fromOwner?: string
        toOwner?: string
    }
}

type LoadState = {
    loading: boolean
    error?: string
    detail?: CaseDetail
    exportPayload?: CaseExport
}

const primaryActions = ['review', 'assign', 'escalate', 'suppress', 'false_positive', 'close', 'reopen', 'note']

export function DwmCaseDetailClient({ caseId, tenantId, organizationId, alertId, routeRun, initialDetail, initialExportPayload }: {
    caseId: string
    tenantId?: string
    organizationId?: string
    alertId?: string
    routeRun?: string
    initialDetail?: CaseDetail
    initialExportPayload?: CaseExport
}) {
    const [state, setState] = useState<LoadState>({
        loading: !initialDetail,
        detail: initialDetail,
        exportPayload: initialExportPayload,
    })
    const [busy, setBusy] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const [note, setNote] = useState('')
    const [owner, setOwner] = useState(initialDetail?.case?.assignedOwner || initialDetail?.workflowState?.assignedOwner || '')

    const caseRecord = state.detail?.case
    const alert = state.detail?.alert
    const alertContext = state.detail?.alertContext
    const actions = useMemo(() => {
        const source = state.detail?.workflowActionPolicy?.actions?.length ? state.detail.workflowActionPolicy.actions : state.detail?.nextAllowedActions || []
        return primaryActions.map(id => source.find(action => action.id === id) || { id, enabled: false, disabledReason: 'Action is not available for this case.' })
    }, [state.detail])

    async function load() {
        setState(previous => ({ ...previous, loading: true, error: undefined }))
        try {
            const query = queryString({ tenantId, organizationId, alertId })
            const [detailResponse, exportResponse] = await Promise.all([
                fetch(`/api/cases/${encodeURIComponent(caseId)}${query}`, { cache: 'no-store' }),
                fetch(`/api/cases/${encodeURIComponent(caseId)}/export${queryString({ tenantId, organizationId, alertId, shape: 'full' })}`, { cache: 'no-store' }),
            ])
            const detailPayload = await detailResponse.json().catch(() => ({}))
            const exportPayload = await exportResponse.json().catch(() => ({}))
            if (!detailResponse.ok) throw new Error(detailPayload.error?.message || detailResponse.statusText)
            setState({ loading: false, detail: detailPayload, exportPayload: exportResponse.ok ? exportPayload : undefined })
            const nextOwner = detailPayload.case?.assignedOwner || detailPayload.workflowState?.assignedOwner || ''
            setOwner(nextOwner)
        } catch (error) {
            setState({ loading: false, error: error instanceof Error ? error.message : 'Case detail failed to load.' })
        }
    }

    useEffect(() => {
        void load()
    }, [caseId, tenantId, organizationId, alertId])

    async function runAction(action: CaseAction) {
        if (!action.enabled || busy) return
        const actionId = action.id
        const rationale = note.trim()
        if (action.requiresRationale && !rationale) {
            setMessage({ ok: false, text: 'Add a reason before changing the case.' })
            return
        }
        if (actionId === 'assign' && !owner.trim()) {
            setMessage({ ok: false, text: 'Set an owner before assigning the case.' })
            return
        }
        setBusy(actionId)
        setMessage(null)
        try {
            const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    alertId: resolvedAlertId(caseRecord, alertContext, alertId),
                    action: actionId,
                    note: rationale,
                    assignedOwner: owner.trim() || undefined,
                    idempotencyKey: `dashboard-case:${caseId}:${actionId}:${Date.now()}`,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage({ ok: true, text: `${actionLabel(actionId)} recorded.` })
            await load()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Case action failed.' })
        } finally {
            setBusy(null)
        }
    }

    async function notifyCustomer() {
        if (busy) return
        setBusy('notify')
        setMessage(null)
        try {
            const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/customer-notification`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    deliveryMode: 'dry_run',
                    note: note.trim() || 'Customer notification dry run.',
                    idempotencyKey: `dashboard-case-notify:${caseId}:${Date.now()}`,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage({ ok: true, text: 'Notification dry run recorded.' })
            await load()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Notification dry run failed.' })
        } finally {
            setBusy(null)
        }
    }

    async function sendWebhook(dryRun: boolean) {
        const targetAlertId = resolvedAlertId(caseRecord, alertContext, alertId)
        if (!targetAlertId) {
            setMessage({ ok: false, text: 'This case is missing an alert id.' })
            return
        }
        setBusy(dryRun ? 'webhook-test' : 'webhook-send')
        setMessage(null)
        try {
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: resolvedTenantId(caseRecord, tenantId),
                    organizationId: resolvedOrganizationId(caseRecord, organizationId),
                    alertId: targetAlertId,
                    limit: 1,
                    dryRun,
                }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage({ ok: true, text: dryRun ? 'Webhook test recorded.' : 'Webhook delivery sent.' })
            await load()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Webhook delivery failed.' })
        } finally {
            setBusy(null)
        }
    }

    if (state.loading && !state.detail) {
        return (
            <main className='grid min-h-[70vh] place-items-center rounded-lg border border-ui-border bg-ui-canvas text-ui-text'>
                <div className='flex items-center gap-3 text-sm font-semibold'><Loader2 className='h-4 w-4 animate-spin' />Loading case</div>
            </main>
        )
    }

    if (state.error || !state.detail || !caseRecord) {
        return (
            <main className='rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-5 text-ui-danger'>
                <Link href='/dashboard/dwm' className='inline-flex items-center gap-2 text-xs font-semibold text-ui-danger'><ArrowLeft className='h-4 w-4' />Back to DWM</Link>
                <h1 className='mt-4 text-xl font-semibold'>Case unavailable</h1>
                <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-danger'>{state.error || 'The case could not be found for this organization.'}</p>
            </main>
        )
    }

    const timeline = state.detail.timeline || state.exportPayload?.timelineSummary || []
    const evidence = state.detail.evidence || state.exportPayload?.evidenceSummary || []
    const deliveries = orderCaseDeliveries(state.detail.deliveries || state.exportPayload?.deliveryEvidence || [])
    const latestDelivery = state.detail.deliveryContext?.latestDelivery || deliveries[0]
    const readOnly = Boolean(state.detail.access?.readOnly || state.detail.workflowActionPolicy?.summary?.readOnly)
    const scopedTenantId = resolvedTenantId(caseRecord, tenantId)
    const scopedOrganizationId = resolvedOrganizationId(caseRecord, organizationId)
    const scopedAlertId = resolvedAlertId(caseRecord, alertContext, alertId)
    const deliveryHistoryHref = scopedOrganizationId
        ? `/organizations${queryString({ organizationId: scopedOrganizationId, caseId: caseRecord.id, alertId: scopedAlertId, focus: 'destinations' })}#delivery-history`
        : '/organizations?focus=destinations#delivery-history'
    const destinationHref = scopedOrganizationId
        ? `/organizations${queryString({ organizationId: scopedOrganizationId, caseId: caseRecord.id, alertId: scopedAlertId, destinationId: latestDelivery?.webhookDestinationId || latestDelivery?.destinationId, focus: 'destinations' })}`
        : '/organizations?focus=destinations'

    return (
        <main className='grid min-w-0 gap-3 text-ui-text'>
            <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-canvas'>
                <div className='grid min-w-0 gap-3 border-b border-ui-border px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between'>
                    <div className='min-w-0 flex-1'>
                        <Link href='/dashboard/dwm' className='inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-ui-primary'><ArrowLeft className='h-3.5 w-3.5' />DWM cases</Link>
                        <h1 className='mt-2 min-w-0 wrap-break-word text-xl font-semibold text-ui-text'>{caseRecord.title || caseRecord.id}</h1>
                        <p className='mt-1 wrap-break-word text-xs text-ui-muted'>{caseRecord.id} · {caseRecord.organizationId || organizationId || 'organization pending'} · alert {caseRecord.alertId || alertContext?.id || alertId || 'pending'}</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <CasePill label='Status' value={caseRecord.status || 'open'} tone={caseRecord.status === 'closed' ? 'neutral' : 'ready'} />
                        <CasePill label='Priority' value={caseRecord.priority || alert?.severity || 'medium'} tone={alert?.severity === 'critical' ? 'warn' : 'neutral'} />
                        <CasePill label='Delivery' value={latestDelivery?.status || (state.detail.deliveryContext?.deliveryCount ? 'attempted' : 'not sent')} tone={latestDelivery?.status === 'delivered' ? 'ready' : latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
                    </div>
                </div>

                <div className='grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px]'>
                    <section className='grid min-w-0 gap-3'>
                        <CaseCommandBar
                            caseId={caseRecord.id}
                            tenantId={scopedTenantId}
                            organizationId={scopedOrganizationId}
                            alertId={scopedAlertId}
                            exportReady={Boolean(state.exportPayload?.exportChecksum)}
                            latestDelivery={latestDelivery}
                            readOnly={readOnly}
                        />

                        {routeRun ? (
                            <RouteHandoffStrip
                                routeRun={routeRun}
                                detail={state.detail}
                                exportPayload={state.exportPayload}
                                latestDelivery={latestDelivery}
                            />
                        ) : null}

                        <div className='grid gap-2 md:grid-cols-4'>
                            <Metric label='Watch terms' value={`${matchedTerms(state.detail).length}`} detail={matchedTerms(state.detail).slice(0, 2).join(', ') || 'none'} />
                            <Metric label='Evidence' value={`${evidence.length}`} detail={hashList(evidence.map(item => item.contentHash || item.provenance?.contentHash)).slice(0, 1).join(', ') || 'no hash'} />
                            <Metric label='Deliveries' value={`${deliveries.length}`} detail={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTime(latestDelivery.attemptedAt)}` : 'no attempts'} />
                            <Metric label='Timeline' value={`${timeline.length}`} detail={caseRecord.updatedAt ? `updated ${relativeTime(caseRecord.updatedAt)}` : 'no update'} />
                        </div>

                        <DecisionBrief
                            detail={state.detail}
                            exportPayload={state.exportPayload}
                            latestDelivery={latestDelivery}
                            actionDockHref='#dwm-case-actions'
                            destinationHref={destinationHref}
                            deliveryHistoryHref={deliveryHistoryHref}
                        />

                        <WorkflowStrip detail={state.detail} exportPayload={state.exportPayload} />

                        <section className='grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]'>
                            <CollapsiblePanel title='Evidence rows' action={`${evidence.length} rows`} defaultOpen={false}>
                                <div className='rounded-lg border border-ui-border'>
                                    {evidence.length ? (
                                        <>
                                            <div className='grid gap-2 p-2 md:hidden' data-dwm-case-evidence-mobile-list='true'>
                                                {evidence.map((row, index) => <EvidenceMobileRow key={row.id || index} row={row} />)}
                                            </div>
                                            <div className='hidden overflow-x-auto md:block'>
                                                <table className='w-full min-w-[760px] text-left text-xs' data-dwm-case-evidence-desktop-table='true'>
                                                    <thead className='bg-ui-canvas text-ui-muted'>
                                                        <tr>
                                                            <th className='px-3 py-2 font-semibold'>Source</th>
                                                            <th className='px-3 py-2 font-semibold'>Observed</th>
                                                            <th className='px-3 py-2 font-semibold'>Excerpt</th>
                                                            <th className='px-3 py-2 font-semibold'>Provenance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                                        {evidence.map((row, index) => (
                                                            <tr key={row.id || index} className='hover:bg-ui-raised'>
                                                                <td className='px-3 py-2 align-top font-semibold text-ui-text'>{row.sourceName || row.provenance?.sourceId || 'source pending'}<p className='text-[11px] font-normal text-ui-muted'>{stateLabel(row.sourceFamily)}</p></td>
                                                                <td className='px-3 py-2 align-top text-ui-muted'>{relativeTime(row.observedAt || row.collectedAt)}</td>
                                                                <td className='max-w-xl px-3 py-2 align-top text-ui-text'>{safeCaseEvidenceExcerpt(row)}</td>
                                                                <td className='px-3 py-2 align-top font-mono text-[11px] text-ui-muted'>{row.provenance?.captureId || row.id || 'capture pending'}<p>{row.contentHash || row.provenance?.contentHash || 'hash pending'}</p></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    ) : (
                                        <EmptyLine text='No evidence rows are attached to this case.' />
                                    )}
                                </div>
                            </CollapsiblePanel>

                            <CollapsiblePanel title='Audit timeline' action={`${timeline.length} events`} defaultOpen={false}>
                                <div className='max-h-[420px] overflow-y-auto pr-1'>
                                    <div className='grid gap-2'>
                                        {timeline.length ? timeline.map((row, index) => (
                                            <TimelineItem key={row.id || index} row={row} compact />
                                        )) : <EmptyLine text='No case events have been recorded yet.' />}
                                    </div>
                                </div>
                            </CollapsiblePanel>
                        </section>
                    </section>

                    <aside id='dwm-case-actions' data-dwm-case-action-dock className='order-first grid min-w-0 scroll-mt-24 content-start gap-3 xl:order-none'>
                        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                            <div className='flex items-center justify-between gap-2'>
                                <h2 className='text-sm font-semibold text-ui-text'>Analyst actions</h2>
                                {readOnly ? <span className='rounded-full border border-ui-warning/30 bg-ui-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-ui-warning'>Read only</span> : null}
                            </div>
                            <label className='mt-3 block text-[10px] font-semibold uppercase text-ui-muted'>Owner</label>
                            <input value={owner} onChange={event => setOwner(event.target.value)} placeholder='owner@company.com' className='mt-1 h-10 w-full rounded-lg border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/35' />
                            <label className='mt-3 block text-[10px] font-semibold uppercase text-ui-muted'>Reason</label>
                            <textarea value={note} onChange={event => setNote(event.target.value)} placeholder='Decision rationale, delivery context, or customer note.' className='mt-1 min-h-24 w-full resize-y rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/35' />
                            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                                {actions.map(action => <ActionButton key={action.id} action={action} busy={busy === action.id} disabled={readOnly || busy !== null || !action.enabled} onClick={() => runAction(action)} />)}
                            </div>
                            <button type='button' onClick={notifyCustomer} disabled={readOnly || busy !== null} className='mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                                {busy === 'notify' ? <Loader2 className='h-4 w-4 animate-spin' /> : <BellRing className='h-4 w-4' />}Notify dry run
                            </button>
                            {message ? <p className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${message.ok ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'}`}>{message.text}</p> : null}
                        </section>

                        <Panel title='Webhook delivery' action={state.detail.deliveryContext?.retryable ? 'retryable' : latestDelivery?.status || 'pending'}>
                            {latestDelivery ? (
                                <div className='grid gap-2 text-xs text-ui-muted'>
                                    <KeyValue label='Status' value={stateLabel(latestDelivery.status)} />
                                    <KeyValue label='Attempted' value={relativeTime(latestDelivery.attemptedAt)} />
                                    <KeyValue label='Endpoint' value={latestDelivery.endpointHint || latestDelivery.endpointHash || latestDelivery.webhookDestinationId || latestDelivery.destinationId || 'destination pending'} mono />
                                    <KeyValue label='Dedupe' value={latestDelivery.dedupeKey || 'pending'} mono />
                                    <div className='grid gap-2 sm:grid-cols-2'>
                                        <KeyValue label='Request' value={latestDelivery.requestId || latestDelivery.auditEventId || 'pending'} mono />
                                        <KeyValue label='Retry' value={latestDelivery.nextRetryAt ? relativeTime(latestDelivery.nextRetryAt) : latestDelivery.errorClass ? stateLabel(latestDelivery.errorClass) : `${latestDelivery.attemptCount ?? latestDelivery.retryCount ?? 0} attempts`} />
                                    </div>
                                    <div className='grid gap-2 sm:grid-cols-2'>
                                        <KeyValue label='Mode' value={latestDelivery.dryRun ? 'Dry run' : latestDelivery.httpStatus ? `HTTP ${latestDelivery.httpStatus}` : 'queued'} />
                                        <KeyValue label='Case link' value={caseRecord.id} mono />
                                    </div>
                                    {latestDelivery.error ? <p className='rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-2 text-ui-danger'>{latestDelivery.error}</p> : null}
                                </div>
                            ) : <EmptyLine text='No webhook delivery attempt is attached to this case.' />}
                            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                                <CommandLink href={destinationHref}>Manage destination</CommandLink>
                                <CommandLink href={deliveryHistoryHref}>Delivery history</CommandLink>
                            </div>
                            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                                <button type='button' onClick={() => sendWebhook(true)} disabled={readOnly || busy !== null || !(caseRecord.alertId || alertId)} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
                                    {busy === 'webhook-test' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RotateCcw className='h-4 w-4' />}Test
                                </button>
                                <button type='button' onClick={() => sendWebhook(false)} disabled={readOnly || busy !== null || !(caseRecord.alertId || alertId)} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                                    {busy === 'webhook-send' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}Send
                                </button>
                            </div>
                        </Panel>

                        <Panel title='Case export' action={state.exportPayload?.exportChecksum ? 'ready' : 'pending'}>
                            <div className='grid gap-2 text-xs text-ui-muted'>
                                <KeyValue label='Checksum' value={state.exportPayload?.exportChecksum || 'not available'} mono />
                                <KeyValue label='Dedupe' value={state.exportPayload?.summary?.dedupeKey || alert?.webhookDelivery?.dedupeKey || 'pending'} mono />
                                <button type='button' onClick={() => copyText(state.exportPayload?.copyText || '')} disabled={!state.exportPayload?.copyText} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
                                    <Copy className='h-4 w-4' />Copy summary
                                </button>
                            </div>
                        </Panel>
                    </aside>
                </div>
            </section>
        </main>
    )
}

function RouteHandoffStrip({ routeRun, detail, exportPayload, latestDelivery }: { routeRun: string, detail: CaseDetail, exportPayload?: CaseExport, latestDelivery?: DeliveryRow }) {
    const terms = matchedTerms(detail)
    const evidenceCount = detail.evidence?.length ?? exportPayload?.summary?.evidenceCount ?? 0
    const deliveryCount = detail.deliveries?.length ?? exportPayload?.summary?.deliveryCount ?? 0
    const label = routeRun === 'metadata_claim'
        ? 'Metadata intake'
        : routeRun === 'source_pack'
            ? 'Source pack review'
            : routeRun === 'alert_queue'
                ? 'Alert review'
                : 'Action handoff'
    const nextAction = deliveryCount ? 'Record decision' : latestDelivery ? 'Review delivery' : 'Test webhook'
    const cells = [
        { label: 'Action', value: label },
        { label: 'Match', value: terms[0] || detail.alert?.matchedTerm?.value || 'term pending' },
        { label: 'Evidence', value: `${evidenceCount} rows` },
        { label: 'Delivery', value: latestDelivery?.status ? stateLabel(latestDelivery.status) : deliveryCount ? `${deliveryCount} attempts` : 'not sent' },
        { label: 'Next', value: nextAction },
    ]

    return (
        <section data-dwm-case-route-handoff className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='grid gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Action handoff</p>
                    <h2 className='mt-1 text-sm font-semibold text-ui-text'>Case opened from {label.toLowerCase()}</h2>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Review the matched evidence, delivery state, and case decision before customer notification.</p>
                </div>
                <div className='grid grid-cols-2 gap-2 md:grid-cols-5'>
                    {cells.map(cell => (
                        <div key={cell.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2'>
                            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{cell.label}</p>
                            <p className='mt-1 truncate text-xs font-semibold text-ui-text' title={cell.value}>{cell.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function DecisionBrief({ detail, exportPayload, latestDelivery, actionDockHref, destinationHref, deliveryHistoryHref }: {
    detail: CaseDetail
    exportPayload?: CaseExport
    latestDelivery?: DeliveryRow
    actionDockHref: string
    destinationHref: string
    deliveryHistoryHref: string
}) {
    const evidenceCount = detail.evidence?.length ?? exportPayload?.summary?.evidenceCount ?? 0
    const deliveryCount = detail.deliveries?.length ?? exportPayload?.summary?.deliveryCount ?? 0
    const terms = matchedTerms(detail)
    const blockers = uniqueStrings([
        ...(detail.access?.blockerCodes ?? []),
        ...(detail.workflowActionPolicy?.summary?.blockerCodes ?? []),
        ...(detail.handoffActionReadiness?.blockers ?? []),
        ...(detail.customerNotificationContext?.blockers ?? []),
    ])
    const nextActions = detail.nextActions ?? []
    const primaryNext = nextActions.find(action => action.enabled !== false) ?? nextActions[0]
    const deliveryFailed = latestDelivery?.status === 'failed'
    const deliverySent = latestDelivery?.status === 'delivered' || detail.deliveryContext?.delivered
    const recommended = blockers.length
        ? 'Clear action blocker'
        : !evidenceCount
            ? 'Attach evidence'
            : deliveryFailed
                ? 'Fix destination'
                : !deliveryCount
                    ? 'Test delivery'
                    : deliverySent
                        ? 'Record decision'
                        : 'Review delivery'
    const recommendedDetail = primaryNext?.detail
        || (blockers.length ? blockers.map(stateLabel).join(', ') : undefined)
        || (deliveryFailed ? latestDelivery?.error || latestDelivery.errorClass || 'Delivery failed.' : undefined)
        || (!evidenceCount ? 'No evidence rows are attached to this case.' : undefined)
        || (deliveryCount ? `${deliveryCount} delivery attempt${deliveryCount === 1 ? '' : 's'} attached.` : 'No delivery attempt is attached yet.')
    const primaryHref = primaryNext?.route || (deliveryFailed ? destinationHref : !deliveryCount ? actionDockHref : deliveryHistoryHref)
    const sourceRefs = uniqueStrings([
        ...(detail.alert?.provenance?.sourceIds ?? []),
        ...(detail.alertContext?.provenance?.sourceIds ?? []),
    ])
    const captureRefs = uniqueStrings([
        ...(detail.alert?.provenance?.captureIds ?? []),
        ...(detail.alertContext?.provenance?.captureIds ?? []),
    ])

    return (
        <section data-dwm-case-decision-brief className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.58fr)]'>
            <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Decision brief</p>
                    {blockers.length ? <StatusDot state='blocked' /> : <StatusDot state={deliverySent ? 'ready' : 'action'} />}
                </div>
                <h2 className='mt-2 wrap-break-word text-base font-semibold text-ui-text'>{primaryNext?.label || recommended}</h2>
                <p className='mt-1 max-w-3xl wrap-break-word text-sm leading-6 text-ui-muted'>{recommendedDetail}</p>
                <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                    <DecisionFact label='Matched term' value={terms[0] || detail.alert?.matchedTerm?.value || 'term pending'} />
                    <DecisionFact label='Sources' value={sourceRefs.length ? `${sourceRefs.length} linked` : 'source pending'} title={sourceRefs.join(', ')} />
                    <DecisionFact label='Captures' value={captureRefs.length ? `${captureRefs.length} linked` : 'capture pending'} title={captureRefs.join(', ')} />
                </div>
            </div>
            <div className='grid min-w-0 content-start gap-2'>
                <CommandLink href={primaryHref}>{primaryNext?.label || recommended}</CommandLink>
                <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-1'>
                    <CommandLink href={actionDockHref}>Analyst actions</CommandLink>
                    <CommandLink href={deliveryHistoryHref}>Delivery history</CommandLink>
                </div>
                {blockers.length ? (
                    <div className='rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning'>
                        {blockers.slice(0, 3).map(stateLabel).join(', ')}
                    </div>
                ) : null}
            </div>
        </section>
    )
}

function DecisionFact({ label, value, title }: { label: string, value: string, title?: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 truncate text-xs font-semibold text-ui-text' title={title || value}>{value}</p>
        </div>
    )
}

function WorkflowStrip({ detail, exportPayload }: { detail: CaseDetail, exportPayload?: CaseExport }) {
    const terms = matchedTerms(detail)
    const evidenceCount = detail.evidence?.length ?? exportPayload?.summary?.evidenceCount ?? 0
    const deliveryCount = detail.deliveries?.length ?? exportPayload?.summary?.deliveryCount ?? 0
    const steps = [
        { label: 'Watchlist', value: terms[0] || 'term pending', state: terms.length ? 'ready' : 'blocked' },
        { label: 'Alert', value: detail.alert?.id || detail.case?.alertId || 'alert pending', state: detail.alert ? 'ready' : 'blocked' },
        { label: 'Case', value: detail.case?.status || 'open', state: 'ready' },
        { label: 'Evidence', value: `${evidenceCount} rows`, state: evidenceCount ? 'ready' : 'blocked' },
        { label: 'Webhook', value: deliveryCount ? `${deliveryCount} attempts` : 'not sent', state: detail.deliveryContext?.delivered ? 'ready' : deliveryCount ? 'action' : 'blocked' },
        { label: 'Audit', value: `${detail.timeline?.length || 0} events`, state: detail.timeline?.length ? 'ready' : 'action' },
    ] as Array<{ label: string, value: string, state: 'ready' | 'action' | 'blocked' }>
    return (
        <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 md:grid-cols-3 xl:grid-cols-6'>
            {steps.map((step, index) => (
                <div key={step.label} className='min-h-[104px] rounded-lg border border-ui-border bg-ui-canvas p-3'>
                    <div className='flex items-center justify-between gap-2'>
                        <span className='grid h-7 w-7 place-items-center rounded-full border border-ui-border text-xs font-semibold text-ui-text'>{index + 1}</span>
                        <StatusDot state={step.state} />
                    </div>
                    <p className='mt-3 text-[10px] font-semibold uppercase text-ui-muted'>{step.label}</p>
                    <p className='mt-1 truncate text-sm font-semibold text-ui-text' title={step.value}>{step.value}</p>
                </div>
            ))}
        </section>
    )
}

function CaseCommandBar({ caseId, tenantId, organizationId, alertId, exportReady, latestDelivery, readOnly }: {
    caseId: string
    tenantId: string
    organizationId?: string
    alertId?: string
    exportReady: boolean
    latestDelivery?: DeliveryRow
    readOnly: boolean
}) {
    const dashboardScope = queryString({ tenantId, organizationId, alert: alertId })
    const currentCaseHref = `/dashboard/dwm/cases/${encodeURIComponent(caseId)}${queryString({ tenantId, organizationId, alertId, route: 'case_detail' })}`
    const organizationHref = organizationId
        ? `/organizations${queryString({ organizationId, caseId, alertId, focus: alertId ? 'cases' : 'watchlists' })}`
        : '/organizations'
    const exportHref = `/api/cases/${encodeURIComponent(caseId)}/export${queryString({ tenantId, organizationId, alertId, shape: 'full' })}`
    const alertHref = alertId ? `/dashboard/dwm${queryString({ tenantId, organizationId, alert: alertId })}` : undefined
    const lastDelivery = latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTime(latestDelivery.attemptedAt)}` : 'not sent'

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='grid gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Case command</p>
                    <div className='mt-2 grid gap-2 text-xs sm:grid-cols-4'>
                        <CommandFact label='Scope' value={organizationId || tenantId} />
                        <CommandFact label='Alert' value={alertId || 'pending'} mono />
                        <CommandFact label='Export' value={exportReady ? 'ready' : 'pending'} tone={exportReady ? 'ready' : 'warn'} />
                        <CommandFact label='Delivery' value={lastDelivery} tone={latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
                    </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <CommandLink href={`/dashboard/dwm${dashboardScope}`}>Queue</CommandLink>
                    <CommandLink href={organizationHref}>Organization</CommandLink>
                    {alertHref ? <CommandLink href={alertHref}>Selected alert</CommandLink> : null}
                    <CommandLink href={exportHref}>{exportReady ? 'Export packet' : 'Check export'}</CommandLink>
                    {readOnly ? <span className='inline-flex h-9 items-center rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 text-xs font-semibold text-ui-warning'>Read only</span> : null}
                    <CommandLink href={currentCaseHref}>Current case</CommandLink>
                </div>
            </div>
        </section>
    )
}

function CommandFact({ label, value, mono = false, tone = 'neutral' }: { label: string, value: string, mono?: boolean, tone?: 'ready' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'ready' ? 'text-ui-success' : tone === 'warn' ? 'text-ui-warning' : 'text-ui-text'
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`${mono ? 'font-mono text-[11px]' : 'text-xs'} mt-1 truncate font-semibold ${toneClass}`} title={value}>{value}</p>
        </div>
    )
}

function CommandLink({ href, children }: { href: string, children: ReactNode }) {
    const className = 'inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'
    if (href.startsWith('/api/')) {
        return (
            <a href={href} className={className}>
                {children}
            </a>
        )
    }

    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    )
}

function Panel({ title, action, children }: { title: string, action?: string, children: ReactNode }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='mb-3 flex items-center justify-between gap-3'>
                <h2 className='text-sm font-semibold text-ui-text'>{title}</h2>
                {action ? <span className='rounded-full border border-ui-border bg-ui-canvas px-2 py-0.5 text-[10px] font-semibold uppercase text-ui-primary'>{action}</span> : null}
            </div>
            {children}
        </section>
    )
}

function CollapsiblePanel({ title, action, children, defaultOpen = false }: { title: string, action?: string, children: ReactNode, defaultOpen?: boolean }) {
    return (
        <details className='group rounded-lg border border-ui-border bg-ui-panel' open={defaultOpen}>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden'>
                <div className='min-w-0'>
                    <h2 className='text-sm font-semibold text-ui-text'>{title}</h2>
                    <p className='mt-1 text-xs text-ui-muted group-open:hidden'>Expand to inspect the attached rows.</p>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                    {action ? <span className='rounded-full border border-ui-border bg-ui-canvas px-2 py-0.5 text-[10px] font-semibold uppercase text-ui-primary'>{action}</span> : null}
                    <span className='grid h-7 w-7 place-items-center rounded-lg border border-ui-border bg-ui-canvas text-xs font-semibold text-ui-muted group-open:rotate-45'>+</span>
                </div>
            </summary>
            <div className='border-t border-ui-border p-3'>
                {children}
            </div>
        </details>
    )
}

function Metric({ label, value, detail }: { label: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-xl font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 truncate text-xs text-ui-muted' title={detail}>{detail}</p>
        </div>
    )
}

function safeCaseEvidenceExcerpt(row: EvidenceRow) {
    return safeEvidenceExcerpt(row.safeExcerpt || row.excerpt || 'No safe excerpt available.')
}

function orderCaseDeliveries(rows: DeliveryRow[]) {
    return [...rows].sort((first, second) => String(second.attemptedAt || '').localeCompare(String(first.attemptedAt || '')))
}

function EvidenceMobileRow({ row }: { row: EvidenceRow }) {
    const captureId = row.provenance?.captureId || row.id || 'capture pending'
    const contentHash = row.contentHash || row.provenance?.contentHash || 'hash pending'
    return (
        <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 text-xs' data-dwm-case-evidence-mobile-row='true'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-ui-text'>{row.sourceName || row.provenance?.sourceId || 'source pending'}</p>
                    <p className='mt-1 truncate text-ui-muted'>{stateLabel(row.sourceFamily)}</p>
                </div>
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-canvas px-2 py-1 font-semibold text-ui-muted'>{relativeTime(row.observedAt || row.collectedAt)}</span>
            </div>
            <p className='wrap-break-word rounded-md bg-ui-canvas px-3 py-2 leading-5 text-ui-text'>{safeCaseEvidenceExcerpt(row)}</p>
            <div className='grid gap-1 font-mono text-[11px] text-ui-muted'>
                <span className='truncate'>Capture: {captureId}</span>
                <span className='truncate'>Hash: {contentHash}</span>
            </div>
        </article>
    )
}

function TimelineItem({ row, compact = false }: { row: TimelineRow, compact?: boolean }) {
    const when = row.timestamp || row.at
    if (compact) {
        return (
            <div className='rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs'>
                <div className='flex items-start justify-between gap-3'>
                    <p className='font-semibold text-ui-text'>{stateLabel(row.action || row.eventType)}</p>
                    <p className='shrink-0 text-ui-muted'>{relativeTime(when)}</p>
                </div>
                <p className='mt-1 wrap-break-word leading-5 text-ui-muted'>{row.rationale || row.note || row.source || 'Case event recorded.'}</p>
                <p className='mt-2 font-mono text-[11px] text-ui-muted'>{row.actor || 'system'}{row.workflow?.toStatus ? ` · ${stateLabel(row.workflow.toStatus)}` : ''}</p>
            </div>
        )
    }

    return (
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs md:grid-cols-[160px_minmax(0,1fr)_180px]'>
            <div className='text-ui-muted'>{relativeTime(when)}</div>
            <div className='min-w-0'>
                <p className='font-semibold text-ui-text'>{stateLabel(row.action || row.eventType)}</p>
                <p className='mt-1 wrap-break-word leading-5 text-ui-muted'>{row.rationale || row.note || row.source || 'Case event recorded.'}</p>
            </div>
            <div className='font-mono text-[11px] text-ui-muted'>{row.actor || 'system'}{row.workflow?.toStatus ? <p>{stateLabel(row.workflow.toStatus)}</p> : null}</div>
        </div>
    )
}

function ActionButton({ action, busy, disabled, onClick }: { action: CaseAction, busy: boolean, disabled: boolean, onClick: () => void }) {
    const Icon = busy ? Loader2 : action.id === 'reopen' ? RotateCcw : action.id === 'close' ? CheckCircle2 : action.id.includes('false') || action.id === 'suppress' ? XCircle : action.id === 'assign' ? UserRound : ShieldCheck
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={action.disabledReason} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-50'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{actionLabel(action.id)}
        </button>
    )
}

function CasePill({ label, value, tone }: { label: string, value: string, tone: 'ready' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'ready' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : tone === 'warn' ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning' : 'border-ui-border bg-ui-panel text-ui-text'
    return <div className={`rounded-lg border px-3 py-2 ${toneClass}`}><p className='text-[10px] font-semibold uppercase opacity-80'>{label}</p><p className='text-sm font-semibold'>{stateLabel(value)}</p></div>
}

function StatusDot({ state }: { state: 'ready' | 'action' | 'blocked' }) {
    const toneClass = state === 'ready' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : state === 'action' ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning' : 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClass}`}>{state}</span>
}

function KeyValue({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) {
    return <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-canvas p-2'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p><p className={`${mono ? 'font-mono text-[11px]' : 'text-xs'} wrap-break-word text-ui-text`}>{value}</p></div>
}

function EmptyLine({ text }: { text: string }) {
    return <div className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>{text}</div>
}

function queryString(params: Record<string, string | undefined>) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    const rendered = query.toString()
    return rendered ? `?${rendered}` : ''
}

function matchedTerms(detail: CaseDetail) {
    const terms = detail.watchlists?.flatMap(watchlist => watchlist.matchedTerms?.map(term => term.value).filter(Boolean) || []) || []
    const matched = detail.alert?.matchedTerm?.value
    return uniqueStrings([matched, ...terms])
}

function resolvedTenantId(caseRecord: CaseDetail['case'] | undefined, fallback?: string) {
    return caseRecord?.tenantId || fallback || 'default'
}

function resolvedOrganizationId(caseRecord: CaseDetail['case'] | undefined, fallback?: string) {
    return caseRecord?.organizationId || fallback
}

function resolvedAlertId(caseRecord: CaseDetail['case'] | undefined, alertContext: CaseDetail['alertContext'] | undefined, fallback?: string) {
    return caseRecord?.alertId || alertContext?.id || fallback
}

function hashList(values: Array<string | undefined>) {
    return uniqueStrings(values).map(value => value.length > 14 ? `${value.slice(0, 14)}...` : value)
}

function uniqueStrings(values: Array<string | undefined>) {
    return [...new Set(values.map(value => value?.trim()).filter(Boolean) as string[])]
}

function relativeTime(value?: string) {
    if (!value) return 'time pending'
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) return value
    const diff = Date.now() - time
    const abs = Math.abs(diff)
    const units: Array<[number, string]> = [[86_400_000, 'd'], [3_600_000, 'h'], [60_000, 'm']]
    for (const [size, label] of units) {
        if (abs >= size) return `${Math.round(diff / size)}${label} ago`
    }
    return 'just now'
}

function stateLabel(value?: string) {
    return (value || 'pending').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function actionLabel(value: string) {
    if (value === 'false_positive') return 'False positive'
    return stateLabel(value)
}

async function copyText(value: string) {
    if (!value) return
    await navigator.clipboard?.writeText(value).catch(() => undefined)
}
