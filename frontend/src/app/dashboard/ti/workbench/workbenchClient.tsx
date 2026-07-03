'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Activity, AlertTriangle, Clock3, ExternalLink, Filter, Inbox, MessageSquareText, Search, ShieldCheck, UserRound } from 'lucide-react'

export type WorkbenchEvidence = {
    id: string
    sourceName: string
    sourceFamily: string
    captureMode: string
    redactionState: string
    contentHash: string
    excerpt: string
    observedAt?: string
    provenance?: string
    confidence?: number
    metadata?: Array<{ label: string, value: string }>
}

function sanitizeWorkbenchCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(/hanasand-live-status-\d+/gi, 'Hanasand live org')
        .replace(/hanasand-live-status/gi, 'Hanasand live org')
        .replace(/generation status/gi, 'generation status')
        .replace(/alertability status/gi, 'alertability status')
        .replace(/customer workflow status/gi, 'customer workflow status')
        .replace(/worker status/gi, 'worker status')
        .replace(/audit status/gi, 'audit trail')
        .replace(/status/gi, 'status')
        .replace(/readiness/gi, 'status')
        .replace(/receipt delivery/gi, 'delivery history')
        .replace(/receipt/gi, 'delivery')
}

export type WorkbenchTimelineItem = {
    id: string
    at: string
    title: string
    body: string
}

export type WorkbenchWorkflowStep = {
    id: string
    label: string
    status: 'ready' | 'needs_action' | 'blocked'
    owner: string
    source: string
    detail: string
    entityId?: string
    href?: string
}

export type WorkbenchAction = {
    id: string
    label: string
    method: 'GET' | 'POST' | 'PATCH'
    href: string
    body?: Record<string, unknown>
    disabledReason?: string
}

export type WorkbenchHandoffAction = 'create_watchlist' | 'rebuild_alerts' | 'open_case' | 'queue_enrichment'

type WorkbenchPublicTiActionReadiness = {
    action: WorkbenchHandoffAction
    route?: string
    endpoint?: string
    backedRoute?: string
    ready: boolean
    missing: string[]
    blockerCodes: string[]
    ownerLane: 'org' | 'alert' | 'case' | 'source'
    selected: boolean
    sourceRequestCount: number
}

export type WorkbenchHandoffPayload = {
    schemaVersion?: string
    query?: string
    generatedAt?: string
    route?: string
    method?: 'POST'
    endpoint?: string
    backedRoute?: string
    blocked?: boolean
    missing?: string[]
    body?: Record<string, unknown>
    provenance?: Array<{ sourceName?: string, provenance?: string, captureId?: string, confidence?: number }>
}

export type WorkbenchPublicTiHandoff = {
    decodeStatus: 'ready' | 'blocked'
    decodeError?: string
    action?: WorkbenchHandoffAction
    artifactId?: string
    query?: string
    generatedAt?: string
    orgRequired?: boolean
    sourceRequired?: boolean
    stale?: boolean
    missing: string[]
    blockers: Array<{ code: string, detail: string }>
    sourceRequests: Array<{ sourceName: string, provenance: string, captureId?: string, confidence?: number, missing: string[] }>
    artifact?: {
        id?: string
        kind?: string
        label?: string
        confidence?: number
        freshness?: string
        evidence?: string[]
        provenance?: string[]
        watchlistTerms?: Array<{ kind?: string, value?: string, notes?: string }>
        enrichmentTasks?: string[]
        readiness?: { state?: string, label?: string, blockers?: string[] }
    }
    selectedPayload?: WorkbenchHandoffPayload
    actionPayloads?: {
        watchlist?: WorkbenchHandoffPayload
        alertRebuild?: WorkbenchHandoffPayload
        case?: WorkbenchHandoffPayload
        enrichment?: WorkbenchHandoffPayload
    }
    actionReadiness?: WorkbenchPublicTiActionReadiness[]
}

export type WorkbenchCaseMutationAction = 'assign' | 'note' | 'review' | 'escalate' | 'suppress' | 'close' | 'reopen' | 'false_positive'

export type WorkbenchCaseMutationPayload = {
    action: WorkbenchCaseMutationAction
    actor: string
    note?: string
    assignedOwner?: string
    idempotencyKey?: string
}

export type WorkbenchInvitePayload = {
    email: string
    role: string
    invitedBy: string
}

export type WorkbenchWatchlistUpsertPayload = {
    id?: string
    organizationId?: string
    tenantId?: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    status?: string
    webhookDestinationId?: string
}

export type WorkbenchDeliveryEvidence = {
    id: string
    alertId: string
    status: string
    deliveryKind?: string
    attemptedAt: string
    webhookDestinationId?: string
    endpointHash: string
    payloadHash: string
    httpStatus?: number
    error?: string
}

export type WorkbenchKeyboardState = {
    selectedId: string
    focusedRegion: 'queue' | 'detail-actions'
    lastKey: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'ArrowRight' | 'Enter'
}

export type WorkbenchActionOutcome = {
    ok: boolean
    text: string
    source?: 'case_mutation' | 'dwm_action' | 'org_action' | 'watchlist_action' | 'session_local'
}

export type WorkbenchReadinessEvidenceState = {
    status: 'ready' | 'blocked'
    reason?: string
    webhookDestinationId?: string
    deliveryId?: string
    activeSourceCount?: number
    sourceCount?: number
}

export type WorkbenchProductReadinessItem = {
    id: string
    label: string
    status: 'ready' | 'needs_action' | 'blocked' | 'unavailable'
    detail: string
    source: string
    href?: string
    workflowBlocker?: string
    customerImpact?: string
    evidenceProvenance?: string
    actions?: WorkbenchAction[]
    checkedAt?: string
    blockerCount?: number
    deepLinkTarget?: string
    proofTimestamp?: string
    unavailableReason?: string
    staleAfterSeconds?: number
    expectedDashboardRowId?: string
    integrationProbeHint?: string
    backendProofContractVersion?: string
    ownerLane?: string
    operatorAction?: string
    caseId?: string
    alertId?: string
    caseStatus?: string
    assignedOwner?: string
    caseDetailHref?: string
    caseDetailReady?: boolean
    caseDetailTimelineCount?: number
    caseDetailReadOnly?: boolean
    candidateCount?: number
    captureRefCount?: number
    matchedCandidateCount?: number
    missingRouteCandidateCount?: number
    generationEvidenceWindowCaptureCount?: number
    generationEvidenceWindowSourceFamilies?: string[]
    latestEvidenceAt?: string
    organizationId?: string
    activeTermCount?: number
    pausedCount?: number
    archivedCount?: number
    canGenerateAlerts?: boolean
    exportedAt?: string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    latestDeliveryAt?: string
    latestAuditEventAt?: string
    deliveryProofLedgerSchemaVersion?: string
    deliveryProofLedgerSource?: string
    deliveryProofLedgerPath?: string
    workerStatus?: 'ready' | 'missing' | 'stale' | 'blocked' | 'unavailable'
    workerLastRunAt?: string
    queuedValidationJobs?: number
    validatingJobs?: number
    activeSourceRows?: number
    collectionReadyRows?: number
    registeredTotal?: number
    activeSourceCount?: number
    sourceFamilyCount?: number
    reviewQueueCount?: number
    sourcePackCount?: number
    catalogCandidates?: number
    netNewCandidates?: number
    duplicateCandidates?: number
    parserSourceFamilyCount?: number
    parserSourceFamilyNames?: string[]
    schemaLookupReady?: boolean
    schemaLookupSafe?: boolean
    contractLookupRows?: number
    receiptMatrixReady?: boolean
    receiptMatrixSafe?: boolean
    receiptMatrixRows?: number
    receiptMatrixBlockedRows?: number
    endToEndWorkflowStepCount?: number
    endToEndWorkflowReadyStepCount?: number
    endToEndWorkflowBlockedStepCount?: number
    endToEndWorkflowMissingFieldCount?: number
}

export type WorkbenchOrgContext = {
    scope: { tenantId: string, organizationId?: string }
    organization?: {
        id: string
        tenantId: string
        name: string
        slug: string
        status: string
        alertVisibilityPolicy?: 'members' | 'admins' | 'owners'
        updatedAt: string
    }
    members: Array<{ id: string, organizationId: string, email: string, role: string, status: string, userId?: string, updatedAt: string }>
    pendingInvites: Array<{ id: string, organizationId: string, email: string, role: string, status: string, expiresAt: string, updatedAt: string }>
    watchlists: Array<{ id: string, tenantId: string, organizationId?: string, name: string, terms: Array<{ value: string, kind?: string }>, webhookDestinationId?: string, status: string, updatedAt: string }>
    webhookDestinations: Array<{ id: string, organizationId: string, name: string, kind: string, status: string, lastTestStatus?: string, updatedAt: string }>
    readiness: {
        activeMemberCount: number
        pendingInviteCount: number
        activeWatchlistCount: number
        termCount: number
        activeWebhookCount: number
        alertVisibilityPolicy: 'members' | 'admins' | 'owners'
        blockedReasons: string[]
        liveAlertCount?: number
        sourceCoverage?: {
            sourceCount: number
            activeSourceCount: number
            captureCount: number
            watchlistMatchCount: number
            latestRunStatus?: string
            latestRunAt?: string
        }
        latestDelivery?: WorkbenchDeliveryEvidence
        fullChainReady: boolean
        fullChainBlockedBy: string[]
        productReadiness: WorkbenchProductReadinessItem[]
    }
    links: Array<{ href: string, label: string }>
    createWatchlistAction?: WorkbenchAction
}

export type WorkbenchCase = {
    id: string
    kind: 'dwm_alert' | 'ti_domain' | 'source_capture' | 'org_readiness' | 'watchlist_readiness' | 'webhook_readiness' | 'source_readiness' | 'alert_readiness' | 'support_readiness' | 'public_ti_handoff'
    queue: string
    title: string
    subtitle: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    priority: number
    confidence: number
    owner: string
    createdAt: string
    updatedAt: string
    company: string
    matchedTerm: string
    actor: string
    sourceLabel: string
    recommendedAction: string
    routeLabel: string
    persistent: boolean
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: Array<{ href: string, label: string }>
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    caseDetailHref?: string
    deliveryEvidence?: WorkbenchDeliveryEvidence[]
    missingDependency?: string
    handoff?: WorkbenchPublicTiHandoff
}

type QueueFilter = 'all' | 'critical' | 'high' | 'persistent' | 'evidence'

type AlertDetailState =
    | { status: 'loading' }
    | { status: 'error', error: string }
    | { status: 'ready', detail: AlertDetailPayload }

type AlertDetailPayload = {
    generatedAt?: string
    alert?: {
        id?: string
        reviewState?: string
        workflowStatus?: string
        deliveryState?: string
        assignedOwner?: string
        caseId?: string
        caseIdCandidate?: string
        organizationId?: string
        sourceCount?: number
        firstSeenAt?: string
        updatedAt?: string
        workflowContext?: {
            organizationId?: string
            caseIdCandidate?: string
            watchlistIds?: string[]
            webhookDestinationIds?: string[]
        }
        webhookContext?: {
            hasWebhookRoute?: boolean
            webhookDestinationIds?: string[]
            missingRouteCandidateCount?: number
        }
        evidence?: Array<{
            id?: string
            sourceName?: string
            sourceFamily?: string
            captureMode?: string
            redactionState?: string
            contentHash?: string
            excerpt?: string
            observedAt?: string
            firstSeenAt?: string
            provenance?: { sourceId?: string, captureId?: string, captureMode?: string } | string
        }>
        replayCount?: number
        lastReplayedAt?: string
    }
    workflowExecutionReadiness?: {
        schemaVersion?: string
        ready?: boolean
        action?: string
        currentWorkflowEventCount?: number
        expectedWorkflowEventCount?: number
        currentUpdatedAt?: string
        expectedUpdatedAt?: string
        idempotencyKey?: string
        blockerCodes?: string[]
        blockers?: Array<{ code?: string, field?: string, detail?: string, retryable?: boolean }>
        createdEventDispatch?: { ready?: boolean, eventId?: string, idempotencyKey?: string, blockerCodes?: string[] }
    }
    analystWorkflowContract?: {
        mutationRoute?: string
        replayRoute?: string
        idempotency?: { workflowEventCount?: number, updatedAt?: string, staleVersionBlocker?: string }
        current?: { status?: string, assignedOwner?: string, caseId?: string, casePath?: string, replayCount?: number }
    }
    downstreamHandoff?: {
        ready?: boolean
        blockerCodes?: string[]
        deliverySelection?: { ready?: boolean, selectedWebhookDestinationId?: string, blockerCodes?: string[] }
        customerStatus?: { ready?: boolean, blockerCodes?: string[] }
    }
    customerStatusHandoff?: {
        ready?: boolean
        blockerCodes?: string[]
        evidenceCount?: number
        deliveryReady?: boolean
        deliveryState?: string
        selectedCaptureIds?: string[]
    }
    nextBestAction?: {
        action?: string
        label?: string
        reason?: string
        requiresRationale?: boolean
        route?: string
        casePath?: string
        webhookReady?: boolean
    }
    deliveryReadiness?: {
        ready?: boolean
        state?: string
        blocker?: string | null
        blockerCodes?: string[]
        evidenceCount?: number
        lastDeliveryStatus?: string
        lastDeliveryAt?: string
        deliveryHistoryRefs?: string[]
        selectedCaptureIds?: string[]
    }
    evidenceFreshness?: {
        newestEvidenceAt?: string
        evidenceCount?: number
        sourceCount?: number
        sourceFamily?: string
        captureIds?: string[]
    }
    provenanceFreshness?: {
        matchBasis?: string
        captureIds?: string[]
        sourceIds?: string[]
    }
    timeline?: CaseTimelineItem[]
    error?: { message?: string }
}

type WorkbenchApiPayload = {
    error?: { message?: string }
    attemptedCount?: number
    savedAlertCount?: number
    testedAt?: string
    invites?: Array<{ id?: string, email?: string, role?: string }>
    deliveredAt?: string
    delivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
    deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
    deliveryEvidence?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    deliveryStatus?: {
        latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    deliveryProof?: {
        latestDelivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    testResult?: {
        delivery?: Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }
        deliveries?: Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean }>
    }
    alert?: { id?: string, replayCount?: number, lastReplayedAt?: string, updatedAt?: string }
    workflowExecutionReadiness?: { ready?: boolean, action?: string, blockerCodes?: string[] }
    downstreamHandoff?: { blockerCodes?: string[] }
    case?: { id?: string, status?: string, organizationId?: string }
    receipt?: { id?: string, deliveryMode?: string, webhookDeliveryId?: string }
    watchlist?: { id?: string, status?: string }
}

export default function AnalystWorkbenchClient({ initialCases, chrome = 'full', orgContext, initialSelectedId }: { initialCases: WorkbenchCase[], chrome?: 'full' | 'compact', orgContext?: WorkbenchOrgContext, initialSelectedId?: string }) {
    const router = useRouter()
    const compact = chrome === 'compact'
    const [selectedId, setSelectedId] = useState(() => initialCases.find(item => item.id === initialSelectedId)?.id ?? initialCases[0]?.id ?? '')
    const [filter, setFilter] = useState<QueueFilter>('all')
    const [query, setQuery] = useState('')
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({})
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('analyst')
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetailState>>({})
    const [alertDetails, setAlertDetails] = useState<Record<string, AlertDetailState>>({})
    const [actionDeliveries, setActionDeliveries] = useState<Record<string, WorkbenchDeliveryEvidence[]>>({})
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<WorkbenchActionOutcome | null>(null)
    const cases = useMemo(() => filterCases(initialCases, filter, query), [initialCases, filter, query])
    const selected = initialCases.find(item => item.id === selectedId) ?? cases[0] ?? initialCases[0]
    const queues = queueSummary(initialCases)
    const workbenchStats = useMemo(() => workbenchSummary(initialCases), [initialCases])
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedCaseDetail = selected ? caseDetails[selected.id] : undefined
    const selectedAlertDetail = selected ? alertDetails[selected.id] : undefined
    const selectedActionDeliveries = selected ? actionDeliveries[selected.id] || [] : []

    const focusQueueIndex = useCallback((nextIndex: number) => {
        const next = cases[nextIndex]
        if (!next) return
        setSelectedId(next.id)
        requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>(`[data-queue-index="${nextIndex}"]`)?.focus()
        })
    }, [cases])

    const focusDetailAction = useCallback(() => {
        requestAnimationFrame(() => {
            document.querySelector<HTMLButtonElement>('[data-detail-action]')?.focus()
        })
    }, [])

    const handleQueueKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (!cases.length) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            focusQueueIndex(Math.min(index + 1, cases.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            focusQueueIndex(Math.max(index - 1, 0))
        } else if (event.key === 'Home') {
            event.preventDefault()
            focusQueueIndex(0)
        } else if (event.key === 'End') {
            event.preventDefault()
            focusQueueIndex(cases.length - 1)
        } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
            event.preventDefault()
            const item = cases[index]
            if (item) setSelectedId(item.id)
            focusDetailAction()
        }
    }, [cases, focusDetailAction, focusQueueIndex])

    const refreshCaseDetail = useCallback(async (itemId: string, href: string, options: { loading?: boolean } = {}) => {
        if (options.loading !== false) setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        const response = await fetch(href, { cache: 'no-store' })
        const payload = await readCaseDetailJson(response)
        if (!response.ok) throw new Error(payload.error?.message || response.statusText)
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
        return payload
    }, [])

    const refreshAlertDetail = useCallback(async (itemId: string, options: { loading?: boolean } = {}) => {
        if (options.loading !== false) setAlertDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(itemId)}`, { cache: 'no-store' })
        const payload = await readAlertDetailJson(response)
        if (!response.ok) throw new Error(payload.error?.message || response.statusText)
        setAlertDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
        return payload
    }, [])

    useEffect(() => {
        if (!selected?.caseDetailHref) return
        let cancelled = false
        const itemId = selected.id
        const href = selected.caseDetailHref
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        fetch(href, { cache: 'no-store' })
            .then(async response => {
                const payload = await readCaseDetailJson(response)
                if (!response.ok) throw new Error(payload.error?.message || response.statusText)
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
            })
            .catch(error => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => {
            cancelled = true
        }
    }, [selected?.id, selected?.caseDetailHref])

    useEffect(() => {
        if (!selected || selected.kind !== 'dwm_alert' || !selected.persistent) return
        const currentDetail = alertDetails[selected.id]
        if (currentDetail?.status === 'ready' || currentDetail?.status === 'loading') return
        let cancelled = false
        const itemId = selected.id
        setAlertDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        refreshAlertDetail(itemId, { loading: false })
            .then(payload => {
                if (!cancelled) setAlertDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
            })
            .catch(error => {
                if (!cancelled) setAlertDetails(current => ({ ...current, [itemId]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => {
            cancelled = true
        }
    }, [alertDetails, refreshAlertDetail, selected])

    useEffect(() => {
        if (!selected || selected.caseDetailHref || selected.kind !== 'dwm_alert') return
        const alertDetail = alertDetails[selected.id]
        if (alertDetail?.status !== 'ready') return
        const href = caseDetailHrefFromAlertDetail(alertDetail.detail, orgContext)
        if (!href) return
        const currentCaseDetail = caseDetails[selected.id]
        if (currentCaseDetail?.status === 'ready' || currentCaseDetail?.status === 'loading') return
        let cancelled = false
        refreshCaseDetail(selected.id, href)
            .catch(error => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [selected.id]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => {
            cancelled = true
        }
    }, [alertDetails, caseDetails, orgContext, refreshCaseDetail, selected])

    async function refreshBackedSelection(item: WorkbenchCase, payload?: WorkbenchApiPayload, action?: WorkbenchAction) {
        const alertDetail = item.kind === 'dwm_alert' && item.persistent ? await refreshAlertDetail(item.id, { loading: false }) : undefined
        const deliveryEvidence = deliveryEvidenceFromPayload(payload, item.id)
        if (deliveryEvidence.length) {
            setActionDeliveries(current => ({
                ...current,
                [item.id]: mergeDeliveryEvidence(deliveryEvidence, current[item.id] || []),
            }))
        }
        const caseHref = item.caseDetailHref || caseDetailHrefFromPayload(payload, action, orgContext) || caseDetailHrefFromAlertDetail(alertDetail, orgContext)
        if (caseHref) await refreshCaseDetail(item.id, caseHref, { loading: false })
    }

    async function applyDecision(item: WorkbenchCase, decision: LocalDecision) {
        const nextDecision = {
            ...(localDecisions[item.id] ?? {}),
            ...decision,
            decidedAt: new Date().toISOString(),
        }

        const decisionStatus = decision.status
        if (item.kind !== 'dwm_alert' || (!decisionStatus && !decision.owner)) {
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return
        }

        await runPersistentAction(`decision:${item.id}`, async () => {
            const mapped: Partial<{ reviewState: string, deliveryState: string }> = decisionStatus ? mapDwmDecision(decisionStatus, item.status) : {}
            const currentAlertDetail = alertDetails[item.id]
            const mutationDetail = currentAlertDetail?.status === 'ready' ? currentAlertDetail.detail : undefined
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(item.id)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ...alertWorkflowMutationBody(item, mutationDetail, orgContext),
                    reviewState: mapped.reviewState,
                    deliveryState: mapped.deliveryState,
                    note: decision.reason || (decision.owner ? `Assigned to ${decision.owner}.` : 'Updated from recent attacks.'),
                    assignedOwner: decision.owner,
                    actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            await refreshBackedSelection(item, payload)
            return decisionStatus ? `${label(decisionStatus)} saved to the dark web case.` : 'Owner saved to the dark web case.'
        })
    }

    async function replayDwmAlert(item: WorkbenchCase) {
        await runPersistentAction(`replay:${item.id}`, async () => {
            const currentAlertDetail = alertDetails[item.id]
            const mutationDetail = currentAlertDetail?.status === 'ready' ? currentAlertDetail.detail : undefined
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(item.id)}/replay`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ...alertWorkflowMutationBody(item, mutationDetail, orgContext),
                    action: 'replay',
                    actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload)
            return alertReplayResultMessage(payload, item)
        })
    }

    async function sendDwmAlert(item: WorkbenchCase) {
        const disabledReason = sendDeliveryDisabledReason(item, orgContext)
        if (disabledReason) {
            setMessage({ ok: false, text: disabledReason })
            return
        }
        await runPersistentAction(`send:${item.id}`, async () => {
            const action = sendDeliveryActionFor(item)
            const response = await fetch(action?.href || '/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopedDeliveryActionBody(action?.body || { alertId: item.id, limit: 1 }, orgContext)),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload, action)
            return webhookDeliveryResultMessage(payload)
        })
    }

    async function runWorkbenchAction(item: WorkbenchCase, action: WorkbenchAction, note: string) {
        if (action.method === 'GET') return
        if (action.disabledReason) {
            setMessage({ ok: false, text: action.disabledReason })
            return
        }
        await runPersistentAction(`action:${item.id}:${action.id}`, async () => {
            const body = {
                ...scopedActionBody(action.body || {}, orgContext),
                note: note || action.body?.note,
                assignedOwner: localDecisions[item.id]?.owner,
                actor: 'dashboard',
            }
            const response = await fetch(action.href, {
                method: action.method,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshBackedSelection(item, payload, action)
            return actionResultMessage(action, payload)
        })
    }

    async function copyHandoffPayload(item: WorkbenchCase, payload?: unknown) {
        const target = payload || item.handoff || item.actions?.map(action => action.body).filter(Boolean)
        if (!target) {
            setMessage({ ok: false, text: 'Select an item with a handoff payload before copying.' })
            return
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(target, null, 2))
            setMessage({ ok: true, text: 'Exact handoff payload copied.', source: 'session_local' })
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : 'Unable to copy handoff payload.' })
        }
    }

    async function runBackedCaseMutation(item: WorkbenchCase, mutation: CaseMutationInput) {
        if (!item.caseDetailHref) {
            setMessage({ ok: false, text: item.missingDependency || 'Open or create the case before applying this workflow action.' })
            return
        }
        await runPersistentAction(`case:${item.id}:${mutation.action}`, async () => {
            const body: WorkbenchCaseMutationPayload = {
                action: mutation.action,
                actor: 'dashboard',
                note: mutation.note || undefined,
                assignedOwner: mutation.assignedOwner || undefined,
                idempotencyKey: caseMutationIdempotencyKey(item, mutation),
            }
            const response = await fetch(item.caseDetailHref as string, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshCaseDetail(item.id, item.caseDetailHref as string, { loading: false })
            setLocalDecisions(current => {
                const next = { ...current }
                delete next[item.id]
                return next
            })
            return caseMutationResultMessage(mutation.action, payload)
        })
    }

    async function recordCustomerNotification(item: WorkbenchCase, note: string, caseDetail?: CaseDetailState) {
        if (!item.caseDetailHref || caseDetail?.status !== 'ready') {
            setMessage({ ok: false, text: item.missingDependency || 'Open the case details before recording customer notification.' })
            return
        }
        const delivery = deliveredCaseDelivery(caseDetail.detail)
        if (!delivery) {
            setMessage({ ok: false, text: 'Send or verify a webhook delivery before recording customer notification.' })
            return
        }
        const rationale = note.trim()
        if (!rationale) {
            setMessage({ ok: false, text: 'Customer notification receipt requires decision rationale.' })
            return
        }
        await runPersistentAction(`case:${item.id}:customer_notification`, async () => {
            const response = await fetch(caseCustomerNotificationHref(item.caseDetailHref as string), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ...scopeBody(orgContext),
                    deliveryMode: 'webhook_delivery',
                    webhookDeliveryId: delivery.id,
                    rationale,
                    actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshCaseDetail(item.id, item.caseDetailHref as string, { loading: false })
            return payload.receipt?.id ? `Customer notification ${payload.receipt.id} recorded.` : 'Customer notification delivery recorded.'
        })
    }

    async function createSharedWatchlistTerm(item: WorkbenchCase) {
        const disabledReason = watchlistMutationDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) {
            setMessage({ ok: false, text: disabledReason })
            return
        }
        const term = suggestedWatchTerm(item)
        if (!term) {
            setMessage({ ok: false, text: 'Select a case term before creating a shared watchlist entry.' })
            return
        }
        if (!orgContext?.createWatchlistAction) {
            setMessage({ ok: false, text: orgContext?.readiness.blockedReasons[0] || 'Connect the organization watchlist service before saving shared terms.' })
            return
        }
        await runPersistentAction(`watchlist:${item.id}`, async () => {
            const body: WorkbenchWatchlistUpsertPayload = {
                ...(orgContext.createWatchlistAction?.body || {}),
                name: orgContext.organization ? `${orgContext.organization.name} shared exposure watchlist` : 'Shared exposure watchlist',
                terms: [{ value: term, kind: inferTermKind(term) }],
                status: 'active',
            }
            const response = await fetch(orgContext.createWatchlistAction?.href || '/api/dwm/watchlists', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.watchlist?.id ? `Shared watchlist ${payload.watchlist.id} now covers ${term}.` : `Shared watchlist term ${term} saved.`
        })
    }

    async function inviteOrganizationMember() {
        const disabledReason = orgInviteDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) {
            setMessage({ ok: false, text: disabledReason })
            return
        }
        const organizationId = orgContext?.organization?.id
        if (!organizationId) {
            setMessage({ ok: false, text: 'Select an organization before inviting a teammate.' })
            return
        }
        if (!inviteEmail.trim()) {
            setMessage({ ok: false, text: 'Invite requires an email address.' })
            return
        }
        await runPersistentAction('org:invite', async () => {
            const body: WorkbenchInvitePayload = { email: inviteEmail.trim(), role: inviteRole, invitedBy: 'dashboard' }
            const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/invites`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setInviteEmail('')
            return payload.invites?.length ? `Invited ${payload.invites.length} teammate${payload.invites.length === 1 ? '' : 's'}.` : 'Invite queued.'
        })
    }

    async function upsertWatchlist(input: { watchlist: WorkbenchOrgContext['watchlists'][number], terms?: Array<{ value: string, kind?: string }>, status?: string }) {
        const disabledReason = watchlistMutationDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) {
            setMessage({ ok: false, text: disabledReason })
            return
        }
        await runPersistentAction(`watchlist:update:${input.watchlist.id}`, async () => {
            const body: WorkbenchWatchlistUpsertPayload = {
                ...scopeBody(orgContext),
                id: input.watchlist.id,
                name: input.watchlist.name,
                terms: input.terms || input.watchlist.terms,
                status: input.status || input.watchlist.status,
                webhookDestinationId: input.watchlist.webhookDestinationId,
            }
            const response = await fetch('/api/dwm/watchlists', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.watchlist?.id ? `Watchlist ${payload.watchlist.id} updated.` : 'Watchlist updated.'
        })
    }

    async function runPersistentAction(key: string, action: () => Promise<string>) {
        if (busyAction) return
        setBusyAction(key)
        setMessage(null)
        try {
            const text = await action()
            setMessage({ ok: true, text })
            router.refresh()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className='grid gap-3'>
            {message && (
                <p className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]' : 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'}`}>
                    {message.text}
                </p>
            )}

            <div className='min-w-0 overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='grid gap-2 border-b border-[#26344d] bg-[#0b111c] p-3 sm:grid-cols-2 xl:grid-cols-5'>
                    <WorkbenchStat icon={<Inbox className='h-4 w-4' />} label='Open cases' value={String(workbenchStats.total)} detail={`${workbenchStats.review} awaiting analyst`} tone='neutral' />
                    <WorkbenchStat icon={<AlertTriangle className='h-4 w-4' />} label='High priority' value={String(workbenchStats.highPriority)} detail='critical or high severity' tone={workbenchStats.highPriority ? 'warn' : 'good'} />
                    <WorkbenchStat icon={<ShieldCheck className='h-4 w-4' />} label='Customer-ready' value={String(workbenchStats.persistent)} detail='saved alert workflows' tone={workbenchStats.persistent ? 'good' : 'neutral'} />
                    <WorkbenchStat icon={<Activity className='h-4 w-4' />} label='Evidence' value={String(workbenchStats.evidence)} detail='cases with captured material' tone={workbenchStats.evidence ? 'good' : 'neutral'} />
                    <WorkbenchStat icon={<Clock3 className='h-4 w-4' />} label='Newest update' value={workbenchStats.latest} detail='latest case refresh' tone='neutral' />
                </div>

                <div className={`grid min-w-0 ${compact ? 'min-h-[480px] xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_300px]' : 'min-h-[480px] xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_330px]'}`}>
                    <aside className='min-w-0 border-b border-[#26344d] bg-[#0d1522] xl:border-b-0 xl:border-r'>
                        <div className='grid gap-3 border-b border-[#26344d] p-4'>
                            <label className='relative block'>
                                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71819a]' />
                                <input
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder='Search cases, actors, domains'
                                    className='h-10 w-full rounded-lg border border-[#27364f] bg-[#080e18] pl-9 pr-3 text-sm text-[#e8eefc] outline-none transition placeholder:text-[#6e7d92] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                                />
                            </label>
                            <div className='flex flex-wrap gap-2'>
                                {(['all', 'critical', 'high', 'persistent', 'evidence'] as QueueFilter[]).map(item => (
                                    <button
                                        key={item}
                                        type='button'
                                        onClick={() => setFilter(item)}
                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${filter === item ? 'border-[#7aa5ff] bg-[#15284b] text-[#dbe7ff]' : 'border-[#27364f] bg-[#0b121e] text-[#aab7cc] hover:border-[#3c5072] hover:bg-[#101a2a]'}`}
                                    >
                                        {item === 'all' ? <Filter className='h-3.5 w-3.5' /> : null}
                                        {label(item)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={`${compact ? 'xl:max-h-[calc(100vh-250px)]' : 'xl:max-h-[620px]'} overflow-visible p-2 xl:overflow-auto`}>
                            <div role='listbox' aria-label='Analyst case list' className='grid gap-1'>
                                {cases.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type='button'
                                        role='option'
                                        aria-selected={selected?.id === item.id}
                                        data-queue-case-id={item.id}
                                        data-queue-index={index}
                                        onClick={() => setSelectedId(item.id)}
                                        onKeyDown={event => handleQueueKeyDown(event, index)}
                                        className={`w-full min-w-0 rounded-lg border p-3 text-left transition ${selected?.id === item.id ? 'border-[#4d7cff] bg-[#101d33] shadow-sm shadow-black/20' : 'border-transparent bg-[#0b121e] hover:border-[#27364f] hover:bg-[#101827]'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className='truncate text-sm font-semibold text-[#edf4ff]'>{item.title}</span>
                                            <span className={severityClass(item.severity)}>{item.severity}</span>
                                        </div>
                                        <p className='mt-1 truncate text-xs text-[#8fa0ba]'>{item.queue} · {ownerLabel(item.owner)}</p>
                                        <p className='mt-2 line-clamp-2 wrap-break-word text-xs leading-5 text-[#aab7cc]'>{item.subtitle}</p>
                                        <div className='mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#8fa0ba]'>
                                            <span className='rounded-full border border-[#27364f] bg-[#080e18] px-2 py-0.5 text-[#cbd8ec]'>{label(item.status)}</span>
                                            <span>{item.confidence}%</span>
                                            <span>{relativeTime(item.updatedAt)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {!cases.length && <p className='rounded-lg border border-dashed border-[#31415c] bg-[#0b121e] p-4 text-sm text-[#aab7cc]'>Case state is updating for this filter.</p>}
                        </div>
                    </aside>

                    <main className='min-w-0'>
                        {selected ? (
                            <CaseDetail
                                item={selected}
                                decision={selectedDecision}
                                note={notes[selected.id] ?? ''}
                                ownerDraft={ownerDrafts[selected.id]}
                                busyAction={busyAction}
                                compact={compact}
                                caseDetail={selectedCaseDetail}
                                alertDetail={selectedAlertDetail}
                                actionDeliveries={selectedActionDeliveries}
                                orgContext={orgContext}
                                actionMessage={message}
                                onNoteChange={value => setNotes(current => ({ ...current, [selected.id]: value }))}
                                onOwnerDraftChange={value => setOwnerDrafts(current => ({ ...current, [selected.id]: value }))}
                                onDecision={(decision) => applyDecision(selected, decision)}
                                onBackedCaseMutation={(mutation) => runBackedCaseMutation(selected, mutation)}
                                onCustomerNotification={() => recordCustomerNotification(selected, notes[selected.id] ?? '', selectedCaseDetail)}
                                onReplay={() => replayDwmAlert(selected)}
                                onSend={() => sendDwmAlert(selected)}
                            />
                        ) : (
                            <EmptyWorkspace />
                        )}
                    </main>

                    <aside className='min-w-0 border-t border-[#26344d] bg-[#0d1522] xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <OrgOperatingPanel
                                orgContext={orgContext}
                                selected={selected}
                                caseDetail={selectedCaseDetail}
                                actionDeliveries={selectedActionDeliveries}
                                busyAction={busyAction}
                                inviteEmail={inviteEmail}
                                inviteRole={inviteRole}
                                onInviteEmailChange={setInviteEmail}
                                onInviteRoleChange={setInviteRole}
                                onInvite={inviteOrganizationMember}
                                onCreateSharedWatchlistTerm={() => selected && createSharedWatchlistTerm(selected)}
                                onUpdateWatchlist={upsertWatchlist}
                            />

                            <OperatorActionRail
                                selected={selected}
                                orgContext={orgContext}
                                caseDetail={selectedCaseDetail}
                                alertDetail={selectedAlertDetail}
                                actionDeliveries={selectedActionDeliveries}
                                note={notes[selected.id] ?? ''}
                                busyAction={busyAction}
                                onRunAction={(action) => selected && runWorkbenchAction(selected, action, notes[selected.id] ?? '')}
                                onCustomerNotification={() => recordCustomerNotification(selected, notes[selected.id] ?? '', selectedCaseDetail)}
                                onCopyPayload={(payload) => selected && copyHandoffPayload(selected, payload)}
                            />

                            <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
                                <div className='border-b border-[#26344d] px-4 py-3'>
                                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Case groups and links</h3>
                                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Current case group and related routes for the selected item.</p>
                                </div>
                                <div className='grid gap-2 border-b border-[#26344d] p-3'>
                                    {queues.map(queue => (
                                        <div key={queue.name} className='flex items-center justify-between gap-3 rounded-lg border border-[#27364f] bg-[#0b121e] px-3 py-2 text-xs'>
                                            <span className='font-semibold text-[#edf4ff]'>{queue.name}</span>
                                            <span className='text-[#8fa0ba]'>{queue.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className='grid gap-2 p-3'>
                                    {selected?.relatedLinks.map(link => (
                                        <Link key={link.href} href={link.href} className='inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#101a2a]'>
                                            {link.label}
                                            <ExternalLink className='h-3.5 w-3.5' />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

function OrgOperatingPanel({ orgContext, selected, caseDetail, actionDeliveries, busyAction, inviteEmail, inviteRole, onInviteEmailChange, onInviteRoleChange, onInvite, onCreateSharedWatchlistTerm, onUpdateWatchlist }: {
    orgContext?: WorkbenchOrgContext
    selected?: WorkbenchCase
    caseDetail?: CaseDetailState
    actionDeliveries: WorkbenchDeliveryEvidence[]
    busyAction: string | null
    inviteEmail: string
    inviteRole: string
    onInviteEmailChange: (value: string) => void
    onInviteRoleChange: (value: string) => void
    onInvite: () => void | Promise<void>
    onCreateSharedWatchlistTerm: () => void | Promise<void>
    onUpdateWatchlist: (input: { watchlist: WorkbenchOrgContext['watchlists'][number], terms?: Array<{ value: string, kind?: string }>, status?: string }) => void | Promise<void>
}) {
    const term = selected ? suggestedWatchTerm(selected) : ''
    const termCoverage = term ? watchlistCoverage(orgContext, term) : undefined
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    const visibility = access?.visibilityDecision
    const inviteBlockedReason = orgInviteDisabledReason(orgContext, caseDetail)
    const blockedReason = !orgContext
        ? 'Organization operating context is syncing to this console.'
        : orgContext.readiness.blockedReasons[0]
    const watchlistBlockedReason = watchlistMutationDisabledReason(orgContext, caseDetail)
    const canCreateTerm = Boolean(orgContext?.createWatchlistAction && term && !termCoverage?.covered && !watchlistBlockedReason)
    const activeWatchlists = (orgContext?.watchlists || []).filter(item => item.status === 'active')

    return (
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='border-b border-[#26344d] px-4 py-3'>
                <h3 className='text-sm font-semibold text-[#edf4ff]'>Org and shared watchlist</h3>
                <p className='mt-0.5 text-xs text-[#8fa0ba]'>Member access, watch terms, and customer visibility for the selected case.</p>
            </div>
            <div className='grid gap-3 p-3'>
                <div className='grid gap-2 text-xs'>
                    <OperatorRow label='Org' value={orgContext?.organization ? `${orgContext.organization.name} · ${orgContext.organization.id}` : 'syncing'} tone={orgContext?.organization ? 'ready' : 'blocked'} />
                    <OperatorRow label='Members' value={`${orgContext?.readiness.activeMemberCount ?? 0} active · ${orgContext?.readiness.pendingInviteCount ?? 0} pending`} tone={orgContext?.readiness.activeMemberCount ? 'ready' : 'blocked'} />
                    <OperatorRow label='Watchlists' value={`${orgContext?.readiness.activeWatchlistCount ?? 0} active · ${orgContext?.readiness.termCount ?? 0} terms`} tone={orgContext?.readiness.activeWatchlistCount ? 'ready' : 'needs_action'} />
                    <OperatorReadinessRows orgContext={orgContext} selected={selected} caseDetail={caseDetail} actionDeliveries={actionDeliveries} />
                    <OperatorRow label='Visibility' value={visibility ? `${visibility.alertVisibilityPolicy} · ${visibility.allowed ? 'visible' : visibility.reason || 'syncing'}` : `${orgContext?.readiness.alertVisibilityPolicy || 'members'} policy`} tone={visibility?.allowed === false ? 'blocked' : 'ready'} />
                    <OperatorRow label='Case role' value={access?.role ? `${access.role}${access.readOnly ? ' · read only' : ' · can edit'}` : 'checking case access'} tone={access ? access.readOnly ? 'needs_action' : 'ready' : 'needs_action'} />
                </div>

                <ProductReadinessPanel orgContext={orgContext} />

                {blockedReason && (
                    <InspectionNotice tone='blocked' title='Syncing' body={blockedReason} />
                )}

                <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Team invite</p>
                            <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>Add analysts to the active customer case.</p>
                        </div>
                        <span className={workflowStatusClass(inviteBlockedReason ? 'blocked' : 'ready')}>{inviteBlockedReason ? 'syncing' : 'ready'}</span>
                    </div>
                    <div className='mt-3 grid gap-2'>
                        <input
                            value={inviteEmail}
                            onChange={event => onInviteEmailChange(event.target.value)}
                            disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                            placeholder='analyst@example.com'
                            className='h-9 rounded-lg border border-[#27364f] bg-[#080e18] px-3 text-xs text-[#e8eefc] outline-none transition placeholder:text-[#6e7d92] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                        />
                        <div className='flex gap-2'>
                            <select
                                value={inviteRole}
                                onChange={event => onInviteRoleChange(event.target.value)}
                                disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                                className='h-9 min-w-0 flex-1 rounded-lg border border-[#27364f] bg-[#080e18] px-2 text-xs font-semibold text-[#dbe7ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <option value='analyst'>Analyst</option>
                                <option value='admin'>Admin</option>
                                <option value='viewer'>Viewer</option>
                            </select>
                            <button
                                type='button'
                                disabled={Boolean(inviteBlockedReason) || Boolean(busyAction)}
                                title={inviteBlockedReason || undefined}
                                onClick={onInvite}
                                className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {busyAction === 'org:invite' ? 'Inviting...' : 'Invite'}
                            </button>
                        </div>
                    </div>
                    {inviteBlockedReason && <p className='mt-2 text-xs leading-5 text-[#ffb598]'>{inviteBlockedReason}</p>}
                    {orgContext?.pendingInvites.length ? (
                        <div className='mt-3 grid gap-1'>
                            {orgContext.pendingInvites.slice(0, 4).map(invite => (
                                <p key={invite.id} className='truncate text-xs text-[#8fa0ba]'>{invite.email} · {invite.role} · expires {formatDateTime(invite.expiresAt)}</p>
                            ))}
                        </div>
                    ) : <p className='mt-3 text-xs text-[#8fa0ba]'>Invite state is updating.</p>}
                </div>

                <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Active members</p>
                            <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>Assignable people for this case.</p>
                        </div>
                        <span className={workflowStatusClass(orgContext?.members.length ? 'ready' : 'blocked')}>{orgContext?.members.length ? 'active' : 'syncing'}</span>
                    </div>
                    <div className='mt-3 grid gap-1'>
                        {(orgContext?.members || []).filter(member => member.status === 'active').slice(0, 5).map(member => (
                            <p key={member.id} className='truncate text-xs text-[#8fa0ba]'>{member.email} · {member.role}</p>
                        ))}
                        {!orgContext?.members.length && <p className='text-xs text-[#8fa0ba]'>Teammate state is loading; manual owner text stays available.</p>}
                    </div>
                </div>

                <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Selected term</p>
                            <p className='mt-1 break-all text-sm font-semibold text-[#edf4ff]'>{term || 'Term syncing'}</p>
                        </div>
                        <span className={workflowStatusClass(termCoverage?.covered ? 'ready' : canCreateTerm ? 'needs_action' : 'blocked')}>
                            {termCoverage?.covered ? 'covered' : canCreateTerm ? 'ready' : 'syncing'}
                        </span>
                    </div>
                    <p className='mt-2 text-xs leading-5 text-[#aab7cc]'>
                        {termCoverage?.covered
                            ? `${term} is already in ${termCoverage.watchlistName}.`
                            : canCreateTerm
                                ? 'Create an active shared watchlist for this organization.'
                                : term ? 'Connect the organization watchlist before saving this term.' : 'Select a case with a matched term or evidence artifact before creating a shared watchlist entry.'}
                    </p>
                    <button
                        type='button'
                        disabled={!canCreateTerm || Boolean(busyAction)}
                        title={!canCreateTerm ? watchlistBlockedReason || blockedReason || 'Term is already covered or organization context is syncing.' : undefined}
                        onClick={onCreateSharedWatchlistTerm}
                        className='mt-3 inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        {busyAction === `watchlist:${selected?.id}` ? 'Saving...' : 'Create shared term'}
                    </button>
                </div>

                <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Shared terms</p>
                            <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>Terms currently routing exposure matches into this customer scope.</p>
                        </div>
                        <span className={workflowStatusClass(activeWatchlists.length ? 'ready' : 'blocked')}>{activeWatchlists.length ? 'active' : 'syncing'}</span>
                    </div>
                    <div className='mt-3 grid gap-2'>
                        {activeWatchlists.slice(0, 3).map(watchlist => (
                            <div key={watchlist.id} className='rounded-lg border border-[#27364f] bg-[#080e18] p-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='truncate text-xs font-semibold text-[#edf4ff]'>{watchlist.name}</p>
                                    <span className='text-[11px] text-[#8fa0ba]'>{relativeTime(watchlist.updatedAt)}</span>
                                </div>
                                <div className='mt-2 flex flex-wrap gap-1'>
                                    {watchlist.terms.slice(0, 6).map(termItem => (
                                        <button
                                            key={`${watchlist.id}:${termItem.value}`}
                                            type='button'
                                            disabled={Boolean(watchlistBlockedReason) || Boolean(busyAction) || watchlist.terms.length <= 1}
                                            title={watchlist.terms.length <= 1 ? 'Pause the watchlist before removing its last term.' : watchlistBlockedReason || 'Remove this term from the shared watchlist.'}
                                            onClick={() => onUpdateWatchlist({ watchlist, terms: watchlist.terms.filter(candidate => candidate.value !== termItem.value) })}
                                            className='rounded-full border border-[#27364f] bg-[#0f1726] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc] transition hover:border-[#3c5072] hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            {termItem.kind || inferTermKind(termItem.value)}:{termItem.value}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type='button'
                                    disabled={Boolean(watchlistBlockedReason) || Boolean(busyAction)}
                                    title={watchlistBlockedReason || 'Pause this shared watchlist.'}
                                    onClick={() => onUpdateWatchlist({ watchlist, status: 'paused' })}
                                    className='mt-2 inline-flex h-8 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `watchlist:update:${watchlist.id}` ? 'Saving...' : 'Pause watchlist'}
                                </button>
                            </div>
                        ))}
                        {!activeWatchlists.length && <p className='text-xs leading-5 text-[#8fa0ba]'>Shared watchlist state is updating for the first active term.</p>}
                    </div>
                </div>

                {visibility?.allowed === false && (
                    <InspectionNotice
                        tone='blocked'
                        title='Case visibility blocked'
                        body={`Policy ${visibility.alertVisibilityPolicy} allows ${visibility.allowedRoles.join(', ')}. Current member needs access: ${visibility.reason || 'access is denied'}.`}
                    />
                )}

                <div className='grid gap-2'>
                    {orgContext?.links.map(link => (
                        <Link key={link.href} href={link.href} className='inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033]'>
                            {link.label}
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}

function OperatorActionRail({ selected, orgContext, caseDetail, alertDetail, actionDeliveries = [], note, busyAction, onRunAction, onCustomerNotification, onCopyPayload }: {
    selected?: WorkbenchCase
    orgContext?: WorkbenchOrgContext
    caseDetail?: CaseDetailState
    alertDetail?: AlertDetailState
    actionDeliveries?: WorkbenchDeliveryEvidence[]
    note: string
    busyAction: string | null
    onRunAction: (action: WorkbenchAction) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onCopyPayload: (payload?: unknown) => void | Promise<void>
}) {
    const rows = actionRailRows(selected, orgContext, caseDetail, alertDetail, actionDeliveries, note)

    return (
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='border-b border-[#26344d] px-4 py-3'>
                <h3 className='text-sm font-semibold text-[#edf4ff]'>Operator actions</h3>
                <p className='mt-0.5 text-xs text-[#8fa0ba]'>Run the backed action, open the record, or copy the selected review package.</p>
            </div>
            <div className='grid gap-2 p-3'>
                {rows.map(row => (
                    <div key={row.id} className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                        <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>{sanitizeWorkbenchCopy(row.label) || row.label}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#aab7cc]'>{sanitizeWorkbenchCopy(row.detail) || row.detail}</p>
                            </div>
                            <span className={workflowStatusClass(row.disabledReason ? 'blocked' : row.tone)}>{row.disabledReason ? 'syncing' : label(row.tone)}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {row.href ? (
                                <Link href={row.href} className='inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033]'>
                                    Open
                                    <ExternalLink className='h-3.5 w-3.5' />
                                </Link>
                            ) : null}
                            {row.action ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction) || Boolean(row.disabledReason || row.action.disabledReason)}
                                    title={row.disabledReason || row.action.disabledReason}
                                    onClick={() => onRunAction(row.action as WorkbenchAction)}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `action:${selected?.id}:${row.action.id}` ? 'Running...' : row.action.label}
                                </button>
                            ) : null}
                            {row.copyPayload !== undefined ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction)}
                                    onClick={() => onCopyPayload(row.copyPayload)}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Copy handoff
                                </button>
                            ) : null}
                            {row.customerNotification ? (
                                <button
                                    type='button'
                                    disabled={Boolean(busyAction) || Boolean(row.disabledReason)}
                                    title={row.disabledReason}
                                    onClick={onCustomerNotification}
                                    className='inline-flex min-h-8 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:border-[#3c5072] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `case:${selected?.id}:customer_notification` ? 'Recording...' : 'Record receipt'}
                                </button>
                            ) : null}
                            {!row.href && !row.action && row.copyPayload === undefined && !row.customerNotification && (
                                <button type='button' disabled title={row.disabledReason} className='inline-flex min-h-8 cursor-not-allowed items-center rounded-lg border border-[#27364f] bg-[#101827] px-2.5 text-xs font-semibold text-[#71819a]'>
                                    Needs setup
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

export type OperatorActionRailRow = {
    id: string
    label: string
    detail: string
    tone: WorkbenchWorkflowStep['status']
    href?: string
    action?: WorkbenchAction
    copyPayload?: unknown
    customerNotification?: boolean
    disabledReason?: string
}

const alertWorkflowActionIds = new Set(['review_alert', 'escalate_alert', 'suppress_alert', 'close_alert'])

function actionRailRows(selected: WorkbenchCase | undefined, orgContext: WorkbenchOrgContext | undefined, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, actionDeliveries: WorkbenchDeliveryEvidence[] = [], note = ''): OperatorActionRailRow[] {
    if (!selected) return [{
        id: 'select_case',
        label: 'Select work',
        detail: 'Choose a case before actions are available.',
        tone: 'needs_action',
    }]
    if (selected.handoff) return handoffActionRailRows(selected, orgContext)

    const rows: OperatorActionRailRow[] = []
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    if (selected.kind === 'dwm_alert') {
        const alertDetailHref = `/api/dwm/alerts/${encodeURIComponent(selected.id)}`
        const dwmWorkspaceHref = relatedLinkHref(selected, 'Open dark web case') || `/dashboard/dwm?alert=${encodeURIComponent(selected.id)}`
        rows.push({
            id: 'open_dwm_workspace',
            label: 'Open dark web case',
            detail: 'Open the selected alert with evidence decisions, source details, delivery state, and case activity.',
            tone: selected.persistent ? 'ready' : 'needs_action',
            href: dwmWorkspaceHref,
        })
        rows.push({
            id: 'open_alert_detail',
            label: 'Open alert detail',
            detail: selected.persistent ? `Open ${alertDetailHref}.` : 'Fallback alerts cannot load /api/dwm/alerts/:id.',
            tone: selected.persistent ? 'ready' : 'blocked',
            href: selected.persistent ? alertDetailHref : undefined,
            disabledReason: selected.persistent ? undefined : 'Fallback alerts cannot load /api/dwm/alerts/:id.',
        })
        const sourceProfileHref = alertSourceProfileHref(alertDetail?.status === 'ready' ? alertDetail.detail : undefined)
        if (sourceProfileHref) {
            rows.push({
                id: 'inspect_alert_source_health',
                label: 'Source health',
                detail: `Open source inventory profile from alert evidence: ${sourceProfileHref}.`,
                tone: 'ready',
                href: sourceProfileHref,
            })
        }
    }
    const backedCaseHref = selected.caseDetailHref || (alertDetail?.status === 'ready' ? caseDetailHrefFromAlertDetail(alertDetail.detail, orgContext) : undefined)
    if (backedCaseHref) {
        rows.push({ id: 'open_case', label: 'Open selected case', detail: backedCaseHref, tone: 'ready', href: backedCaseHref })
        rows.push({
            id: 'export_case_evidence',
            label: 'Replay export',
            detail: `GET ${caseExportHref(backedCaseHref)} returns case evidence, timeline, delivery rows, and next-action payloads for audit replay.`,
            tone: 'ready',
            href: caseExportHref(backedCaseHref),
        })
        const notificationState = customerNotificationActionState(caseDetail)
        const notificationDisabledReason = notificationState.disabledReason || (!note.trim() ? 'Customer notification receipt requires decision rationale.' : undefined)
        rows.push({
            id: 'record_customer_notification',
            label: 'Record receipt',
            detail: `POST ${caseCustomerNotificationHref(backedCaseHref)} after delivered webhook evidence is present.`,
            tone: notificationDisabledReason ? 'blocked' : 'ready',
            customerNotification: true,
            disabledReason: notificationDisabledReason,
        })
    } else if (selected.kind === 'dwm_alert') {
        rows.push({ id: 'case_blocked', label: 'Open selected case', detail: selected.missingDependency || 'Case link is syncing to this alert.', tone: 'blocked' })
    }
    if (selected.kind === 'dwm_alert') {
        const replayAction = selected.actions?.find(action => action.id === 'replay_alert')
        const replayDisabledReason = replayAction?.disabledReason || (selected.persistent ? undefined : 'Persisted alert replay is syncing before evidence replay can run.')
        rows.push({
            id: 'replay_alert',
            label: 'Replay evidence',
            detail: replayDisabledReason
                ? replayDisabledReason
                : replayAction ? `${replayAction.method} ${replayAction.href}; replay is available for this workflow version.` : `Replay evidence for ${selected.id}.`,
            tone: replayDisabledReason ? 'blocked' : 'ready',
            action: replayAction || {
                id: 'replay_alert',
                label: 'Replay',
                method: 'POST',
                href: `/api/dwm/alerts/${encodeURIComponent(selected.id)}/replay`,
                body: { actor: 'dashboard' },
                disabledReason: selected.persistent ? undefined : 'Persisted alert replay has not attached yet.',
            },
            disabledReason: replayDisabledReason,
        })
        for (const action of selected.actions?.filter(candidate => alertWorkflowActionIds.has(candidate.id)) || []) {
            rows.push({
                id: action.id,
                label: action.label,
                detail: `${action.method} ${action.href}; rationale is attached before the workflow state is updated.`,
                tone: action.disabledReason ? 'blocked' : 'ready',
                action,
                disabledReason: action.disabledReason,
            })
        }
    }
    if (selected.kind === 'source_capture') {
        const sourceHref = relatedLinkHref(selected, 'Open source')
        const domainHref = relatedLinkHref(selected, 'Open domain')
        rows.push({
            id: 'open_capture_source',
            label: 'Open source',
            detail: sourceHref ? `${selected.sourceLabel} via ${sourceHref}.` : 'Selected evidence did not include a source profile link.',
            tone: sourceHref ? 'ready' : 'blocked',
            href: sourceHref,
            disabledReason: sourceHref ? undefined : 'Source capture drill-in requires /dashboard/ti/sources/:id.',
        })
        rows.push({
            id: 'open_capture_domain',
            label: 'Open domain',
            detail: domainHref ? `${selected.matchedTerm} via ${domainHref}.` : 'Selected evidence did not include a domain context link.',
            tone: domainHref ? 'ready' : 'blocked',
            href: domainHref,
            disabledReason: domainHref ? undefined : 'Domain drill-in requires /dashboard/ti/domains/:domain.',
        })
    }
    if (selected.kind === 'ti_domain') {
        const domainHref = relatedLinkHref(selected, 'Open domain')
        const sourcesHref = relatedLinkHref(selected, 'Review sources')
        rows.push({
            id: 'open_domain_review',
            label: 'Open domain',
            detail: domainHref ? `${selected.matchedTerm || selected.company} via ${domainHref}.` : 'Selected domain item did not include a domain review link.',
            tone: domainHref ? 'ready' : 'blocked',
            href: domainHref,
            disabledReason: domainHref ? undefined : 'Domain review requires /dashboard/ti/domains/:domain.',
        })
        rows.push({
            id: 'review_domain_sources',
            label: 'Review sources',
            detail: sourcesHref ? `${selected.sourceLabel} via ${sourcesHref}.` : 'Selected domain item did not include a source review link.',
            tone: sourcesHref ? 'ready' : 'blocked',
            href: sourcesHref,
            disabledReason: sourcesHref ? undefined : 'Source review requires /dashboard/ti/sources.',
        })
    }
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    const sendAction = sendDeliveryActionFor(selected)
    if (sendAction) {
        const sendActionBody = scopedDeliveryActionBody(sendAction.body || {}, orgContext)
        const sendDestinationReady = hasSendDeliveryDestination({ ...sendAction, body: sendActionBody }, orgContext)
        const sendDisabledReason = sendDeliveryDisabledReason(selected, orgContext)
        rows.push({
            id: 'send_alert',
            label: 'Send delivery',
            detail: sendDestinationReady ? `Send to ${stringValue(sendActionBody.webhookDestinationId) || 'the selected destination'}.` : 'Configure or test an organization webhook destination before sending alert delivery.',
            tone: sendDisabledReason ? 'blocked' : selected.deliveryEvidence?.some(item => item.status === 'delivered') ? 'ready' : 'needs_action',
            action: sendDisabledReason ? { ...sendAction, body: sendActionBody, disabledReason: sendDisabledReason } : { ...sendAction, body: sendActionBody },
            disabledReason: sendDisabledReason,
        })
    }
    const selectedDelivery = latestDeliveryForActionRail(selected, caseDetail, actionDeliveries, orgContext)
    if (selectedDelivery) {
        const ledgerHref = deliveryLedgerHref(orgContext, selected, selectedDelivery)
        rows.push({
            id: 'open_delivery_ledger',
            label: 'Open delivery ledger',
            detail: `Open delivery ${selectedDelivery.id}:${selectedDelivery.status}.`,
            tone: selectedDelivery.status === 'failed' || selectedDelivery.status === 'skipped' ? 'blocked' : 'ready',
            href: ledgerHref,
        })
    } else if (selected.kind === 'dwm_alert' && alertDetail?.status === 'ready' && alertDetail.detail.deliveryReadiness?.deliveryHistoryRefs?.length) {
        const ledgerHref = deliveryLedgerHref(orgContext, selected)
        rows.push({
            id: 'inspect_alert_delivery_history',
            label: 'Delivery history',
            detail: `${alertDetail.detail.deliveryReadiness.deliveryHistoryRefs.length} delivery history reference${alertDetail.detail.deliveryReadiness.deliveryHistoryRefs.length === 1 ? '' : 's'} attached.`,
            tone: alertDetail.detail.deliveryReadiness.ready ? 'ready' : 'needs_action',
            href: ledgerHref,
        })
    }
    if (activeWebhook && orgContext?.organization) {
        const destinationHref = organizationWebhookDestinationHref(orgContext.organization.id, activeWebhook.id)
        rows.push({
            id: 'inspect_webhook_destination',
            label: 'Open destination',
            detail: `${activeWebhook.name} is ${activeWebhook.status}${activeWebhook.lastTestStatus ? `, last test ${activeWebhook.lastTestStatus}` : ''}.`,
            tone: activeWebhook.status === 'active' ? 'ready' : 'needs_action',
            href: destinationHref,
        })
        rows.push({
            id: 'test_webhook',
            label: 'Test webhook',
            detail: `${activeWebhook.name} (${activeWebhook.id}) via /api/organizations/:id/webhooks/test.`,
            tone: activeWebhook.lastTestStatus === 'failed' ? 'blocked' : 'ready',
            action: {
                id: 'test_org_webhook',
                label: 'Test',
                method: 'POST',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks/test`,
                body: { webhookDestinationId: activeWebhook.id, dryRun: true },
            },
        })
    } else {
        rows.push({ id: 'configure_webhook', label: 'Configure webhook', detail: 'Add an active organization destination before sending alerts.', tone: 'needs_action', href: '/dashboard/automations?setup=dwm' })
    }
    if (selected.kind === 'webhook_readiness') {
        rows.push({
            id: 'inspect_webhook_delivery_history',
            label: 'Delivery history',
            detail: 'Delivery attempts for the selected organization or workspace.',
            tone: selected.deliveryEvidence?.length ? 'ready' : 'needs_action',
            href: deliveryLedgerHref(orgContext, selected),
        })
        rows.push({
            id: 'open_webhook_configuration',
            label: 'Delivery setup',
            detail: activeWebhook && orgContext?.organization ? 'Open the organization webhook route used by Test webhook and Send alerts.' : 'Open delivery setup before sending alerts.',
            tone: activeWebhook ? 'ready' : 'needs_action',
            href: orgContext?.organization ? `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks` : '/dashboard/automations?setup=dwm',
        })
    }
    if (sourceCoverage) {
        rows.push({
            id: 'source_health',
            label: 'Source health',
            detail: `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources; ${sourceCoverage.watchlistMatchCount} watchlist matches.`,
            tone: sourceCoverage.activeSourceCount ? 'ready' : 'needs_action',
            href: '/dashboard/ti/sources',
        })
    } else {
        rows.push({ id: 'source_unavailable', label: 'Source health', detail: 'Open collection to refresh live source coverage.', tone: 'needs_action', href: '/dashboard/ti/sources' })
    }
    if (selected.kind === 'org_readiness') {
        if (orgContext?.organization) {
            rows.push({
                id: 'inspect_org_members',
                label: 'Inspect members',
                detail: `${orgContext.readiness.activeMemberCount} active member${orgContext.readiness.activeMemberCount === 1 ? '' : 's'} available for assignment and visibility checks.`,
                tone: orgContext.members.some(member => member.status === 'active') ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/members`,
            })
            rows.push({
                id: 'inspect_org_alert_readiness',
                label: 'Alert status',
                detail: 'Shared watchlist alertability is attached for this organization.',
                tone: orgContext.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/alert-readiness`,
            })
        } else {
            rows.push({ id: 'create_org_context', label: 'Open organizations', detail: 'Create or select an organization before live customer routing.', tone: 'needs_action', href: '/api/organizations' })
        }
    }
    if (selected.kind === 'watchlist_readiness') {
        rows.push({
            id: 'open_watchlist_workflow',
            label: 'Edit watched terms',
            detail: 'Open dark web cases to create shared terms, attach delivery, and rebuild generated alerts.',
            tone: 'ready',
            href: '/dashboard/dwm',
        })
        rows.push({
            id: 'inspect_watchlists',
            label: 'Inspect watchlists',
            detail: 'Shared watchlist terms and delivery routing feed alert generation.',
            tone: orgContext?.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
            href: '/api/dwm/watchlists',
        })
        rows.push({
            id: 'inspect_watchlist_alert_queue',
            label: 'Generated alerts',
            detail: 'Persisted alerts generated from shared watchlists and source coverage.',
            tone: orgContext?.readiness.liveAlertCount ? 'ready' : 'needs_action',
            href: '/api/dwm/alerts',
        })
        if (orgContext?.organization) {
            rows.push({
                id: 'inspect_watchlist_alertability',
                label: 'Alertability status',
                detail: 'Active watchlist terms and visibility status are attached.',
                tone: orgContext.readiness.activeWatchlistCount ? 'ready' : 'needs_action',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/alert-readiness`,
            })
        }
    }
    if (selected.kind === 'source_readiness') {
        rows.push({
            id: 'inspect_dwm_operations',
            label: 'Source coverage',
            detail: sourceCoverage
                ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources, ${sourceCoverage.captureCount} captures, and ${sourceCoverage.watchlistMatchCount} watchlist matches.`
                : 'Source-health stream updates with the next operation event.',
            tone: sourceCoverage ? sourceCoverage.activeSourceCount ? 'ready' : 'needs_action' : 'needs_action',
            href: '/api/dwm/operations',
        })
        rows.push({
            id: 'inspect_source_inventory',
            label: 'Inspect inventory',
            detail: 'Source inventory, packs, collection state, alerts, watchlists, and deliveries are visible in collection.',
            tone: sourceCoverage ? 'ready' : 'needs_action',
            href: '/api/ti/scraper/control',
        })
        rows.push({
            id: 'open_source_operations',
            label: 'Collection',
            detail: 'Open collection for parser checks, source requests, canary runs, and source apply-plan actions.',
            tone: 'ready',
            href: '/dashboard/ti/control',
        })
        for (const action of (selected.actions || []).filter(candidate => candidate.id === 'request_source_coverage' || candidate.id === 'run_canary_collection' || candidate.id === 'preview_source_apply_plan')) {
            rows.push({
                id: action.id,
                label: action.label,
                detail: `${action.method} ${action.href}.`,
                tone: action.disabledReason ? 'blocked' : 'ready',
                action,
                disabledReason: action.disabledReason,
            })
        }
    }
    if (selected.kind === 'support_readiness') {
        rows.push({
            id: 'open_helpdesk_workbench',
            label: 'Open helpdesk',
            detail: selected.missingDependency || 'Review recovery requests and admin audit export from the support workbench.',
            tone: selected.missingDependency ? 'needs_action' : 'ready',
            href: '/dashboard/system/impersonation',
        })
        rows.push({
            id: 'support_recovery_api',
            label: 'Recovery requests',
            detail: 'Support recovery requests with actor, target, and outcome rows.',
            tone: 'ready',
            href: '/api/backend/admin/support/access-recovery',
        })
        rows.push({
            id: 'admin_audit_api',
            label: 'Admin audit',
            detail: 'Admin audit stream with support and impersonation events.',
            tone: 'ready',
            href: '/api/backend/admin/audit-events?limit=50',
        })
    }
    if (selected.kind === 'alert_readiness') {
        rows.push({
            id: 'open_alert_generation_readiness',
            label: 'Generation status',
            detail: 'Generated alerts link sources, watchlists, and customer visibility.',
            tone: selected.missingDependency ? 'needs_action' : 'ready',
            href: '/api/dwm/alerts/generation-readiness',
        })
        rows.push({
            id: 'inspect_generated_alerts',
            label: 'Generated alerts',
            detail: 'Recent alerts for the selected organization/member workspace.',
            tone: selected.missingDependency ? 'needs_action' : 'ready',
            href: '/api/dwm/alerts',
        })
        rows.push({
            id: 'open_dwm_alert_workflow',
            label: 'Open dark web cases',
            detail: 'Open dark web cases to update watched terms, rebuild alerts, and inspect generated alert state.',
            tone: 'ready',
            href: '/dashboard/dwm',
        })
    }
    const handledActionIds = new Set(rows.flatMap(row => [row.id, row.action?.id].filter(Boolean) as string[]))
    for (const action of selected.actions || []) {
        if (handledActionIds.has(action.id) || action.id === 'rebuild_alerts') continue
        rows.push({
            id: action.id,
            label: action.label,
            detail: `${action.method} ${action.href}.`,
            tone: action.disabledReason ? 'blocked' : 'ready',
            href: action.method === 'GET' ? action.href : undefined,
            action: action.method === 'GET' ? undefined : action,
            disabledReason: action.disabledReason,
        })
        handledActionIds.add(action.id)
    }
    rows.push(...readinessActionRows(orgContext))
    const rebuildAction = selected.actions?.find(action => action.id === 'rebuild_alerts')
    if (rebuildAction) rows.push({ id: 'rebuild_alerts', label: 'Rebuild alerts', detail: 'Rebuild alerts for the selected workspace.', tone: 'ready', action: rebuildAction })
    return rows.slice(0, 8)
}

function readinessActionRows(orgContext: WorkbenchOrgContext | undefined): OperatorActionRailRow[] {
    const priority = ['dashboard_evidence', 'analyst_workflow', 'end_to_end_workflow', 'source_inventory_probe', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'webhook_delivery', 'helpdesk_audit', 'deploy_probe', 'public_ti_provenance']
    return (orgContext?.readiness.productReadiness || [])
        .filter(item => item.status !== 'ready' && priority.includes(item.id))
        .sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))
        .slice(0, 3)
        .map(item => {
            const analystCaseDetail = item.id === 'analyst_workflow' && item.caseId
                ? ` Case ${item.caseId}${item.caseStatus ? ` is ${item.caseStatus}` : ''}${item.caseDetailTimelineCount ? ` with ${item.caseDetailTimelineCount} timeline event${item.caseDetailTimelineCount === 1 ? '' : 's'}` : ''}.`
                : ''
            const webhookHealthDetail = item.id === 'webhook_health'
                ? ` Destinations ${item.activeDestinationCount ?? 0}/${item.destinationCount ?? 0} active; ${item.deliveryReadyCount ?? 0} delivery-ready${item.latestDeliveryAt ? `; latest delivery ${relativeTime(item.latestDeliveryAt)}` : item.latestAuditEventAt ? `; latest audit ${relativeTime(item.latestAuditEventAt)}` : ''}.`
                : ''
            const sourceWorkerDetail = item.id === 'source_inventory_probe'
                ? ` Worker ${item.workerStatus || 'syncing'}${item.workerLastRunAt ? `; last run ${relativeTime(item.workerLastRunAt)}` : ''}; ${item.collectionReadyRows ?? 0} collection-ready rows; ${item.parserSourceFamilyCount ?? 0} parser families; ${item.queuedValidationJobs ?? 0} queued, ${item.validatingJobs ?? 0} validating.`
                : ''
            const workflowStatusDetail = item.id === 'end_to_end_workflow'
                ? ` Steps ${item.endToEndWorkflowReadyStepCount ?? 0}/${item.endToEndWorkflowStepCount ?? 0} ready; ${item.endToEndWorkflowBlockedStepCount ?? 0} blocked; ${item.endToEndWorkflowMissingFieldCount ?? 0} fields syncing.`
                : ''
            const alertGenerationDetail = item.id === 'dashboard_evidence'
                ? ` Candidates ${item.candidateCount ?? item.matchedCandidateCount ?? 0}; evidence captures ${item.generationEvidenceWindowCaptureCount ?? item.captureRefCount ?? 0}; route gaps ${item.missingRouteCandidateCount ?? 0}.`
                : ''
            return {
                id: `readiness_${item.id}`,
                label: item.operatorAction || item.label,
                detail: `${item.detail}${analystCaseDetail}${webhookHealthDetail}${sourceWorkerDetail}${workflowStatusDetail}${alertGenerationDetail}`,
                tone: productReadinessTone(item.status),
                href: item.href,
                disabledReason: item.status === 'unavailable' ? item.source : undefined,
            }
        })
}

function relatedLinkHref(selected: WorkbenchCase, label: string) {
    return selected.relatedLinks.find(link => link.label === label)?.href
}

function handoffActionRailRows(selected: WorkbenchCase, orgContext: WorkbenchOrgContext | undefined): OperatorActionRailRow[] {
    const handoff = selected.handoff as WorkbenchPublicTiHandoff
    if (handoff.decodeStatus === 'blocked') {
        return [{
            id: 'malformed_public_ti_handoff',
            label: 'Public TI handoff syncing',
            detail: handoff.decodeError || 'The handoff payload could not be decoded.',
            tone: 'blocked',
            copyPayload: handoff,
        }]
    }

    const orgMissing = !orgContext?.organization
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    const watchlistReadiness = handoffReadinessFor(handoff, 'create_watchlist')
    const rebuildReadiness = handoffReadinessFor(handoff, 'rebuild_alerts')
    const caseReadiness = handoffReadinessFor(handoff, 'open_case')
    const enrichmentReadiness = handoffReadinessFor(handoff, 'queue_enrichment')
    const rows: OperatorActionRailRow[] = []
    const watchlistPayload = handoff.actionPayloads?.watchlist || handoff.selectedPayload
    const watchTerms = handoffTerms(handoff)
    const watchlistDisabledReason = readinessDisabledReason(watchlistReadiness)
        || (orgMissing ? 'Select an organization before saving Public TI handoff actions.' : !watchTerms.length ? 'Public TI handoff has no watchlist term yet.' : undefined)
    rows.push({
        id: 'handoff_watchlist',
        label: 'Add org watchlist term',
        detail: readinessDetail(watchlistReadiness, watchTerms.length ? watchTerms.map(term => `${term.kind || inferTermKind(term.value)}:${term.value}`).join(', ') : 'Watchlist term is syncing from the selected handoff.'),
        tone: readinessTone(watchlistReadiness, orgMissing || !watchTerms.length ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_create_watchlist',
            label: 'Add term',
            method: 'POST',
            href: '/api/dwm/watchlists',
            body: {
                ...scopeBody(orgContext),
                name: typeof watchlistPayload?.body?.name === 'string' ? watchlistPayload.body.name : `${handoff.query || selected.title} watchlist`,
                terms: watchTerms,
                status: 'active',
                webhookDestinationId: activeWebhook?.id,
                publicTiHandoff: handoffEnvelope(handoff),
            },
            disabledReason: watchlistDisabledReason,
        },
        disabledReason: watchlistDisabledReason,
    })
    const rebuildDisabledReason = readinessDisabledReason(rebuildReadiness)
        || (orgMissing
            ? 'Public TI alert rebuild requires selected organization context.'
            : !sourceCoverage ? 'Alert rebuild is reading source coverage.'
                : !orgContext?.readiness.activeWatchlistCount ? 'Create an active organization watchlist before rebuilding alerts.' : undefined)
    rows.push({
        id: 'handoff_rebuild',
        label: 'Rebuild alerts',
        detail: readinessDetail(rebuildReadiness, sourceCoverage ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources; ${orgContext?.readiness.liveAlertCount ?? 0} saved alerts in queue.` : 'Alert rebuild is reading source coverage.'),
        tone: readinessTone(rebuildReadiness, orgMissing || !sourceCoverage || !orgContext?.readiness.activeWatchlistCount ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_rebuild_alerts',
            label: 'Rebuild',
            method: 'POST',
            href: '/api/dwm/alerts/rebuild',
            body: { ...scopeBody(orgContext), publicTiHandoff: handoffEnvelope(handoff), watchTerms },
            disabledReason: rebuildDisabledReason,
        },
        disabledReason: rebuildDisabledReason,
    })
    const casePayload = handoff.actionPayloads?.case || handoff.selectedPayload
    const caseDisabledReason = readinessDisabledReason(caseReadiness)
        || (orgMissing ? 'Public TI case creation requires selected organization context.' : casePayload?.blocked ? (casePayload.missing || handoff.missing).join('; ') : undefined)
    rows.push({
        id: 'handoff_case',
        label: 'Open selected case',
        detail: readinessDetail(caseReadiness, handoff.missing.length ? handoff.missing.join('; ') : 'Create or reopen a backed analyst case from the handoff payload.'),
        tone: readinessTone(caseReadiness, orgMissing || casePayload?.blocked ? 'blocked' : 'ready'),
        action: {
            id: 'public_ti_open_case',
            label: 'Open case',
            method: 'POST',
            href: '/api/cases',
            body: { ...scopeBody(orgContext), ...(casePayload?.body || {}), sourceType: 'public_ti', sourceId: handoff.artifactId, publicTiHandoff: handoffEnvelope(handoff), reopen: true },
            disabledReason: caseDisabledReason,
        },
        copyPayload: casePayload?.blocked ? handoff : undefined,
        disabledReason: caseDisabledReason,
    })
    rows.push(activeWebhook && orgContext?.organization ? {
        id: 'handoff_webhook',
        label: 'Test webhook',
        detail: `${activeWebhook.name} (${activeWebhook.id}); last test ${activeWebhook.lastTestStatus || 'checking'}.`,
        tone: activeWebhook.lastTestStatus === 'failed' ? 'blocked' : 'ready',
        action: {
            id: 'public_ti_test_org_webhook',
            label: 'Test',
            method: 'POST',
            href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks/test`,
            body: { webhookDestinationId: activeWebhook.id, dryRun: true, publicTiHandoff: handoffEnvelope(handoff) },
        },
    } : {
        id: 'handoff_webhook_blocked',
        label: 'Configure/test webhook',
        detail: 'Add an active organization webhook destination before sending alerts.',
        tone: 'needs_action',
        href: '/dashboard/automations?setup=dwm',
    })
    rows.push({
        id: 'handoff_source',
        label: handoff.sourceRequired ? 'Request source pack' : 'Source health',
        detail: readinessDetail(enrichmentReadiness, sourceCoverage ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active sources. ${handoff.sourceRequests.length} source request(s) in handoff.` : 'Open collection to attach source-pack changes for this handoff.'),
        tone: readinessTone(enrichmentReadiness, sourceCoverage?.activeSourceCount ? 'ready' : 'blocked'),
        href: enrichmentReadiness?.backedRoute || '/dashboard/ti/sources',
        copyPayload: handoff.sourceRequired || !sourceCoverage || enrichmentReadiness?.ready === false ? handoff : undefined,
        disabledReason: readinessDisabledReason(enrichmentReadiness),
    })
    rows.push({ id: 'handoff_copy', label: 'Exact handoff', detail: `${handoff.action || 'public TI'} payload for ${handoff.artifact?.label || handoff.artifactId || selected.title}.`, tone: 'ready', copyPayload: handoff })
    return rows
}

function handoffReadinessFor(handoff: WorkbenchPublicTiHandoff, action: WorkbenchHandoffAction): WorkbenchPublicTiActionReadiness | undefined {
    return handoff.actionReadiness?.find(item => item.action === action)
}

function readinessDisabledReason(readiness: WorkbenchPublicTiActionReadiness | undefined) {
    if (!readiness || readiness.ready) return undefined
    return [
        readiness.blockerCodes.length ? `Needs setup: ${readiness.blockerCodes.join(', ')}.` : '',
        readiness.missing.length ? readiness.missing.join('; ') : '',
    ].filter(Boolean).join(' ') || 'Public TI action context is syncing.'
}

function readinessDetail(readiness: WorkbenchPublicTiActionReadiness | undefined, fallback: string) {
    if (!readiness) return fallback
    const route = readiness.backedRoute || readiness.endpoint || readiness.route
    const sourceRequests = readiness.sourceRequestCount ? `; ${readiness.sourceRequestCount} source request${readiness.sourceRequestCount === 1 ? '' : 's'}` : ''
    return `${fallback} Status: ${readiness.ready ? 'ready' : 'checking'}${route ? ` through ${route}` : ''}${sourceRequests}.`
}

function readinessTone(readiness: WorkbenchPublicTiActionReadiness | undefined, fallback: WorkbenchWorkflowStep['status']): WorkbenchWorkflowStep['status'] {
    if (!readiness) return fallback
    return readiness.ready ? 'ready' : 'blocked'
}

type HandoffTerm = { value: string, kind: string, notes?: string }

function handoffTerms(handoff: WorkbenchPublicTiHandoff): HandoffTerm[] {
    const fromArtifact = handoff.artifact?.watchlistTerms || []
    const fromPayload = Array.isArray(handoff.actionPayloads?.watchlist?.body?.terms) ? handoff.actionPayloads?.watchlist?.body?.terms : []
    return [...fromArtifact, ...fromPayload]
        .flatMap((term): HandoffTerm[] => {
            if (!term || typeof term !== 'object') return []
            const value = 'value' in term ? String(term.value || '').trim() : ''
            if (!value) return []
            return [{
                value,
                kind: 'kind' in term && typeof term.kind === 'string' ? term.kind : inferTermKind(value),
                notes: 'notes' in term && typeof term.notes === 'string' ? term.notes : undefined,
            }]
        })
        .filter((term, index, values) => values.findIndex(candidate => candidate.value.toLowerCase() === term.value.toLowerCase()) === index)
}

function handoffEnvelope(handoff: WorkbenchPublicTiHandoff) {
    return {
        source: 'public-ti',
        action: handoff.action,
        artifactId: handoff.artifactId,
        query: handoff.query,
        generatedAt: handoff.generatedAt,
    }
}

function ProductReadinessPanel({ orgContext }: { orgContext?: WorkbenchOrgContext }) {
    const items = orgContext?.readiness.productReadiness || []
    const prioritizedItems = [...items].sort(readinessPrioritySort)
    const readyCount = items.filter(item => item.status === 'ready').length
    const blockerCount = items.length - readyCount
    const [selectedReadinessId, setSelectedReadinessId] = useState('')
    const [readinessActionState, setReadinessActionState] = useState<{ id: string, status: 'running' | 'ready' | 'blocked', text: string } | null>(null)
    const selectedReadiness = items.find(item => item.id === selectedReadinessId)
        || items.find(item => item.status !== 'ready')
        || items[0]
    const runReadinessAction = useCallback(async (item: WorkbenchProductReadinessItem, action: WorkbenchAction) => {
        if (action.method === 'GET') return
        const key = `${item.id}:${action.id}`
        if (action.disabledReason) {
            setReadinessActionState({ id: key, status: 'blocked', text: action.disabledReason })
            return
        }
        setReadinessActionState({ id: key, status: 'running', text: `${action.method} ${action.href}` })
        try {
            const response = await fetch(action.href, {
                method: action.method,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(action.body || {}),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setReadinessActionState({ id: key, status: 'ready', text: `${action.label} completed.` })
        } catch (error) {
            setReadinessActionState({ id: key, status: 'blocked', text: error instanceof Error ? error.message : String(error) })
        }
    }, [])
    if (!items.length) {
        return (
            <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3 '>
                <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#8fa0ba] '>Operations</p>
                        <p className='mt-1 text-xs leading-5 text-[#aab7cc] '>Live lanes are connecting for this workspace.</p>
                    </div>
                    <span className={workflowStatusClass('needs_action')}>checking</span>
                </div>
            </div>
        )
    }

    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3 '>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#8fa0ba] '>Live operations</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-[#aab7cc] '>
                        {orgContext?.readiness.fullChainReady
                            ? 'Org, watchlist, sources, dashboard alert, and delivery lanes are running.'
                            : `Collecting: ${(orgContext?.readiness.fullChainBlockedBy || ['dashboard alert evidence pending']).join('; ')}.`}
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    <Link href='/readiness' className='inline-flex min-h-8 min-w-36 items-center justify-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#7aa5ff] transition hover:bg-[#162033] ' data-readiness-scorecard-link='/readiness'>
                        Open operations gates
                    </Link>
                    <span className={workflowStatusClass(orgContext?.readiness.fullChainReady ? 'ready' : 'needs_action')}>
                        {orgContext?.readiness.fullChainReady ? 'ready' : `${blockerCount} syncing`}
                    </span>
                </div>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                <ReadinessDetailField label='Running' value={`${readyCount}/${items.length}`} />
                <ReadinessDetailField label='Next lane' value={prioritizedItems[0]?.label || 'checking'} />
                <ReadinessDetailField label='Operations view' value='/readiness' />
            </div>
            <div className='mt-3 grid gap-2'>
                {prioritizedItems.map((item, index) => {
                    const tone = productReadinessTone(item.status)
                    const active = selectedReadiness?.id === item.id
                    const operationalState = productReadinessOperationalState(item.status)
                    return (
                        <button
                            key={item.id}
                            type='button'
                            onClick={() => setSelectedReadinessId(item.id)}
                            className={`flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9db8ff]/50 ${active ? 'border-[#7aa5ff] bg-[#15284b] dark:border-[#2d3a52] ' : 'border-[#27364f] bg-[#0f1726] hover:border-[#b9c7da] dark:border-[#2d3a52] dark:hover:border-[#3b4b68] '}`}
                            data-readiness-row-id={item.id}
                            data-readiness-state={operationalState}
                            data-readiness-blocker-count={item.blockerCount ?? (item.status === 'ready' ? 0 : 1)}
                            data-readiness-deep-link-target={item.deepLinkTarget || item.href || ''}
                            data-readiness-proof-timestamp={item.proofTimestamp || item.checkedAt || ''}
                            data-readiness-unavailable-reason={item.unavailableReason || (item.status === 'unavailable' ? item.source : '')}
                            data-readiness-stale-after-seconds={item.staleAfterSeconds ?? ''}
                            data-readiness-expected-dashboard-row-id={item.expectedDashboardRowId || ''}
                            data-readiness-integration-probe-hint={item.integrationProbeHint || ''}
                            data-readiness-backend-proof-contract-version={customerOperationalText(item.backendProofContractVersion || '')}
                            data-readiness-owner-lane={item.ownerLane || ''}
                            data-readiness-operator-action={item.operatorAction || ''}
                            data-readiness-workflow-blocker={item.workflowBlocker || ''}
                            data-readiness-customer-impact={item.customerImpact || ''}
                            data-readiness-source-reference={customerOperationalText(item.evidenceProvenance || '')}
                            data-readiness-action-count={item.actions?.length || 0}
                            data-readiness-priority={index + 1}
                        >
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-[#edf4ff] '>{item.label}</p>
                                <p className='mt-0.5 wrap-break-word text-[11px] leading-4 text-[#8fa0ba] '>{item.detail}</p>
                                <p className='mt-1 wrap-break-word text-[10px] font-semibold uppercase text-[#7a879c] '>{[item.workflowBlocker, item.ownerLane, item.operatorAction].filter(Boolean).join(' · ')}</p>
                            </div>
                            <span className={`${workflowStatusClass(tone)} shrink-0`}>{productReadinessOperationalLabel(item.status)}</span>
                        </button>
                    )
                })}
            </div>
            {selectedReadiness ? <ReadinessDetail item={selectedReadiness} actionState={readinessActionState} onRunAction={runReadinessAction} /> : null}
        </div>
    )
}

function ReadinessDetail({ item, actionState, onRunAction }: { item: WorkbenchProductReadinessItem, actionState: { id: string, status: 'running' | 'ready' | 'blocked', text: string } | null, onRunAction: (item: WorkbenchProductReadinessItem, action: WorkbenchAction) => void | Promise<void> }) {
    const blocker = readinessBlocker(item)
    const statusTime = item.proofTimestamp || item.checkedAt || ''
    const tone = productReadinessTone(item.status)
    const actions = item.actions || []
    const metrics = readinessDetailMetrics(item)
    return (
        <div
            className='mt-3 rounded-lg border border-[#27364f] bg-[#0f1726] p-3 '
            data-readiness-detail={item.id}
            data-readiness-detail-state={item.status}
            data-readiness-detail-owner={item.ownerLane || ''}
            data-readiness-detail-action={item.operatorAction || ''}
            data-readiness-detail-contract={customerOperationalText(item.backendProofContractVersion || '')}
            data-readiness-detail-blocker={blocker}
            data-readiness-detail-workflow-blocker={item.workflowBlocker || ''}
            data-readiness-detail-customer-impact={item.customerImpact || ''}
            data-readiness-detail-source-reference={customerOperationalText(item.evidenceProvenance || '')}
            data-readiness-detail-href={item.deepLinkTarget || item.href || ''}
            data-readiness-detail-action-count={actions.length}
        >
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-[#7a879c] '>Operation detail</p>
                    <h3 className='mt-1 wrap-break-word text-sm font-semibold text-[#edf4ff] '>{item.label}</h3>
                </div>
                <span className={workflowStatusClass(tone)}>{label(item.status)}</span>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                <ReadinessDetailField label='Workflow' value={item.workflowBlocker || 'workflow attached'} />
                <ReadinessDetailField label='Owner' value={item.ownerLane || 'shared ops'} />
                <ReadinessDetailField label='Next action' value={item.operatorAction || 'monitor workflow'} />
                <ReadinessDetailField label='Last check' value={statusTime ? relativeTime(statusTime) : 'checking'} />
                <ReadinessDetailField label='Evidence' value={item.backendProofContractVersion || item.source || 'runtime evidence'} />
                <ReadinessDetailField label='Source trail' value={customerOperationalText(item.evidenceProvenance || item.source || 'runtime source')} />
                <ReadinessDetailField label='Refresh window' value={formatSeconds(item.staleAfterSeconds)} />
                <ReadinessDetailField label='Source' value={item.source || 'source'} />
                {metrics.map(metric => (
                    <ReadinessDetailField key={metric.label} label={metric.label} value={metric.value} />
                ))}
            </div>
            <div className='mt-3 rounded-lg border border-[#27364f] bg-[#0b121e] p-3 '>
                <p className='text-[10px] font-semibold uppercase text-[#8fa0ba] '>{item.status === 'ready' ? 'Evidence' : 'Needs attention'}</p>
                <p className='mt-1 wrap-break-word text-xs leading-5 text-[#dbe7ff] '>{item.status === 'ready' ? item.detail : blocker}</p>
                {item.customerImpact ? <p className='mt-2 wrap-break-word text-[11px] leading-4 text-[#8fa0ba] '>Impact: {item.customerImpact}</p> : null}
                {item.integrationProbeHint ? <p className='mt-2 wrap-break-word text-[11px] leading-4 text-[#8fa0ba] '>{item.integrationProbeHint}</p> : null}
            </div>
            {actions.length ? (
                <div className='mt-3 rounded-lg border border-[#27364f] bg-[#0b121e] p-3 ' data-readiness-detail-actions={item.id}>
                    <p className='text-[10px] font-semibold uppercase text-[#8fa0ba] '>Actions</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        {actions.map(action => {
                            const actionKey = `${item.id}:${action.id}`
                            const busy = actionState?.id === actionKey && actionState.status === 'running'
                            return action.method === 'GET' ? (
                                <Link
                                    key={action.id}
                                    href={action.href}
                                    data-readiness-action-id={action.id}
                                    data-readiness-action-method={action.method}
                                    className='inline-flex min-h-9 min-w-36 items-center justify-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#7aa5ff] transition hover:bg-[#162033] '
                                >
                                    {action.label}
                                    <ExternalLink className='h-3.5 w-3.5' />
                                </Link>
                            ) : (
                                <button
                                    key={action.id}
                                    type='button'
                                    disabled={busy || Boolean(action.disabledReason)}
                                    title={action.disabledReason}
                                    data-readiness-action-id={action.id}
                                    data-readiness-action-method={action.method}
                                    onClick={() => onRunAction(item, action)}
                                    className='inline-flex min-h-9 min-w-36 items-center justify-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#7aa5ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#9db8ff]/50 disabled:cursor-not-allowed disabled:opacity-60 '
                                >
                                    {busy ? 'Running...' : action.label}
                                </button>
                            )
                        })}
                    </div>
                    {actionState && actionState.id.startsWith(`${item.id}:`) ? (
                        <p className={`mt-2 wrap-break-word text-[11px] leading-4 ${actionState.status === 'blocked' ? 'text-[#f6b45f] ' : 'text-[#8fa0ba] '}`}>{customerOperationalText(actionState.text)}</p>
                    ) : null}
                </div>
            ) : null}
            {item.href ? (
                <div className='mt-3 flex flex-wrap gap-2'>
                    <Link href={item.href} className='inline-flex min-h-9 min-w-44 items-center justify-center rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-xs font-semibold text-[#7aa5ff] transition hover:bg-[#162033] '>
                        Open workflow
                    </Link>
                    <Link href='/readiness' className='inline-flex min-h-9 min-w-44 items-center justify-center rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-xs font-semibold text-[#7aa5ff] transition hover:bg-[#162033] '>
                        Open scorecard
                    </Link>
                </div>
            ) : (
                <p className='mt-3 text-xs leading-5 text-[#8fa0ba] '>Workflow link appears when a direct drill-in is available.</p>
            )}
        </div>
    )
}

function readinessDetailMetrics(item: WorkbenchProductReadinessItem) {
    if (item.id === 'dashboard_evidence') {
        return [
            typeof item.candidateCount === 'number' || typeof item.matchedCandidateCount === 'number'
                ? { label: 'Candidates', value: String(item.candidateCount ?? item.matchedCandidateCount ?? 0) }
                : undefined,
            typeof item.generationEvidenceWindowCaptureCount === 'number' || typeof item.captureRefCount === 'number'
                ? { label: 'Evidence window', value: `${item.generationEvidenceWindowCaptureCount ?? item.captureRefCount ?? 0} captures` }
                : undefined,
            typeof item.missingRouteCandidateCount === 'number'
                ? { label: 'Route gaps', value: `${item.missingRouteCandidateCount} candidate${item.missingRouteCandidateCount === 1 ? '' : 's'}` }
                : undefined,
            item.latestEvidenceAt ? { label: 'Latest evidence', value: relativeTime(item.latestEvidenceAt) } : undefined,
            item.generationEvidenceWindowSourceFamilies?.length
                ? { label: 'Source families', value: item.generationEvidenceWindowSourceFamilies.join(', ') }
                : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'org_alert_export') {
        return [
            typeof item.activeTermCount === 'number' ? { label: 'Active terms', value: String(item.activeTermCount) } : undefined,
            typeof item.pausedCount === 'number' ? { label: 'Paused', value: String(item.pausedCount) } : undefined,
            typeof item.archivedCount === 'number' ? { label: 'Archived', value: String(item.archivedCount) } : undefined,
            typeof item.canGenerateAlerts === 'boolean' ? { label: 'Alert export', value: item.canGenerateAlerts ? 'ready' : 'syncing' } : undefined,
            item.exportedAt ? { label: 'Exported', value: relativeTime(item.exportedAt) } : undefined,
            item.organizationId ? { label: 'Organization', value: item.organizationId } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'source_inventory_probe') {
        return [
            item.workerStatus ? { label: 'Worker', value: item.workerStatus } : undefined,
            typeof item.activeSourceCount === 'number' || typeof item.registeredTotal === 'number'
                ? { label: 'Sources', value: `${item.activeSourceCount ?? 0}/${item.registeredTotal ?? 0} active` }
                : undefined,
            typeof item.sourceFamilyCount === 'number' ? { label: 'Source families', value: String(item.sourceFamilyCount) } : undefined,
            typeof item.parserSourceFamilyCount === 'number' ? { label: 'Parser families', value: String(item.parserSourceFamilyCount) } : undefined,
            typeof item.contractLookupRows === 'number' ? { label: 'Contract rows', value: String(item.contractLookupRows) } : undefined,
            typeof item.receiptMatrixRows === 'number' ? { label: 'Receipt rows', value: String(item.receiptMatrixRows) } : undefined,
            typeof item.receiptMatrixBlockedRows === 'number' ? { label: 'Delivery checks', value: String(item.receiptMatrixBlockedRows) } : undefined,
            item.workerLastRunAt ? { label: 'Worker run', value: relativeTime(item.workerLastRunAt) } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'end_to_end_workflow') {
        return [
            typeof item.endToEndWorkflowReadyStepCount === 'number' || typeof item.endToEndWorkflowStepCount === 'number'
                ? { label: 'Ready steps', value: `${item.endToEndWorkflowReadyStepCount ?? 0}/${item.endToEndWorkflowStepCount ?? 0}` }
                : undefined,
            typeof item.endToEndWorkflowBlockedStepCount === 'number' ? { label: 'Syncing steps', value: String(item.endToEndWorkflowBlockedStepCount) } : undefined,
            typeof item.endToEndWorkflowMissingFieldCount === 'number' ? { label: 'Missing fields', value: String(item.endToEndWorkflowMissingFieldCount) } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    return []
}

function ReadinessDetailField({ label: fieldLabel, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] px-3 py-2 '>
            <p className='text-[10px] font-semibold uppercase text-[#8fa0ba] '>{fieldLabel}</p>
            <p className='mt-1 wrap-break-word text-xs font-semibold text-[#edf4ff] '>{value}</p>
        </div>
    )
}

function readinessBlocker(item: WorkbenchProductReadinessItem) {
    if (item.status === 'ready') return ''
    return item.unavailableReason || item.detail || item.source || 'Workflow lane is reading runtime data.'
}

function readinessPrioritySort(first: WorkbenchProductReadinessItem, second: WorkbenchProductReadinessItem) {
    const statusWeight: Record<WorkbenchProductReadinessItem['status'], number> = {
        blocked: 0,
        unavailable: 1,
        needs_action: 2,
        ready: 3,
    }
    const firstWeight = statusWeight[first.status] ?? 4
    const secondWeight = statusWeight[second.status] ?? 4
    if (firstWeight !== secondWeight) return firstWeight - secondWeight
    return (second.blockerCount || 0) - (first.blockerCount || 0)
}

function productReadinessTone(status: WorkbenchProductReadinessItem['status']): WorkbenchWorkflowStep['status'] {
    if (status === 'ready') return 'ready'
    return 'needs_action'
}

function productReadinessOperationalState(status: WorkbenchProductReadinessItem['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'unavailable') return 'syncing'
    return 'checking'
}

function productReadinessOperationalLabel(status: WorkbenchProductReadinessItem['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'unavailable') return 'syncing'
    return 'checking'
}

function OperatorReadinessRows({ orgContext, selected, caseDetail, actionDeliveries }: { orgContext?: WorkbenchOrgContext, selected?: WorkbenchCase, caseDetail?: CaseDetailState, actionDeliveries?: WorkbenchDeliveryEvidence[] }) {
    const latestDetailDelivery = caseDetail?.status === 'ready' ? caseDetail.detail.deliveryContext?.latestDelivery : undefined
    const latestDelivery = latestDetailDelivery || actionDeliveries?.[0] || selected?.deliveryEvidence?.[0] || orgContext?.readiness.latestDelivery
    const destination = (orgContext?.webhookDestinations || []).find(item => item.id === latestDelivery?.webhookDestinationId) || orgContext?.webhookDestinations[0]
    const sourceCoverage = orgContext?.readiness.sourceCoverage
    const detailAlert = caseDetail?.status === 'ready' ? caseDetail.detail.alert : undefined
    const sourceValue = detailAlert?.sourceFamily
        ? `${label(detailAlert.sourceFamily)} · ${detailAlert.sourceCount ?? selected?.sourceLabel ?? 'source count syncing'}`
        : sourceCoverage
            ? `${sourceCoverage.activeSourceCount}/${sourceCoverage.sourceCount} active · ${sourceCoverage.watchlistMatchCount} matches`
            : selected?.sourceLabel || 'source coverage syncing'
    const sourceTone: WorkbenchWorkflowStep['status'] = detailAlert?.sourceFamily || (sourceCoverage && sourceCoverage.activeSourceCount > 0) ? 'ready' : 'blocked'
    const webhookValue = destination
        ? `${destination.name} · ${destination.status}${destination.lastTestStatus ? ` · test ${destination.lastTestStatus}` : ''}`
        : 'destination pending'
    const webhookTone: WorkbenchWorkflowStep['status'] = destination?.status === 'active' ? destination.lastTestStatus === 'failed' ? 'blocked' : 'ready' : 'blocked'
    const deliveryValue = latestDelivery
        ? `${latestDelivery.id} · ${latestDelivery.status} · ${relativeTime(latestDelivery.attemptedAt)}`
        : 'no delivery sent'
    const deliveryTone: WorkbenchWorkflowStep['status'] = latestDelivery ? latestDelivery.status === 'failed' || latestDelivery.status === 'skipped' ? 'blocked' : 'ready' : 'needs_action'

    return (
        <>
            <OperatorRow label='Webhook' value={webhookValue} tone={webhookTone} />
            <OperatorRow label='Last delivery' value={deliveryValue} tone={deliveryTone} />
            <OperatorRow label='Source health' value={sourceValue} tone={sourceTone} />
        </>
    )
}

function OperatorRow({ label: rowLabel, value, tone }: { label: string, value: string, tone: WorkbenchWorkflowStep['status'] }) {
    const cleanLabel = sanitizeWorkbenchCopy(rowLabel) || rowLabel
    const cleanValue = sanitizeWorkbenchCopy(value) || value
    return (
        <div className='flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#27364f] bg-[#0b121e] px-3 py-2 sm:items-center'>
            <span className='font-semibold text-[#edf4ff] '>{cleanLabel}</span>
            <span className='flex min-w-0 flex-wrap items-center justify-end gap-2 text-right text-[#8fa0ba] '>
                <span className='min-w-0 break-all'>{cleanValue}</span>
                <span className={`${workflowStatusClass(tone)} shrink-0`}>{label(tone)}</span>
            </span>
        </div>
    )
}

function EmptyWorkspace() {
    return (
        <div className='grid gap-4 p-5'>
            <div className='rounded-lg border border-dashed border-[#31415c] bg-[#0b121e] p-5'>
                <h2 className='text-lg font-semibold text-[#edf4ff]'>No cases to review</h2>
                <p className='mt-2 text-sm leading-6 text-[#aab7cc]'>Create watched terms, review source coverage, or run collection to produce the first actionable case.</p>
                <div className='mt-4 flex flex-wrap gap-2'>
                    <Link href='/dashboard/dwm' className='inline-flex h-9 items-center rounded-lg bg-[#315fe8] px-3 text-xs font-semibold text-white transition hover:bg-[#426ef0]'>Open dark web cases</Link>
                    <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>Review sources</Link>
                    <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>Configure delivery</Link>
                </div>
            </div>
        </div>
    )
}

function BackedInspection({ item, caseDetail, alertDetail, actionDeliveries, orgContext, compact }: { item: WorkbenchCase, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, actionDeliveries: WorkbenchDeliveryEvidence[], orgContext?: WorkbenchOrgContext, compact: boolean }) {
    const localDeliveries = item.deliveryEvidence || []
    const detailDeliveries = caseDetail?.status === 'ready' ? caseDetail.detail.deliveries || [] : []
    const deliveries = detailDeliveries.length ? detailDeliveries : mergeDeliveryEvidence(actionDeliveries, localDeliveries)
    const blockedDependency = item.missingDependency || (!item.caseDetailHref && item.kind === 'dwm_alert' ? 'Case link is syncing to this alert. Open the dark web case while the live alert record finishes loading.' : '')
    const alertRecord = alertDetail?.status === 'ready' ? alertDetail.detail.alert : undefined
    const alertEvidence = alertRecord?.evidence || []
    const dwmWorkspaceHref = item.kind === 'dwm_alert' ? relatedLinkHref(item, 'Open dark web case') || `/dashboard/dwm?alert=${encodeURIComponent(item.id)}` : ''

    return (
        <section className='rounded-lg border border-[#27364f] bg-[#101827]'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#26344d] px-4 py-3 sm:items-center'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Backed inspection</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Alert detail, case timeline, evidence, delivery attempts, and missing dependencies.</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {dwmWorkspaceHref && (
                        <Link href={dwmWorkspaceHref} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                            Dark web case
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    )}
                    {item.persistent && item.kind === 'dwm_alert' && (
                        <Link href={`/api/dwm/alerts/${encodeURIComponent(item.id)}`} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                            Alert API
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    )}
                    {item.caseDetailHref && (
                        <>
                            <Link href={item.caseDetailHref} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                                Case API
                                <ExternalLink className='h-3.5 w-3.5' />
                            </Link>
                            <Link href={caseExportHref(item.caseDetailHref)} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                                Replay export
                                <ExternalLink className='h-3.5 w-3.5' />
                            </Link>
                        </>
                    )}
                </div>
            </div>
            <div className={`grid gap-3 p-4 ${compact ? 'xl:grid-cols-[0.85fr_1fr]' : 'xl:grid-cols-[0.8fr_1fr]'}`}>
                <div className='grid gap-3'>
                    {alertDetail?.status === 'loading' && <InspectionNotice tone='neutral' title='Loading alert detail' body='Alert detail is updating through the dashboard proxy.' />}
                    {alertDetail?.status === 'error' && <InspectionNotice tone='blocked' title='Alert detail needs attention' body={alertDetail.error} />}
                    {alertRecord ? <AlertDetailSummary alert={alertRecord} fallback={item} /> : null}
                    {alertDetail?.status === 'ready' ? <AlertWorkflowReadiness detail={alertDetail.detail} /> : null}
                    {alertDetail?.status === 'ready' ? <AlertOperationalReadiness detail={alertDetail.detail} /> : null}
                    {caseDetail?.status === 'loading' && <InspectionNotice tone='neutral' title='Loading case detail' body='Case detail is updating through the dashboard proxy.' />}
                    {caseDetail?.status === 'error' && <InspectionNotice tone='blocked' title='Case detail needs attention' body={caseDetail.error} />}
                    {blockedDependency && !caseDetail && <InspectionNotice tone='blocked' title='Case link pending' body={blockedDependency} />}
                    {caseDetail?.status === 'ready' ? (
                        <>
                            <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-[#edf4ff]'>{caseDetail.detail.case?.id || 'case'}</span>
                                    <span className={workflowStatusClass(caseDetail.detail.case?.status === 'closed' ? 'blocked' : 'ready')}>{label(caseDetail.detail.case?.status || 'syncing')}</span>
                                    {caseDetail.detail.access?.role && <span className='rounded-full bg-[#0f1726] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{caseDetail.detail.access.role}</span>}
                                    {caseDetail.detail.access?.visibilityDecision && <span className={workflowStatusClass(caseDetail.detail.access.visibilityDecision.allowed ? 'ready' : 'blocked')}>{caseDetail.detail.access.visibilityDecision.alertVisibilityPolicy}</span>}
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#c4cfdf]'>{caseDetail.detail.case?.summary || 'Case summary is being prepared from the latest evidence.'}</p>
                                <div className='mt-3 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                                    <p><span className='font-semibold text-[#9fb0c8]'>Owner:</span> {caseDetail.detail.case?.assignedOwner || 'unassigned'}</p>
                                    <p><span className='font-semibold text-[#9fb0c8]'>Alert:</span> {caseDetail.detail.case?.alertId || caseDetail.detail.alert?.id || 'none'}</p>
                                    <p><span className='font-semibold text-[#9fb0c8]'>Delivery:</span> {caseDetail.detail.deliveryContext?.deliveryCount ?? 0} attempt(s)</p>
                                    <p><span className='font-semibold text-[#9fb0c8]'>Updated:</span> {relativeTime(caseDetail.detail.case?.updatedAt || caseDetail.detail.generatedAt)}</p>
                                    <p><span className='font-semibold text-[#9fb0c8]'>Mutate:</span> {caseDetail.detail.access?.readOnly ? 'read-only role' : 'allowed'}</p>
                                </div>
                            </div>
                            <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                                <h4 className='text-sm font-semibold text-[#edf4ff]'>Allowed next actions</h4>
                                <div className='mt-2 flex flex-wrap gap-2'>
                                    {(caseDetail.detail.nextAllowedActions || []).map(action => (
                                        <span key={action.id} title={action.disabledReason} className={workflowStatusClass(action.enabled ? 'ready' : 'blocked')}>{action.label}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || []).length && (caseDetail.detail.nextActions || []).map(action => (
                                        <span key={String(action)} className='rounded-full bg-[#0f1726] px-2 py-1 text-[11px] font-semibold text-[#aab7cc]'>{String(action)}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || caseDetail.detail.nextActions || []).length && <span className='text-xs text-[#8fa0ba]'>No more actions for this case state.</span>}
                                </div>
                            </div>
                        </>
                    ) : null}
                    <DeliveryEvidenceRows deliveries={deliveries} selected={item} orgContext={orgContext} />
                </div>
                <div className='grid gap-3'>
                    {caseDetail?.status === 'ready' && (
                        <>
                            <TimelineRows title='Case timeline' rows={caseDetail.detail.timeline || []} />
                            <CaseEvidenceRows evidence={caseDetail.detail.evidence || []} />
                            <CaseWatchlistRows watchlists={caseDetail.detail.watchlists || []} orgContext={orgContext} />
                        </>
                    )}
                    {caseDetail?.status !== 'ready' && alertEvidence.length ? <AlertEvidenceRows evidence={alertEvidence} /> : null}
                    {caseDetail?.status !== 'ready' && alertDetail?.status === 'ready' && alertDetail.detail.timeline?.length ? <TimelineRows title='Alert timeline' rows={alertDetail.detail.timeline} /> : null}
                    {caseDetail?.status !== 'ready' && !deliveries.length && (
                        <InspectionNotice
                            tone='neutral'
                            title='No delivery sent'
                            body='Delivery evidence streams here from webhook tests and alert sends.'
                        />
                    )}
                </div>
            </div>
        </section>
    )
}

function InspectionNotice({ tone, title, body }: { tone: 'neutral' | 'blocked', title: string, body: string }) {
    return (
        <div className={`rounded-lg border p-3 ${tone === 'blocked' ? 'border-[#7a3520] bg-[#2c160f]' : 'border-[#27364f] bg-[#0b121e]'}`}>
            <h4 className={`text-sm font-semibold ${tone === 'blocked' ? 'text-[#ffb598]' : 'text-[#edf4ff]'}`}>{title}</h4>
            <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>{body}</p>
        </div>
    )
}

function DeliveryEvidenceRows({ deliveries, selected, orgContext }: { deliveries: Array<WorkbenchDeliveryEvidence | CaseDelivery>, selected: WorkbenchCase, orgContext?: WorkbenchOrgContext }) {
    if (!deliveries.length) {
        return (
            <InspectionNotice
                tone='blocked'
                title='No webhook delivery yet'
                body='Run a webhook test or send this alert to create delivery evidence.'
            />
        )
    }

    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <h4 className='text-sm font-semibold text-[#edf4ff]'>Webhook delivery evidence</h4>
            <div className='mt-3 grid gap-2'>
                {deliveries.map(delivery => {
                    const ledgerHref = deliveryLedgerHref(orgContext, selected, delivery)
                    return (
                        <div key={delivery.id} className='rounded-lg border border-[#27364f] bg-[#101827] p-3'>
                            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                                <div className='flex min-w-0 flex-wrap items-center gap-2'>
                                    <span className='font-mono text-xs font-semibold text-[#edf4ff]'>{delivery.id}</span>
                                    <span className={workflowStatusClass(delivery.status === 'delivered' || delivery.status === 'dry_run' ? 'ready' : delivery.status === 'failed' || delivery.status === 'skipped' ? 'blocked' : 'needs_action')}>{label(delivery.status)}</span>
                                    {delivery.deliveryKind && <span className='rounded-full bg-[#162033] px-2 py-0.5 text-[11px] font-semibold text-[#7aa5ff]'>{delivery.deliveryKind}</span>}
                                </div>
                                <Link href={ledgerHref} className='inline-flex min-h-8 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a]'>
                                    Open ledger
                                </Link>
                            </div>
                            <div className='mt-2 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                                <p><span className='font-semibold text-[#9fb0c8]'>Alert:</span> {delivery.alertId}</p>
                                <p><span className='font-semibold text-[#9fb0c8]'>Destination:</span> {delivery.webhookDestinationId || 'watchlist url'}</p>
                                <p><span className='font-semibold text-[#9fb0c8]'>Attempted:</span> {relativeTime(delivery.attemptedAt)}</p>
                                {'httpStatus' in delivery && delivery.httpStatus !== undefined && <p><span className='font-semibold text-[#9fb0c8]'>HTTP:</span> {delivery.httpStatus}</p>}
                            </div>
                            <p className='mt-2 break-all font-mono text-[11px] text-[#8fa0ba]'>{delivery.endpointHash} · {delivery.payloadHash}</p>
                            {delivery.error && <p className='mt-2 text-xs font-semibold text-[#ffb598]'>{delivery.error}</p>}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function TimelineRows({ title, rows }: { title: string, rows: CaseTimelineItem[] }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <h4 className='text-sm font-semibold text-[#edf4ff]'>{title}</h4>
            <div className='mt-3 grid gap-3'>
                {rows.map(row => (
                    <div key={row.id} className='grid grid-cols-[auto_1fr] gap-3'>
                        <span className='mt-1 h-2.5 w-2.5 rounded-full bg-[#7aa5ff]' />
                        <div>
                            <p className='text-sm font-semibold text-[#edf4ff]'>{sanitizeWorkbenchCopy(row.title) || row.title}</p>
                            <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>{sanitizeWorkbenchCopy(row.detail) || row.detail}</p>
                            <p className='mt-1 text-[11px] text-[#98a2b3]'>{relativeTime(row.at)}</p>
                        </div>
                    </div>
                ))}
                {!rows.length && <p className='text-xs text-[#8fa0ba]'>Timeline updates with the next case event.</p>}
            </div>
        </div>
    )
}

function AlertDetailSummary({ alert, fallback }: { alert: NonNullable<AlertDetailPayload['alert']>, fallback: WorkbenchCase }) {
    const workflowContext = alert.workflowContext
    const webhookContext = alert.webhookContext
    const caseId = alert.caseId || alert.caseIdCandidate || workflowContext?.caseIdCandidate
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-semibold text-[#edf4ff]'>{alert.id || fallback.id}</span>
                <span className={workflowStatusClass(alert.deliveryState === 'delivered' ? 'ready' : alert.deliveryState ? 'needs_action' : 'blocked')}>{label(alert.deliveryState || 'delivery pending')}</span>
                <span className={workflowStatusClass(caseId ? 'ready' : 'needs_action')}>{caseId ? 'case linked' : 'case needed'}</span>
            </div>
            <div className='mt-3 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                <p><span className='font-semibold text-[#9fb0c8]'>Review:</span> {label(alert.reviewState || fallback.status)}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Owner:</span> {alert.assignedOwner || fallback.owner || 'unassigned'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Case state:</span> {label(alert.workflowStatus || alert.reviewState || fallback.status)}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Organization:</span> {alert.organizationId || workflowContext?.organizationId || 'syncing'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Case:</span> {caseId || 'not linked'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Sources:</span> {alert.sourceCount ?? fallback.sourceLabel}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Updated:</span> {relativeTime(alert.updatedAt || alert.firstSeenAt || fallback.updatedAt)}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Replays:</span> {alert.replayCount ?? 0}{alert.lastReplayedAt ? ` · ${relativeTime(alert.lastReplayedAt)}` : ''}</p>
                <p className='break-all'><span className='font-semibold text-[#9fb0c8]'>Watchlists:</span> {(workflowContext?.watchlistIds || []).join(', ') || 'syncing'}</p>
                <p className='break-all'><span className='font-semibold text-[#9fb0c8]'>Destinations:</span> {(webhookContext?.webhookDestinationIds || workflowContext?.webhookDestinationIds || []).join(', ') || (webhookContext?.hasWebhookRoute ? 'delivery available' : 'syncing')}</p>
            </div>
        </div>
    )
}

function AlertWorkflowReadiness({ detail }: { detail: AlertDetailPayload }) {
    const readiness = detail.workflowExecutionReadiness
    const contract = detail.analystWorkflowContract
    const downstream = detail.downstreamHandoff
    const blockerCodes = [...(readiness?.blockerCodes || []), ...(downstream?.blockerCodes || [])]
        .filter((code, index, source) => source.indexOf(code) === index)
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <div className='flex flex-wrap items-center gap-2'>
                <h4 className='text-sm font-semibold text-[#edf4ff]'>Workflow guard</h4>
                <span className={workflowStatusClass(readiness?.ready === false || blockerCodes.length ? 'blocked' : 'ready')}>{readiness?.ready === false || blockerCodes.length ? 'syncing' : 'ready'}</span>
                {readiness?.action && <span className='rounded-full bg-[#0f1726] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{label(readiness.action)}</span>}
            </div>
            <div className='mt-3 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                <p><span className='font-semibold text-[#9fb0c8]'>Update:</span> {contract?.mutationRoute || '/v1/dwm/alerts/:id'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Replay:</span> {contract?.replayRoute || '/v1/dwm/alerts/:id/replay'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Event count:</span> {readiness?.currentWorkflowEventCount ?? contract?.idempotency?.workflowEventCount ?? 'checking'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Updated:</span> {relativeTime(readiness?.currentUpdatedAt || contract?.idempotency?.updatedAt || detail.alert?.updatedAt || detail.generatedAt || '')}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Delivery route:</span> {downstream?.deliverySelection?.ready === false ? 'checking' : downstream?.deliverySelection?.selectedWebhookDestinationId || 'checking'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Customer delivery:</span> {downstream?.customerStatus?.ready === false ? 'checking' : downstream?.customerStatus?.ready === true ? 'ready' : 'checking'}</p>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
                {blockerCodes.map(code => <span key={code} className={workflowStatusClass('blocked')}>{label(code)}</span>)}
                {!blockerCodes.length && <span className='text-xs text-[#8fa0ba]'>Workflow lane is clear.</span>}
            </div>
            {readiness?.blockers?.length ? (
                <div className='mt-3 grid gap-2'>
                    {readiness.blockers.slice(0, 3).map(blocker => (
                        <p key={`${blocker.code}:${blocker.field}`} className='rounded-md border border-[#7a3520] bg-[#2c160f] px-2 py-1 text-xs text-[#ffb598]'>
                            {label(blocker.code || 'workflow issue')}{blocker.detail ? `: ${blocker.detail}` : ''}
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function AlertOperationalReadiness({ detail }: { detail: AlertDetailPayload }) {
    const next = detail.nextBestAction
    const delivery = detail.deliveryReadiness
    const customerStatus = detail.customerStatusHandoff
    const evidence = detail.evidenceFreshness
    const provenance = detail.provenanceFreshness
    const blockerCodes = [...(delivery?.blockerCodes || []), ...(customerStatus?.blockerCodes || [])]
        .filter((code, index, source) => source.indexOf(code) === index)
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <div className='flex flex-wrap items-center gap-2'>
                <h4 className='text-sm font-semibold text-[#edf4ff]'>Delivery lane</h4>
                <span className={workflowStatusClass(delivery?.ready || customerStatus?.ready ? 'ready' : blockerCodes.length ? 'blocked' : 'needs_action')}>{delivery?.ready || customerStatus?.ready ? 'ready' : blockerCodes.length ? 'syncing' : 'review'}</span>
            </div>
            <div className='mt-3 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                <p><span className='font-semibold text-[#9fb0c8]'>Next:</span> {next?.label || 'Review alert detail.'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Action:</span> {label(next?.action || 'monitor')}{next?.requiresRationale ? ' · rationale required' : ''}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Delivery:</span> {label(delivery?.state || delivery?.lastDeliveryStatus || customerStatus?.deliveryState || 'checking')}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Customer delivery:</span> {customerStatus?.ready || customerStatus?.deliveryReady ? 'ready' : blockerCodes.length ? 'checking' : 'checking'}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Evidence:</span> {evidence?.evidenceCount ?? customerStatus?.evidenceCount ?? delivery?.evidenceCount ?? 0} item(s){evidence?.newestEvidenceAt ? ` · ${relativeTime(evidence.newestEvidenceAt)}` : ''}</p>
                <p><span className='font-semibold text-[#9fb0c8]'>Source details:</span> {(provenance?.sourceIds || []).length} source(s), {(provenance?.captureIds || evidence?.captureIds || delivery?.selectedCaptureIds || customerStatus?.selectedCaptureIds || []).length} capture(s)</p>
            </div>
            {next?.reason ? <p className='mt-3 rounded-md border border-[#27364f] bg-[#101827] px-2 py-1 text-xs leading-5 text-[#aab7cc]'>{next.reason}</p> : null}
            <div className='mt-3 flex flex-wrap gap-2'>
                {blockerCodes.map(code => <span key={code} className={workflowStatusClass('blocked')}>{label(code)}</span>)}
                {!blockerCodes.length && <span className='text-xs text-[#8fa0ba]'>Delivery and customer lanes are clear.</span>}
            </div>
        </div>
    )
}

function AlertEvidenceRows({ evidence }: { evidence: NonNullable<NonNullable<AlertDetailPayload['alert']>['evidence']> }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <h4 className='text-sm font-semibold text-[#edf4ff]'>Alert evidence</h4>
            <div className='mt-3 grid gap-2'>
                {evidence.map((item, index) => {
                    const provenance = typeof item.provenance === 'string'
                        ? item.provenance
                        : [item.provenance?.sourceId, item.provenance?.captureId, item.provenance?.captureMode].filter(Boolean).join(' · ')
                    const sourceHref = typeof item.provenance === 'object' && item.provenance?.sourceId ? sourceProfileHref(item.provenance.sourceId) : undefined
                    return (
                        <div key={item.id || `${item.contentHash || 'alert-evidence'}:${index}`} className='rounded-lg border border-[#27364f] bg-[#101827] p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm font-semibold text-[#edf4ff]'>{item.sourceName || item.sourceFamily || item.id || 'source evidence'}</span>
                                {item.redactionState && <span className='rounded-full bg-[#162033] px-2 py-0.5 text-[11px] font-semibold text-[#7aa5ff]'>{String(item.redactionState).replaceAll('_', ' ')}</span>}
                                {item.captureMode && <span className='rounded-full bg-[#0f1726] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{String(item.captureMode).replaceAll('_', ' ')}</span>}
                                {sourceHref ? (
                                    <Link href={sourceHref} className='inline-flex min-h-7 items-center gap-1 rounded-lg border border-[#27364f] bg-[#0f1726] px-2 py-0.5 text-[11px] font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#7aa5ff]'>
                                        Open source
                                        <ExternalLink className='h-3 w-3' />
                                    </Link>
                                ) : null}
                            </div>
                            <p className='mt-2 text-xs leading-5 text-[#aab7cc]'>{item.excerpt || 'Safe excerpt is being prepared from this evidence.'}</p>
                            <div className='mt-2 grid gap-1 text-xs text-[#8fa0ba]'>
                                <p><span className='font-semibold text-[#9fb0c8]'>Observed:</span> {item.observedAt || item.firstSeenAt ? relativeTime(item.observedAt || item.firstSeenAt || '') : 'checking'}</p>
                                <p className='break-all'><span className='font-semibold text-[#9fb0c8]'>Source details:</span> {customerOperationalText(provenance || 'syncing')}</p>
                            </div>
                            <p className='mt-2 break-all font-mono text-[11px] text-[#8fa0ba]'>{item.contentHash || item.id || 'content hash pending'}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function CaseEvidenceRows({ evidence }: { evidence: CaseEvidence[] }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <h4 className='text-sm font-semibold text-[#edf4ff]'>Case evidence</h4>
            <div className='mt-3 grid gap-2'>
                {evidence.map(item => (
                    <div key={item.id} className='rounded-lg border border-[#27364f] bg-[#101827] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-[#edf4ff]'>{item.sourceName || item.id}</span>
                            {item.redactionState && <span className='rounded-full bg-[#162033] px-2 py-0.5 text-[11px] font-semibold text-[#7aa5ff]'>{String(item.redactionState).replaceAll('_', ' ')}</span>}
                        </div>
                        <p className='mt-2 text-xs leading-5 text-[#aab7cc]'>{item.excerpt || 'Safe excerpt is being prepared from this evidence.'}</p>
                        <p className='mt-2 break-all font-mono text-[11px] text-[#8fa0ba]'>{item.contentHash || item.id}</p>
                    </div>
                ))}
                {!evidence.length && <p className='text-xs text-[#8fa0ba]'>Evidence stream updates with the next normalized capture.</p>}
            </div>
        </div>
    )
}

function CaseWatchlistRows({ watchlists, orgContext }: { watchlists: CaseWatchlist[], orgContext?: WorkbenchOrgContext }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                <h4 className='text-sm font-semibold text-[#edf4ff]'>Watchlist routing</h4>
                <Link href={watchlistLedgerHref(orgContext)} className='inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 py-1 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#7aa5ff]'>
                    Open watchlists
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
            <div className='mt-3 grid gap-2'>
                {watchlists.map(watchlist => (
                    <div key={watchlist.id} className='rounded-lg border border-[#27364f] bg-[#101827] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='wrap-break-word text-sm font-semibold text-[#edf4ff]'>{watchlist.name || watchlist.id}</span>
                            <span className={workflowStatusClass(watchlist.status === 'active' ? 'ready' : 'needs_action')}>{label(watchlist.status)}</span>
                            {watchlist.hasWebhookUrl || watchlist.webhookDestinationId ? <span className='rounded-full bg-[#162033] px-2 py-0.5 text-[11px] font-semibold text-[#7aa5ff]'>delivery routed</span> : null}
                        </div>
                        <div className='mt-2 grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2'>
                            <p><span className='font-semibold text-[#9fb0c8]'>Terms:</span> {watchlist.termCount ?? watchlist.matchedTerms?.length ?? 0}</p>
                            <p className='break-all'><span className='font-semibold text-[#9fb0c8]'>Destination:</span> {watchlist.webhookDestinationId || (watchlist.hasWebhookUrl ? 'watchlist webhook url' : 'syncing')}</p>
                            <p className='break-all sm:col-span-2'><span className='font-semibold text-[#9fb0c8]'>Matched:</span> {(watchlist.matchedTerms || []).map(term => `${term.kind || 'term'}:${term.value || 'syncing'}`).join(', ') || 'match stream is checking'}</p>
                        </div>
                    </div>
                ))}
                {!watchlists.length && <p className='text-xs leading-5 text-[#8fa0ba]'>Watchlist routing appears here when the case is tied to customer terms.</p>}
            </div>
        </div>
    )
}

function CaseActionRail({ item, note, owner, effectiveStatus, busyAction, caseDetail, sendDisabledReason, onDecision, onBackedCaseMutation, onCustomerNotification, onReplay, onSend }: {
    item: WorkbenchCase
    note: string
    owner: string
    effectiveStatus: string
    busyAction: string | null
    caseDetail?: CaseDetailState
    sendDisabledReason?: string
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const readyCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const hasBackedCase = Boolean(readyCase)
    const hasBackedAlertWorkflow = item.kind === 'dwm_alert' && item.persistent
    const busy = Boolean(busyAction)
    const closeAction = effectiveStatus === 'closed' ? 'reopen' : 'close'

    if (!hasBackedCase) {
        return (
            <div className='grid gap-2 rounded-lg border border-[#7a3520] bg-[#2c160f] p-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#ffb598]'>{hasBackedAlertWorkflow ? 'Backed alert workflow' : 'Session-local triage'}</p>
                    <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>
                        {hasBackedAlertWorkflow
                            ? 'Updates the persisted alert and refreshes detail. Case actions unlock when a case is linked.'
                            : item.missingDependency || 'Live case detail or persisted DWM alert is syncing. These controls only update this browser session until then.'}
                    </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'reviewing', owner, reason: note || 'Review started.' })}>Review</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'escalated', owner, reason: note || 'Escalated for customer or incident response.' })}>Escalate</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'suppressed', owner, reason: note || 'Suppressed as low-value or false positive.' })}>Suppress</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: effectiveStatus === 'closed' ? 'needs_review' : 'closed', owner, reason: note || (effectiveStatus === 'closed' ? 'Reopened for review.' : 'Closed in recent attacks.') })}>
                        {effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    </DecisionButton>
                    {item.kind === 'dwm_alert' && (
                        <>
                            <DecisionButton busy={busy || busyAction === `replay:${item.id}`} disabledReason={hasBackedAlertWorkflow ? undefined : 'Replay requires a persistent /api/dwm/alerts/:id alert.'} onClick={onReplay}>Replay</DecisionButton>
                            <DecisionButton busy={busy || busyAction === `send:${item.id}`} disabledReason={sendDisabledReason || (hasBackedAlertWorkflow ? undefined : 'Send requires a persistent alert and webhook delivery route.')} onClick={onSend}>Send</DecisionButton>
                        </>
                    )}
                </div>
            </div>
        )
    }

    const hasOwner = owner.trim() && owner.trim() !== 'unassigned'
    const noteText = note.trim()
    const notificationState = customerNotificationActionState(caseDetail)
    return (
        <div className='grid gap-2 rounded-lg border border-[#1f6f48] bg-[#0c261c] p-3'>
            <div>
                <p className='text-xs font-semibold uppercase text-[#147a3b]'>Live case actions</p>
                <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>Updates the selected case and refreshes the detail pane.</p>
                {item.caseDetailHref && <p className='mt-1 text-xs leading-5 text-[#aab7cc]'>Case export includes evidence, timeline, delivery, and next actions.</p>}
            </div>
            <div className='flex flex-wrap gap-2'>
                <CaseMutationButton
                    item={item}
                    action='assign'
                    label='Assign owner'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!hasOwner ? 'Owner is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'assign', assignedOwner: owner.trim(), note: noteText || `Assigned to ${owner.trim()}.` })}
                />
                <CaseMutationButton
                    item={item}
                    action='note'
                    label='Add note'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Decision rationale is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'note', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action='review'
                    label='Start review'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Review requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'review', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action='escalate'
                    label='Escalate'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Escalation requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'escalate', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Escalated for customer or incident response.' })}
                />
                <CaseMutationButton
                    item={item}
                    action='suppress'
                    label='Suppress'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Suppression requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'suppress', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Suppressed as low-value or false positive.' })}
                />
                <CaseMutationButton
                    item={item}
                    action='false_positive'
                    label='False positive'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'False-positive decision requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'false_positive', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action={closeAction}
                    label={effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={closeAction === 'close' && !noteText ? 'Closing requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: closeAction, assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || (closeAction === 'reopen' ? 'Reopened for review.' : 'Closed from recent attacks.') })}
                />
                <DecisionButton
                    busy={busy || busyAction === `case:${item.id}:customer_notification`}
                    onClick={onCustomerNotification}
                    disabledReason={notificationState.disabledReason || (!noteText ? 'Customer notification receipt requires decision rationale.' : undefined)}
                >
                    Record notification
                </DecisionButton>
                {item.kind === 'dwm_alert' && (
                    <>
                        <DecisionButton busy={busy || busyAction === `replay:${item.id}`} onClick={onReplay}>Replay</DecisionButton>
                        <DecisionButton busy={busy || busyAction === `send:${item.id}`} disabledReason={sendDisabledReason} onClick={onSend}>Send</DecisionButton>
                    </>
                )}
            </div>
        </div>
    )
}

function CaseMutationButton({ item, action, label: actionLabel, busy, busyAction, allowedActions, disabledReason, onClick }: {
    item: WorkbenchCase
    action: WorkbenchCaseMutationAction
    label: string
    busy: boolean
    busyAction: string | null
    allowedActions: CaseAllowedAction[]
    disabledReason?: string
    onClick: () => void | Promise<void>
}) {
    const allowed = allowedActions.find(candidate => candidate.id === action)
    const blockedReason = disabledReason || allowed?.disabledReason || (allowed && !allowed.enabled ? 'Not applicable for current case status.' : undefined)
    const disabled = busy || Boolean(blockedReason)
    return (
        <button
            type='button'
            data-detail-action={action}
            onClick={onClick}
            disabled={disabled}
            title={blockedReason}
            className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
        >
            {busyAction === `case:${item.id}:${action}` ? 'Saving...' : actionLabel}
        </button>
    )
}

function CaseDetail({ item, decision, note, ownerDraft, busyAction, compact, caseDetail, alertDetail, actionDeliveries, orgContext, actionMessage, onNoteChange, onOwnerDraftChange, onDecision, onBackedCaseMutation, onCustomerNotification, onReplay, onSend }: {
    item: WorkbenchCase
    decision?: LocalDecision
    note: string
    ownerDraft?: string
    busyAction: string | null
    compact: boolean
    caseDetail?: CaseDetailState
    alertDetail?: AlertDetailState
    actionDeliveries: WorkbenchDeliveryEvidence[]
    orgContext?: WorkbenchOrgContext
    actionMessage: WorkbenchActionOutcome | null
    onNoteChange: (value: string) => void
    onOwnerDraftChange: (value: string) => void
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onCustomerNotification: () => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const backedCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const backedStatus = backedCase?.status
    const backedOwner = backedCase?.assignedOwner || 'unassigned'
    const effectiveStatus = decision?.status ?? backedStatus ?? item.status
    const effectiveOwner = decision?.owner ?? backedOwner ?? item.owner
    const ownerValue = ownerDraft ?? (effectiveOwner === 'unassigned' ? '' : effectiveOwner)
    const assignableMembers = orgContext?.members.filter(member => member.status === 'active' && member.role !== 'viewer') || []
    const readOnly = caseDetail?.status === 'ready' && caseDetail.detail.access?.readOnly === true
    const sendDisabledReason = sendDeliveryDisabledReason(item, orgContext)
    return (
        <div className={`${compact ? 'grid gap-4 p-4' : 'grid gap-5 p-5'}`}>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={severityClass(item.severity)}>{item.severity}</span>
                        <span className='rounded-full bg-[#162033] px-2 py-0.5 text-xs font-semibold text-[#7aa5ff]'>{item.confidence}% confidence</span>
                        <span className='rounded-full bg-[#15284b] px-2 py-0.5 text-xs font-semibold text-[#9fb0c8]'>{label(item.kind)}</span>
                        <span className='rounded-full bg-[#0f1726] px-2 py-0.5 text-xs font-semibold text-[#aab7cc]'>{label(effectiveStatus)}</span>
                        {item.persistent && <span className='rounded-full bg-[#0c261c] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'>persistent workflow</span>}
                    </div>
                    <h2 className={`${compact ? 'mt-2 text-xl' : 'mt-3 text-2xl'} font-semibold tracking-normal text-[#edf4ff]`}>{item.title}</h2>
                    <p className='mt-1 text-sm text-[#aab7cc]'>{item.queue} · {item.routeLabel} · {relativeTime(item.updatedAt)}</p>
                </div>
                <div className='grid gap-1 rounded-lg border border-[#27364f] bg-[#0b121e] px-3 py-2 text-xs text-[#8fa0ba]'>
                    <span className='font-semibold text-[#edf4ff]'>{effectiveOwner}</span>
                    <span>{item.company || item.matchedTerm}</span>
                </div>
            </div>

            <SelectedWorkflowHandoff
                item={item}
                caseDetail={caseDetail}
                alertDetail={alertDetail}
                actionDeliveries={actionDeliveries}
                orgContext={orgContext}
            />

            <section className='grid gap-3 rounded-lg border border-[#26344d] bg-[#0b121e] p-4 lg:grid-cols-[0.48fr_minmax(0,1fr)]'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <UserRound className='h-4 w-4 text-[#7aa5ff]' />
                        Owner
                    </span>
                    {assignableMembers.length ? (
                        <select
                            value={ownerValue}
                            onChange={event => onOwnerDraftChange(event.target.value)}
                            disabled={readOnly}
                            className='h-10 rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <option value=''>Unassigned</option>
                            {assignableMembers.map(member => (
                                <option key={member.id} value={member.email}>{member.email} ({member.role})</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            value={ownerValue}
                            onChange={event => onOwnerDraftChange(event.target.value)}
                            placeholder='Assign analyst'
                            className='h-10 rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                        />
                    )}
                    <span className='text-[11px] text-[#8fa0ba]'>
                        {assignableMembers.length
                            ? readOnly ? 'Member picker is read-only for this case.' : 'Assign owner saves to the active case.'
                            : 'Assignable teammate state is loading; manual owner text stays available.'}
                    </span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <MessageSquareText className='h-4 w-4 text-[#7aa5ff]' />
                        Decision rationale
                    </span>
                    <textarea
                        value={note}
                        onChange={event => onNoteChange(event.target.value)}
                        placeholder='Record validation, customer route, suppression reason, or follow-up owner'
                        className='min-h-20 resize-y rounded-lg border border-[#27364f] bg-[#0f1726] px-3 py-2 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                </label>
                <CaseActionRail
                    item={item}
                    note={note}
                    owner={ownerValue.trim() || effectiveOwner}
                    effectiveStatus={effectiveStatus}
                    busyAction={busyAction}
                    caseDetail={caseDetail}
                    sendDisabledReason={sendDisabledReason}
                    onDecision={onDecision}
                    onBackedCaseMutation={onBackedCaseMutation}
                    onCustomerNotification={onCustomerNotification}
                    onReplay={onReplay}
                    onSend={onSend}
                />
            </section>

            <section className='grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]'>
                <BackedInspection item={item} caseDetail={caseDetail} alertDetail={alertDetail} actionDeliveries={actionDeliveries} orgContext={orgContext} compact={compact} />
                <CaseContinuityPanel
                    item={item}
                    decision={decision}
                    caseDetail={caseDetail}
                    actionMessage={actionMessage}
                    orgContext={orgContext}
                />
            </section>

        </div>
    )
}

function SelectedWorkflowHandoff({ item, caseDetail, alertDetail, actionDeliveries, orgContext }: {
    item: WorkbenchCase
    caseDetail?: CaseDetailState
    alertDetail?: AlertDetailState
    actionDeliveries: WorkbenchDeliveryEvidence[]
    orgContext?: WorkbenchOrgContext
}) {
    const steps = selectedWorkflowHandoffSteps(item, caseDetail, alertDetail, actionDeliveries, orgContext)
    const readyCount = steps.filter(step => step.status === 'ready').length
    const blockedCount = steps.filter(step => step.status === 'blocked').length
    const nextBlocked = steps.find(step => step.status === 'blocked' || step.status === 'needs_action')

    return (
        <section data-selected-workflow-handoff='true' className='overflow-hidden rounded-lg border border-[#27364f] bg-[#0f1726]'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#26344d] bg-[#101827] px-4 py-3 sm:items-center'>
                <div className='min-w-0'>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Investigation lanes</h3>
                    <p className='mt-0.5 wrap-break-word text-xs text-[#8fa0ba]'>What is ready, what is being prepared, and what can be sent next.</p>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs'>
                    <span className={workflowStatusClass(blockedCount ? 'blocked' : readyCount === steps.length ? 'ready' : 'needs_action')}>{readyCount}/{steps.length} ready</span>
                    {nextBlocked ? <span className='wrap-break-word text-[#8fa0ba] '>Next: {nextBlocked.label}</span> : null}
                </div>
            </div>
            <div className='grid min-w-0 gap-2 p-3 md:grid-cols-2'>
                {steps.map(step => (
                    <div key={step.id} data-selected-workflow-step={step.id} data-selected-workflow-state={step.status} className='grid min-w-0 gap-2 rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2 sm:items-center'>
                            <h4 className='wrap-break-word text-sm font-semibold text-[#edf4ff]'>{step.label}</h4>
                            <span className={`${workflowStatusClass(step.status)} shrink-0`}>{label(step.status)}</span>
                        </div>
                        <p className='wrap-break-word text-xs leading-5 text-[#aab7cc]'>{step.detail}</p>
                        <p className='wrap-break-word text-[11px] text-[#8fa0ba]'><span className='font-semibold text-[#9fb0c8]'>Signal:</span> {operatorSourceLabel(step.source)}</p>
                        {step.href ? (
                            <Link href={step.href} className='inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 justify-self-start rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 py-1 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#7aa5ff]'>
                                <span className='truncate'>{step.actionLabel}</span>
                                <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                            </Link>
                        ) : (
                            <span className={`${workflowStatusClass(step.status)} wrap-break-word justify-self-start`}>{step.blockedReason}</span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

function selectedWorkflowHandoffSteps(item: WorkbenchCase, caseDetail: CaseDetailState | undefined, alertDetail: AlertDetailState | undefined, actionDeliveries: WorkbenchDeliveryEvidence[], orgContext: WorkbenchOrgContext | undefined): Array<{
    id: string
    label: string
    status: WorkbenchWorkflowStep['status']
    detail: string
    source: string
    href?: string
    actionLabel: string
    blockedReason: string
}> {
    const detail = caseDetail?.status === 'ready' ? caseDetail.detail : undefined
    const caseHref = item.caseDetailHref
    const alertHref = item.kind === 'dwm_alert' && item.persistent ? `/api/dwm/alerts/${encodeURIComponent(item.id)}` : undefined
    const alertRecord = alertDetail?.status === 'ready' ? alertDetail.detail.alert : undefined
    const sourceHref = alertSourceProfileHref(alertDetail?.status === 'ready' ? alertDetail.detail : undefined) || relatedLinkHref(item, 'Open source') || relatedLinkHref(item, 'Review sources')
    const delivery = latestDeliveryForActionRail(item, caseDetail, actionDeliveries, orgContext)
    const deliveryHref = deliveryLedgerHref(orgContext, item, delivery)
    const watchlistCount = detail?.watchlists?.length || orgContext?.watchlists.length || 0
    const activeWatchlistCount = (detail?.watchlists || orgContext?.watchlists || []).filter(watchlist => watchlist.status === 'active').length
    const delivered = delivery?.status === 'delivered' || detail?.deliveryContext?.delivered
    const activeDestination = orgContext?.webhookDestinations.find(destination => destination.status === 'active')
    const caseStatus: WorkbenchWorkflowStep['status'] = caseDetail?.status === 'loading'
        ? 'needs_action'
        : detail?.case
            ? 'ready'
            : caseHref || item.kind === 'dwm_alert'
                ? 'needs_action'
                : 'blocked'
    const evidenceCount = (detail?.evidence?.length || 0) + item.evidence.length + (alertRecord?.evidence?.length || 0)
    const evidenceStatus: WorkbenchWorkflowStep['status'] = evidenceCount ? 'ready' : sourceHref || item.kind === 'dwm_alert' ? 'needs_action' : 'blocked'
    const watchlistStatus: WorkbenchWorkflowStep['status'] = activeWatchlistCount ? 'ready' : watchlistCount || item.kind === 'dwm_alert' ? 'needs_action' : 'blocked'
    const deliveryStatus: WorkbenchWorkflowStep['status'] = delivered ? 'ready' : delivery || activeDestination || item.kind === 'dwm_alert' ? 'needs_action' : 'blocked'

    return [
        {
            id: 'alert',
            label: 'Alert',
            status: alertHref || alertRecord ? 'ready' : 'needs_action',
            detail: alertRecord ? `${label(alertRecord.reviewState || item.status)}; ${alertRecord.sourceCount ?? item.sourceLabel} source${alertRecord.sourceCount === 1 ? '' : 's'}.` : item.persistent ? 'Open the saved alert before customer routing.' : 'Save the alert before customer routing.',
            source: item.persistent ? 'Saved alert record' : 'Selected case',
            href: alertHref,
            actionLabel: 'Open alert',
            blockedReason: item.kind === 'dwm_alert' ? 'Saved alert needed' : 'Alert needs saving',
        },
        {
            id: 'case',
            label: 'Case',
            status: caseStatus,
            detail: detail?.case ? `${label(detail.case.status || item.status)}; owner ${detail.case.assignedOwner || item.owner || 'unassigned'}.` : caseHref ? 'Case file is loading.' : item.missingDependency || 'Case file is connecting to this alert.',
            source: 'Case file',
            href: caseHref,
            actionLabel: 'Open case',
            blockedReason: 'Case file needed',
        },
        {
            id: 'evidence',
            label: 'Evidence',
            status: evidenceStatus,
            detail: `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} active${sourceHref ? '; source drill-in available.' : '.'}`,
            source: detail?.evidence?.length ? 'Case evidence' : alertRecord?.evidence?.length ? 'Saved alert evidence' : 'Selected evidence',
            href: sourceHref || alertHref || caseHref,
            actionLabel: sourceHref ? 'Inspect source' : 'Open evidence',
            blockedReason: 'Evidence source needed',
        },
        {
            id: 'watchlist',
            label: 'Watchlist',
            status: watchlistStatus,
            detail: activeWatchlistCount ? `${activeWatchlistCount} active watchlist${activeWatchlistCount === 1 ? '' : 's'} routed.` : watchlistCount ? `${watchlistCount} watchlist${watchlistCount === 1 ? '' : 's'} staged but paused.` : 'Watchlist routing is syncing.',
            source: detail?.watchlists?.length ? 'Case watchlist' : 'Customer watchlist',
            href: watchlistLedgerHref(orgContext),
            actionLabel: 'Open watchlists',
            blockedReason: 'Watchlist routing needed',
        },
        {
            id: 'delivery',
            label: 'Delivery',
            status: deliveryStatus,
            detail: delivery ? `${label(delivery.status)} delivery ${delivery.id}.` : activeDestination ? `Destination ${activeDestination.id} is active; send or test to create delivery evidence.` : 'Delivery destination is not connected yet.',
            source: 'Delivery ledger',
            href: deliveryHref,
            actionLabel: 'Open delivery',
            blockedReason: 'Delivery destination needed',
        },
    ]
}

function CaseContinuityPanel({ item, decision, caseDetail, actionMessage, orgContext }: { item: WorkbenchCase, decision?: LocalDecision, caseDetail?: CaseDetailState, actionMessage: WorkbenchActionOutcome | null, orgContext?: WorkbenchOrgContext }) {
    const detail = caseDetail?.status === 'ready' ? caseDetail.detail : undefined
    const caseRecord = detail?.case
    const workflowEvents = [...(caseRecord?.workflowEvents || []), ...(detail?.alertContext?.workflowEvents || [])]
    const replayExport = caseReplayExportState(item, caseDetail)
    const ownerEvents = workflowEvents
        .filter(event => event.toOwner || event.fromOwner || event.action === 'assign')
        .slice(-4)
        .reverse()
    const noteEvents = workflowEvents
        .filter(event => event.note)
        .slice(-4)
        .reverse()
    const visibility = detail?.access?.visibilityDecision
    const allowedActions = detail?.nextAllowedActions || []
    const notificationContext = detail?.customerNotificationContext
    const notificationDelivery = notificationContext?.latest?.webhookDeliveryId ? {
        id: notificationContext.latest.webhookDeliveryId,
        alertId: item.id,
        status: notificationContext.latest.webhookStatus || 'recorded',
        deliveryKind: notificationContext.latest.deliveryMode,
        attemptedAt: notificationContext.latest.at,
        webhookDestinationId: notificationContext.latest.webhookDestinationId,
        endpointHash: 'receipt_endpoint_hash_not_returned',
        payloadHash: 'receipt_payload_hash_not_returned',
    } : undefined
    const notificationLedgerHref = notificationDelivery ? deliveryLedgerHref(orgContext, item, notificationDelivery) : undefined
    const latestTimeline = (detail?.timeline || [])
        .filter(row => row.rationale || row.toOwner || row.toStatus || row.eventType)
        .slice(-5)
        .reverse()
    const refreshText = caseDetail?.status === 'loading'
        ? 'refreshing /api/cases/:id'
        : caseDetail?.status === 'error'
            ? caseDetail.error
            : detail
                ? `refreshed ${relativeTime(detail.generatedAt)}`
                : item.caseDetailHref ? 'case detail loading' : item.missingDependency || 'case link pending'

    return (
        <section className='rounded-lg border border-[#26344d] bg-[#0f1726]'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#26344d] px-4 py-3 sm:items-center'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Continuity</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Assignee changes, rationale, action outcome, allowed moves, visibility, and refresh state.</p>
                </div>
                <span className={workflowStatusClass(caseDetail?.status === 'error' || (!detail && !item.caseDetailHref) ? 'blocked' : caseDetail?.status === 'loading' ? 'needs_action' : 'ready')}>{caseDetail?.status || (item.caseDetailHref ? 'pending' : 'syncing')}</span>
            </div>
            <div className='grid gap-3 p-4 xl:grid-cols-[0.85fr_1fr_0.85fr]'>
                <div className='grid gap-3'>
                    <ContinuityBlock title='Assignee history'>
                        <p className='text-xs text-[#8fa0ba]'>Latest owner: <span className='font-semibold text-[#dbe7ff]'>{caseRecord?.assignedOwner || item.owner || 'unassigned'}</span></p>
                        <div className='mt-2 grid gap-2'>
                            {ownerEvents.map(event => (
                                <ContinuityEvent key={event.id} title={event.toOwner || event.fromOwner || event.action} detail={`${event.fromOwner || 'unassigned'} -> ${event.toOwner || caseRecord?.assignedOwner || 'unassigned'} · ${event.actor || 'actor syncing'}`} at={event.at} />
                            ))}
                            {!ownerEvents.length && <p className='text-xs leading-5 text-[#8fa0ba]'>Assignment history is live; latest owner is shown above.</p>}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Visibility decision'>
                        <p className='text-xs leading-5 text-[#8fa0ba]'>
                            {visibility ? `${visibility.allowed ? 'Visible' : 'Needs access'} under ${visibility.alertVisibilityPolicy}; roles ${visibility.allowedRoles.join(', ')}${visibility.reason ? `; reason ${visibility.reason}` : ''}.` : 'Visibility check is loading the case access decision.'}
                        </p>
                        <p className='mt-2 text-xs text-[#8fa0ba]'>Mutations: <span className='font-semibold text-[#dbe7ff]'>{detail?.access?.readOnly ? 'read-only' : detail ? 'allowed' : 'requires case detail'}</span></p>
                    </ContinuityBlock>
                </div>
                <ContinuityBlock title='Rationale timeline'>
                    <div className='grid gap-2'>
                        {noteEvents.map(event => (
                            <ContinuityEvent key={event.id} title={label(event.action)} detail={event.note || 'No rationale'} at={event.at} />
                        ))}
                        {caseRecord?.lastDecision && <p className='rounded-lg border border-[#27364f] bg-[#101827] p-2 text-xs leading-5 text-[#aab7cc]'>Last decision: {caseRecord.lastDecision}</p>}
                        {decision?.status && <p className='rounded-lg border border-[#7a3520] bg-[#2c160f] p-2 text-xs leading-5 text-[#aab7cc]'>Session-local: {label(decision.status)}{decision.reason ? ` · ${decision.reason}` : ''}</p>}
                        {!noteEvents.length && !caseRecord?.lastDecision && !decision?.status && <p className='text-xs leading-5 text-[#8fa0ba]'>Rationale timeline is watching for the first analyst note or decision.</p>}
                    </div>
                </ContinuityBlock>
                <div className='grid gap-3'>
                    <ContinuityBlock title='Action outcome'>
                        <p className={`text-xs leading-5 ${actionMessage ? actionMessage.ok ? 'text-[#147a3b]' : 'text-[#ffb598]' : 'text-[#8fa0ba]'}`}>
                            {actionMessage?.text || 'Console actions stream here.'}
                        </p>
                        <p className='mt-2 text-xs text-[#8fa0ba]'>Refresh: {refreshText}</p>
                    </ContinuityBlock>
                    <ContinuityBlock title='Replay export'>
                        <div data-case-replay-export-state={replayExport.status} className='grid gap-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className={workflowStatusClass(replayExport.status)}>{label(replayExport.status)}</span>
                                <span className='text-xs text-[#8fa0ba]'>{replayExport.detail}</span>
                            </div>
                            <div className='grid gap-1 text-xs text-[#8fa0ba] sm:grid-cols-2 xl:grid-cols-1'>
                                <p><span className='font-semibold text-[#9fb0c8]'>Events:</span> {replayExport.workflowEventCount}</p>
                                <p><span className='font-semibold text-[#9fb0c8]'>Timeline:</span> {replayExport.timelineCount}</p>
                                <p><span className='font-semibold text-[#9fb0c8]'>Delivery rows:</span> {replayExport.deliveryCount}</p>
                                <p><span className='font-semibold text-[#9fb0c8]'>Action payloads:</span> {replayExport.nextActionCount}</p>
                            </div>
                            {replayExport.href ? (
                                <Link href={replayExport.href} className='inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 py-1 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#7aa5ff]'>
                                    <span className='truncate'>Open replay export</span>
                                    <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                                </Link>
                            ) : null}
                            {replayExport.blockers.length ? (
                                <div className='flex flex-wrap gap-2'>
                                    {replayExport.blockers.map(blocker => <span key={blocker} className={workflowStatusClass('blocked')}>{label(blocker)}</span>)}
                                </div>
                            ) : null}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Next allowed actions'>
                        <div className='flex flex-wrap gap-2'>
                            {allowedActions.map(action => (
                                <span key={action.id} title={action.disabledReason} className={workflowStatusClass(action.enabled ? 'ready' : 'blocked')}>{action.label}</span>
                            ))}
                            {!allowedActions.length && <span className='text-xs text-[#8fa0ba]'>Action matrix is clear for this case state.</span>}
                        </div>
                    </ContinuityBlock>
                    <ContinuityBlock title='Customer notification'>
                        <p className='text-xs leading-5 text-[#8fa0ba]'>
                            {notificationContext?.notified
                                ? `Recorded ${notificationContext.notificationCount} notification${notificationContext.notificationCount === 1 ? '' : 's'}; latest ${notificationContext.latest?.id || 'delivery'} via ${label(notificationContext.latest?.deliveryMode || notificationContext.modes?.[0] || 'webhook_delivery')}.`
                                : detail ? 'Customer notification has not been recorded for this case yet.' : 'Delivery state streams after case detail loads.'}
                        </p>
                        {notificationLedgerHref ? (
                            <Link href={notificationLedgerHref} className='mt-2 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#0f1726] px-2.5 py-1 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#7aa5ff]'>
                                <span className='truncate'>Open delivery history</span>
                                <ExternalLink className='h-3.5 w-3.5 shrink-0' />
                            </Link>
                        ) : null}
                    </ContinuityBlock>
                    <ContinuityBlock title='Recent audit'>
                        <div className='grid gap-2'>
                            {latestTimeline.slice(0, 3).map(row => (
                                <ContinuityEvent key={row.id} title={row.title} detail={row.detail || row.rationale || row.eventType || 'case event'} at={row.at} />
                            ))}
                            {!latestTimeline.length && <p className='text-xs leading-5 text-[#8fa0ba]'>Timeline stream updates with case events.</p>}
                        </div>
                    </ContinuityBlock>
                </div>
            </div>
        </section>
    )
}

function ContinuityBlock({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#0b121e] p-3'>
            <h4 className='text-xs font-semibold uppercase text-[#8fa0ba]'>{title}</h4>
            <div className='mt-2'>{children}</div>
        </div>
    )
}

function ContinuityEvent({ title, detail, at }: { title: string, detail: string, at?: string }) {
    return (
        <div className='rounded-lg border border-[#27364f] bg-[#101827] p-2'>
            <p className='text-xs font-semibold text-[#edf4ff]'>{title}</p>
            <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>{detail}</p>
            {at && <p className='mt-1 text-[11px] text-[#98a2b3]'>{relativeTime(at)}</p>}
        </div>
    )
}

type LocalDecision = {
    status?: string
    owner?: string
    reason?: string
    decidedAt?: string
}

type CaseMutationInput = {
    action: WorkbenchCaseMutationAction
    note?: string
    assignedOwner?: string
}

type CaseDetailState =
    | { status: 'loading' }
    | { status: 'ready', detail: CaseDetailPayload }
    | { status: 'error', error: string }

type CaseDetailPayload = {
    schemaVersion?: string
    generatedAt: string
    error?: { message?: string }
    organization?: { id?: string, name?: string, alertVisibilityPolicy?: 'members' | 'admins' | 'owners' }
    access?: {
        mode?: string
        memberId?: string
        role?: string
        readOnly?: boolean
        canMutate?: boolean
        visibilityDecision?: CaseVisibilityDecision
    }
    case?: {
        id: string
        alertId?: string
        title?: string
        summary?: string
        status?: string
        priority?: string
        assignedOwner?: string
        createdAt?: string
        updatedAt: string
        closedAt?: string
        lastDecision?: string
        workflowEvents?: CaseWorkflowEvent[]
    }
    alert?: { id?: string, sourceFamily?: string, sourceCount?: number, reviewState?: string, deliveryState?: string, matchedTerm?: { value?: string, kind?: string } }
    alertContext?: {
        id?: string
        reviewState?: string
        deliveryState?: string
        assignedOwner?: string
        workflowNote?: string
        workflowEvents?: CaseWorkflowEvent[]
    }
    deliveryContext?: {
        deliveryCount: number
        latestDelivery?: CaseDelivery
        delivered?: boolean
        retryable?: boolean
        failed?: CaseDelivery[]
    }
    customerNotificationContext?: {
        notificationCount: number
        notified: boolean
        latest?: CaseCustomerNotificationReceipt
        modes?: string[]
    }
    deliveries?: CaseDelivery[]
    evidence?: CaseEvidence[]
    timeline?: CaseTimelineItem[]
    watchlists?: CaseWatchlist[]
    nextActions?: string[]
    nextAllowedActions?: CaseAllowedAction[]
}

type CaseVisibilityDecision = {
    allowed: boolean
    reason: string | null
    alertVisibilityPolicy: 'members' | 'admins' | 'owners'
    allowedRoles: string[]
}

type CaseWatchlist = {
    id: string
    organizationId?: string
    tenantId: string
    name: string
    status: string
    webhookDestinationId?: string
    hasWebhookUrl?: boolean
    matchedTerms?: Array<{ value?: string, kind?: string }>
    termCount?: number
}

type CaseAllowedAction = {
    id: WorkbenchCaseMutationAction | 'deliver_webhook'
    label: string
    method: 'PATCH' | 'POST'
    requiresRationale?: boolean
    enabled: boolean
    disabledReason?: string
}

type CaseDelivery = WorkbenchDeliveryEvidence & {
    dryRun?: boolean
}

type CaseCustomerNotificationReceipt = {
    id: string
    at: string
    deliveryMode: 'webhook_delivery' | 'manual_handoff'
    rationale?: string
    webhookDeliveryId?: string
    webhookDestinationId?: string
    webhookStatus?: string
    externalReference?: string
}

type CaseEvidence = {
    id: string
    sourceName?: string
    redactionState?: string
    contentHash?: string
    excerpt?: string
}

type CaseTimelineItem = {
    id: string
    at: string
    title: string
    detail: string
    eventType?: string
    actor?: string
    rationale?: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
}

type CaseWorkflowEvent = {
    id: string
    at: string
    actor?: string
    action: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
    note?: string
}

function DecisionButton({ busy = false, disabledReason, onClick, children }: { busy?: boolean, disabledReason?: string, onClick: () => void | Promise<void>, children: string }) {
    const disabled = busy || Boolean(disabledReason)
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={disabledReason} className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#0f1726] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60'>
            {children}
        </button>
    )
}

async function readCaseDetailJson(response: Response) {
    try {
        return await response.json() as CaseDetailPayload
    } catch {
        return { generatedAt: new Date().toISOString(), error: { message: 'Case detail response was not JSON.' } }
    }
}

async function readAlertDetailJson(response: Response) {
    try {
        return await response.json() as AlertDetailPayload
    } catch {
        return { generatedAt: new Date().toISOString(), error: { message: 'Alert detail response was not JSON.' } }
    }
}

async function readJson(response: Response) {
    try {
        return await response.json() as WorkbenchApiPayload
    } catch {
        return {}
    }
}

function deliveryEvidenceFromPayload(payload: WorkbenchApiPayload | undefined, fallbackAlertId: string) {
    const attemptedAt = payload?.deliveredAt || payload?.testedAt || new Date().toISOString()
    return deliveryCandidatesFromPayload(payload)
        .map(delivery => normalizeDeliveryEvidence(delivery, fallbackAlertId, attemptedAt))
        .filter((delivery): delivery is WorkbenchDeliveryEvidence => Boolean(delivery))
}

function deliveryCandidatesFromPayload(payload: WorkbenchApiPayload | undefined): Array<Partial<WorkbenchDeliveryEvidence> & { dryRun?: boolean } | undefined> {
    if (!payload) return []
    return [
        payload.delivery,
        payload.latestDelivery,
        ...(payload.deliveries || []),
        ...(payload.deliveryEvidence || []),
        payload.deliveryStatus?.latestDelivery,
        ...(payload.deliveryStatus?.deliveries || []),
        payload.deliveryProof?.latestDelivery,
        ...(payload.deliveryProof?.deliveries || []),
        payload.testResult?.delivery,
        ...(payload.testResult?.deliveries || []),
    ]
}

function normalizeDeliveryEvidence(delivery: WorkbenchApiPayload['delivery'] | undefined, fallbackAlertId: string, fallbackAttemptedAt: string): WorkbenchDeliveryEvidence | undefined {
    const id = stringValue(delivery?.id)
    if (!id) return undefined
    return {
        id,
        alertId: stringValue(delivery?.alertId) || fallbackAlertId,
        status: stringValue(delivery?.status) || 'recorded',
        deliveryKind: stringValue(delivery?.deliveryKind),
        attemptedAt: stringValue(delivery?.attemptedAt) || fallbackAttemptedAt,
        webhookDestinationId: stringValue(delivery?.webhookDestinationId),
        endpointHash: stringValue(delivery?.endpointHash) || 'endpoint_hash_not_returned',
        payloadHash: stringValue(delivery?.payloadHash) || 'payload_hash_not_returned',
        httpStatus: typeof delivery?.httpStatus === 'number' ? delivery.httpStatus : undefined,
        error: stringValue(delivery?.error),
    }
}

function mergeDeliveryEvidence(nextDeliveries: WorkbenchDeliveryEvidence[], existingDeliveries: WorkbenchDeliveryEvidence[]) {
    const seen = new Set<string>()
    const merged: WorkbenchDeliveryEvidence[] = []
    for (const delivery of [...nextDeliveries, ...existingDeliveries]) {
        if (seen.has(delivery.id)) continue
        seen.add(delivery.id)
        merged.push(delivery)
    }
    return merged
}

function customerNotificationActionState(caseDetail: CaseDetailState | undefined) {
    if (caseDetail?.status !== 'ready') return { disabledReason: 'Open the case details before recording customer notification.' }
    if (caseDetail.detail.customerNotificationContext?.notified) return { disabledReason: 'Customer notification receipt is already recorded.' }
    if (!deliveredCaseDelivery(caseDetail.detail)) return { disabledReason: 'Customer notification receipt requires a delivered webhook row.' }
    if (caseDetail.detail.access?.readOnly) return { disabledReason: 'Read-only case members cannot record customer notifications.' }
    return {}
}

function deliveredCaseDelivery(detail: CaseDetailPayload) {
    const latest = detail.deliveryContext?.latestDelivery
    if (latest?.status === 'delivered') return latest
    return (detail.deliveries || []).find(delivery => delivery.status === 'delivered')
}

function caseCustomerNotificationHref(caseDetailHref: string) {
    const [path, query] = caseDetailHref.split('?')
    return `${path.replace(/\/$/, '')}/customer-notification${query ? `?${query}` : ''}`
}

function caseExportHref(caseDetailHref: string) {
    const [path, query] = caseDetailHref.split('?')
    const params = new URLSearchParams(query || '')
    params.set('shape', 'full')
    params.set('timeline', 'true')
    params.set('evidence', 'true')
    params.set('nextActionPayloads', 'true')
    return `${path.replace(/\/$/, '')}/export?${params.toString()}`
}

function caseReplayExportState(item: WorkbenchCase, caseDetail: CaseDetailState | undefined): {
    status: WorkbenchWorkflowStep['status']
    href?: string
    detail: string
    blockers: string[]
    workflowEventCount: number
    timelineCount: number
    deliveryCount: number
    nextActionCount: number
} {
    const href = item.caseDetailHref ? caseExportHref(item.caseDetailHref) : undefined
    const detail = caseDetail?.status === 'ready' ? caseDetail.detail : undefined
    const workflowEventCount = detail ? (detail.case?.workflowEvents || []).length + (detail.alertContext?.workflowEvents || []).length : 0
    const timelineCount = detail?.timeline?.length || 0
    const deliveryCount = (detail?.deliveries?.length || 0) + (detail?.deliveryContext?.latestDelivery ? 1 : 0)
    const nextActionCount = detail?.nextAllowedActions?.length || detail?.nextActions?.length || 0
    const blockers = [
        href ? '' : 'missing_case_detail_route',
        detail ? '' : 'case_detail_not_loaded',
        detail && !workflowEventCount && !timelineCount ? 'missing_replay_timeline' : '',
        detail && !nextActionCount ? 'missing_next_action_payloads' : '',
    ].filter(Boolean)
    const status: WorkbenchWorkflowStep['status'] = !href || blockers.includes('missing_replay_timeline')
        ? 'blocked'
        : blockers.length
            ? 'needs_action'
            : 'ready'
    const routeText = href ? `Open ${href}` : 'Replay export is syncing the case detail route.'
    const detailText = detail
        ? `${routeText}; ${workflowEventCount} workflow event${workflowEventCount === 1 ? '' : 's'}, ${timelineCount} timeline row${timelineCount === 1 ? '' : 's'}, ${deliveryCount} delivery row${deliveryCount === 1 ? '' : 's'}.`
        : routeText
    return {
        status,
        href,
        detail: detailText,
        blockers,
        workflowEventCount,
        timelineCount,
        deliveryCount,
        nextActionCount,
    }
}

function watchlistLedgerHref(orgContext: WorkbenchOrgContext | undefined) {
    const params = new URLSearchParams()
    if (orgContext?.organization?.id || orgContext?.scope.organizationId) params.set('organizationId', orgContext.organization?.id || orgContext.scope.organizationId || '')
    if (orgContext?.scope.tenantId) params.set('tenantId', orgContext.scope.tenantId)
    const query = params.toString()
    return `/api/dwm/watchlists${query ? `?${query}` : ''}`
}

function deliveryLedgerHref(orgContext: WorkbenchOrgContext | undefined, selected?: WorkbenchCase, delivery?: WorkbenchDeliveryEvidence | CaseDelivery) {
    const params = new URLSearchParams()
    if (orgContext?.organization?.id || orgContext?.scope.organizationId) params.set('organizationId', orgContext.organization?.id || orgContext.scope.organizationId || '')
    if (orgContext?.scope.tenantId) params.set('tenantId', orgContext.scope.tenantId)
    if (selected?.kind === 'dwm_alert') params.set('alertId', selected.id)
    if (delivery?.id) params.set('deliveryId', delivery.id)
    if (delivery?.webhookDestinationId) params.set('webhookDestinationId', delivery.webhookDestinationId)
    const query = params.toString()
    return `/api/dwm/webhooks/deliveries${query ? `?${query}` : ''}`
}

function organizationWebhookDestinationHref(organizationId: string, webhookDestinationId: string) {
    const params = new URLSearchParams()
    params.set('destinationId', webhookDestinationId)
    return `/api/organizations/${encodeURIComponent(organizationId)}/webhooks?${params.toString()}`
}

function alertSourceProfileHref(detail: AlertDetailPayload | undefined) {
    const evidence = detail?.alert?.evidence || []
    const sourceId = evidence
        .map(item => typeof item.provenance === 'object' ? stringValue(item.provenance?.sourceId) : undefined)
        .find(Boolean)
    return sourceProfileHref(sourceId)
}

function sourceProfileHref(sourceId: string | undefined) {
    return sourceId ? `/dashboard/ti/sources/${encodeURIComponent(sourceId)}` : undefined
}

function latestDeliveryForActionRail(selected: WorkbenchCase, caseDetail: CaseDetailState | undefined, actionDeliveries: WorkbenchDeliveryEvidence[], orgContext: WorkbenchOrgContext | undefined) {
    const detailDeliveries = caseDetail?.status === 'ready' ? caseDetail.detail.deliveries || [] : []
    return [...detailDeliveries, ...actionDeliveries, ...(selected.deliveryEvidence || []), orgContext?.readiness.latestDelivery]
        .filter((delivery): delivery is WorkbenchDeliveryEvidence | CaseDelivery => Boolean(delivery?.id))
        .sort((a, b) => String(b.attemptedAt ?? '').localeCompare(String(a.attemptedAt ?? '')))[0]
}

function hasSendDeliveryDestination(action: WorkbenchAction | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    return Boolean(activeWebhook || stringValue(action?.body?.webhookDestinationId) || stringValue(action?.body?.webhookUrl))
}

function sendDeliveryActionFor(item: WorkbenchCase) {
    return item.actions?.find(candidate => candidate.id === 'send_alert') || (item.kind === 'dwm_alert' ? {
        id: 'send_alert',
        label: 'Send',
        method: 'POST' as const,
        href: '/api/dwm/webhooks/deliver',
        body: { alertId: item.id, limit: 1 },
        disabledReason: item.persistent ? undefined : 'Persisted alert delivery is syncing before webhook send can run.',
    } : undefined)
}

function sendDeliveryDisabledReason(item: WorkbenchCase, orgContext: WorkbenchOrgContext | undefined) {
    if (item.kind !== 'dwm_alert') return undefined
    if (!item.persistent) return 'Send requires a persistent alert and webhook delivery route.'
    const action = sendDeliveryActionFor(item)
    if (action?.disabledReason) return action.disabledReason
    if (!hasSendDeliveryDestination(action, orgContext)) return 'Send delivery requires an active organization webhook destination or action-scoped webhook target.'
    return undefined
}

function orgInviteDisabledReason(orgContext: WorkbenchOrgContext | undefined, caseDetail: CaseDetailState | undefined) {
    if (!orgContext?.organization) return 'Select an organization before inviting a teammate.'
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    if (access?.readOnly === true || access?.visibilityDecision?.allowed === false) return 'Invite is disabled because the case API marked this member read-only or visibility-blocked.'
    return ''
}

function watchlistMutationDisabledReason(orgContext: WorkbenchOrgContext | undefined, caseDetail: CaseDetailState | undefined) {
    if (!orgContext?.createWatchlistAction) return orgContext?.readiness.blockedReasons[0] || 'Connect the organization watchlist service before saving shared terms.'
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    if (access?.readOnly === true || access?.visibilityDecision?.allowed === false) return 'Watchlist update is disabled because the case API marked this member read-only or visibility-blocked.'
    return ''
}

function caseDetailHrefFromPayload(payload: WorkbenchApiPayload | undefined, action: WorkbenchAction | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const caseId = payload?.case?.id
    if (!caseId) return undefined
    const organizationId = payload.case?.organizationId
        || stringValue(action?.body?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    return `/api/cases/${encodeURIComponent(caseId)}${query}`
}

function caseDetailHrefFromAlertDetail(payload: AlertDetailPayload | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const alert = payload?.alert
    const caseId = stringValue(alert?.caseId) || stringValue(alert?.caseIdCandidate) || stringValue(alert?.workflowContext?.caseIdCandidate)
    if (!caseId) return undefined
    const organizationId = stringValue(alert?.organizationId)
        || stringValue(alert?.workflowContext?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
    return `/api/cases/${encodeURIComponent(caseId)}${query}`
}

function alertWorkflowMutationBody(item: WorkbenchCase, detail: AlertDetailPayload | undefined, orgContext: WorkbenchOrgContext | undefined) {
    const alert = detail?.alert
    const contract = detail?.analystWorkflowContract
    const organizationId = stringValue(alert?.organizationId)
        || stringValue(alert?.workflowContext?.organizationId)
        || orgContext?.organization?.id
        || orgContext?.scope.organizationId
    const expectedWorkflowEventCount = detail?.workflowExecutionReadiness?.currentWorkflowEventCount
        ?? contract?.idempotency?.workflowEventCount
    const expectedUpdatedAt = detail?.workflowExecutionReadiness?.currentUpdatedAt
        || contract?.idempotency?.updatedAt
        || alert?.updatedAt
    return {
        ...(organizationId ? { organizationId } : scopeBody(orgContext)),
        alertId: item.id,
        ...(expectedWorkflowEventCount !== undefined ? { expectedWorkflowEventCount } : {}),
        ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    }
}

function scopedActionBody(body: Record<string, unknown>, orgContext: WorkbenchOrgContext | undefined): Record<string, unknown> {
    return {
        ...scopeBody(orgContext),
        ...body,
    }
}

function scopedDeliveryActionBody(body: Record<string, unknown>, orgContext: WorkbenchOrgContext | undefined): Record<string, unknown> {
    const scoped = scopedActionBody(body, orgContext)
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    if (!stringValue(scoped.webhookDestinationId) && !stringValue(scoped.webhookUrl) && activeWebhook?.id) {
        return { ...scoped, webhookDestinationId: activeWebhook.id }
    }
    return scoped
}

function stringValue(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim() : ''
    return normalized || undefined
}

function objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function arrayValue(value: unknown) {
    return Array.isArray(value) ? value : []
}

function stringArrayValue(value: unknown) {
    return arrayValue(value).map(item => stringValue(item)).filter((item): item is string => Boolean(item))
}

function numberValue(value: unknown) {
    const normalized = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(normalized) ? normalized : undefined
}

function actionResultMessage(action: WorkbenchAction, payload: Awaited<ReturnType<typeof readJson>>) {
    if (payload.case?.id) return `Case ${payload.case.id} is ${payload.case.status || 'open'}.`
    if (typeof payload.savedAlertCount === 'number') return `Rebuilt ${payload.savedAlertCount} alert${payload.savedAlertCount === 1 ? '' : 's'}.`
    if (typeof payload.attemptedCount === 'number') return webhookDeliveryResultMessage(payload)
    if (action.id === 'request_source_coverage') {
        const sourcePayload = payload as Record<string, unknown>
        const sourceStatusMessage = sourceOperationsActionMessage(sourcePayload)
        if (sourceStatusMessage) return sourceStatusMessage
        const summary = objectValue(sourcePayload.summary) || {}
        const createdCount = numberValue(summary.telegramPublicCreated ?? summary.darkwebMetadataCreated ?? summary.createdCount) ?? 0
        const duplicateCount = numberValue(summary.duplicateCount) ?? 0
        if (Number.isFinite(createdCount) && Number.isFinite(duplicateCount) && (createdCount || duplicateCount)) return `Source request applied: ${createdCount} created, ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}.`
        const source = objectValue(sourcePayload.source)
        const candidate = objectValue(sourcePayload.candidate)
        const sourceId = stringValue(source?.id)
        const candidateId = stringValue(candidate?.id)
        if (sourceId) return `Source ${sourceId} is scheduled for coverage.`
        if (candidateId) return `Source candidate ${candidateId} is scheduled for review.`
        return 'Source coverage request accepted.'
    }
    if (action.id === 'preview_source_apply_plan') {
        const sourcePayload = payload as Record<string, unknown>
        const sourceStatusMessage = sourceOperationsActionMessage(sourcePayload)
        if (sourceStatusMessage) return sourceStatusMessage
        const applyPlan = objectValue(sourcePayload.applyPlan) || objectValue(sourcePayload.payload)
        const affectedSources = numberValue(applyPlan?.affectedSourceCount) ?? numberValue(applyPlan?.sourceCount)
        const plannedActions = arrayValue(applyPlan?.actions).length || arrayValue(applyPlan?.selectedActions).length
        if (affectedSources !== undefined || plannedActions) return `Source apply plan prepared ${affectedSources ?? 0} source${affectedSources === 1 ? '' : 's'} and ${plannedActions} action${plannedActions === 1 ? '' : 's'} for review.`
        return 'Source apply plan preview is ready.'
    }
    if (action.id === 'run_canary_collection') {
        const canaryPayload = payload as Record<string, unknown>
        const canaryRun = canaryPayload.canaryRun && typeof canaryPayload.canaryRun === 'object' ? canaryPayload.canaryRun as Record<string, unknown> : {}
        const inserted = Number(canaryRun.insertedCaptureCount ?? canaryPayload.insertedCaptureCount ?? 0)
        const failed = Number(canaryRun.failedTaskCount ?? canaryPayload.failedTaskCount ?? 0)
        if (Number.isFinite(inserted) || Number.isFinite(failed)) return `Canary run finished with ${Number.isFinite(inserted) ? inserted : 0} capture${inserted === 1 ? '' : 's'} and ${Number.isFinite(failed) ? failed : 0} failure${failed === 1 ? '' : 's'}.`
        return 'Canary collection run accepted.'
    }
    const webhookDeliveries = deliveryEvidenceFromPayload(payload, 'webhook_action')
    if (webhookDeliveries[0]) return `Webhook test ${webhookDeliveries[0].status || 'recorded'} as ${webhookDeliveries[0].id}.`
    if (payload.testedAt) return `Webhook test recorded at ${payload.testedAt}.`
    return `${action.label} completed.`
}

function webhookDeliveryResultMessage(payload: Awaited<ReturnType<typeof readJson>>) {
    const deliveries = deliveryEvidenceFromPayload(payload, 'delivery_result')
    if (deliveries.length) {
        const summary = deliveries
            .slice(0, 3)
            .map(delivery => `${delivery.id}:${delivery.status}`)
            .join(', ')
        const suffix = deliveries.length > 3 ? `, +${deliveries.length - 3} more` : ''
        return `Webhook delivery result: ${summary}${suffix}.`
    }
    if (typeof payload.attemptedCount === 'number') return `Webhook delivery attempted for ${payload.attemptedCount} alert${payload.attemptedCount === 1 ? '' : 's'}.`
    return 'No webhook delivery has been sent.'
}

function alertReplayResultMessage(payload: Awaited<ReturnType<typeof readJson>>, item: WorkbenchCase) {
    const blockerCodes = [...(payload.workflowExecutionReadiness?.blockerCodes || []), ...(payload.downstreamHandoff?.blockerCodes || [])]
        .filter((code, index, source) => Boolean(code) && source.indexOf(code) === index)
    if (payload.workflowExecutionReadiness?.ready === false || blockerCodes.length) return `Replay blocked by ${blockerCodes.join(', ') || 'workflow lane'}.`
    const alertId = stringValue(payload.alert?.id) || item.id
    const replayCount = numberValue(payload.alert?.replayCount)
    const replayedAt = stringValue(payload.alert?.lastReplayedAt || payload.alert?.updatedAt)
    const countText = replayCount !== undefined ? `; replay count ${replayCount}` : ''
    const timeText = replayedAt ? `; latest ${replayedAt}` : ''
    return `Evidence replay recorded for ${alertId}${countText}${timeText}.`
}

function sourceOperationsActionMessage(payload: Record<string, unknown>) {
    const sourceOperationsReadiness = objectValue(payload.sourceOperationsReadiness)
        || objectValue(objectValue(payload.sourcePacks)?.sourceOperationsReadiness)
        || objectValue(objectValue(objectValue(payload.sourceInventory)?.sourcePackWorker)?.sourceOperationsReadiness)
    const sourceOperationsQueue = objectValue(payload.sourceOperationsQueue)
        || objectValue(objectValue(payload.actorReadiness)?.sourceOperationsQueue)
        || objectValue(objectValue(objectValue(payload.statusArtifacts)?.dashboardSourceReadiness)?.sourceOperationsQueue)
    const sourceOperationsAdapter = objectValue(payload.sourceOperationsAdapter)
        || objectValue(objectValue(objectValue(payload.statusArtifacts)?.dashboardSourceReadiness)?.sourceOperationsAdapter)
    const collectionTrigger = objectValue(payload.collectionTrigger)
    const alertRebuild = objectValue(payload.alertRebuild)
    const queueItems = arrayValue(sourceOperationsQueue?.queueItems)
    const adapterRows = arrayValue(sourceOperationsAdapter?.rows)

    if (sourceOperationsReadiness) {
        const summary = objectValue(sourceOperationsReadiness.summary) || {}
        const actionability = objectValue(sourceOperationsReadiness.actionability)
        const nextAction = objectValue(arrayValue(sourceOperationsReadiness.nextOperatorActions)[0])
        const lastActionId = stringArrayValue(sourceOperationsReadiness.lastActionIds)[0]
        const parts = [
            numberValue(summary.readyFamilies) !== undefined ? `${numberValue(summary.readyFamilies)} ready families` : undefined,
            numberValue(summary.actionableFamilies) !== undefined ? `${numberValue(summary.actionableFamilies)} actionable families` : undefined,
            numberValue(summary.candidateCount) !== undefined ? `${numberValue(summary.candidateCount)} candidates` : undefined,
            queueItems.length ? `${queueItems.length} scheduled operation${queueItems.length === 1 ? '' : 's'}` : undefined,
            lastActionId ? `last action ${lastActionId}` : undefined,
        ].filter(Boolean)
        const next = [stringValue(nextAction?.action), stringValue(nextAction?.reason)].filter(Boolean).join(': ')
        const retry = actionability?.canRetry === false ? ' Retry is paused by source policy.' : ''
        return `Collection updated${parts.length ? `: ${parts.join(', ')}` : '.'}${next ? `. Next: ${next}` : ''}${retry}`
    }

    if (queueItems.length) return `Collection has ${queueItems.length} item${queueItems.length === 1 ? '' : 's'} for review.`
    if (adapterRows.length) return `Collection published ${adapterRows.length} dashboard row${adapterRows.length === 1 ? '' : 's'}.`

    const collectionQueued = collectionTrigger?.queued === true
    const collectionReason = stringValue(collectionTrigger?.reason)
    const collectionTaskId = stringValue(collectionTrigger?.taskId) || stringValue(collectionTrigger?.jobId)
    const rebuildStatus = stringValue(alertRebuild?.status)
    const rebuildReason = stringValue(alertRebuild?.reason)
    if (collectionTrigger || alertRebuild) {
        const collectionText = collectionQueued
            ? `collection scheduled${collectionTaskId ? ` as ${collectionTaskId}` : ''}`
            : `collection waiting${collectionReason ? `: ${collectionReason}` : ''}`
        const rebuildText = rebuildStatus || rebuildReason
            ? `alert rebuild ${rebuildStatus || 'pending'}${rebuildReason ? `: ${rebuildReason}` : ''}`
            : 'alert rebuild state updated'
        return `Source workflow updated: ${collectionText}; ${rebuildText}.`
    }

    return undefined
}

function caseMutationResultMessage(action: WorkbenchCaseMutationAction, payload: Awaited<ReturnType<typeof readJson>>) {
    const caseId = payload.case?.id ? `Case ${payload.case.id}` : 'Case'
    const status = payload.case?.status ? ` is ${payload.case.status}` : ' updated'
    if (action === 'assign') return `${caseId} owner saved.`
    if (action === 'note') return `${caseId} rationale saved.`
    if (action === 'review') return `${caseId}${status}; review started.`
    if (action === 'escalate') return `${caseId}${status} and ready for routing.`
    if (action === 'suppress') return `${caseId}${status}; delivery muted.`
    if (action === 'close') return `${caseId}${status}.`
    if (action === 'reopen') return `${caseId} reopened.`
    if (action === 'false_positive') return `${caseId} marked false positive.`
    return `${caseId}${status}.`
}

function caseMutationIdempotencyKey(item: WorkbenchCase, mutation: CaseMutationInput) {
    const owner = mutation.assignedOwner || 'unassigned'
    const note = (mutation.note || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 96)
    return `workbench:${item.id}:${mutation.action}:${owner}:${note || 'no-note'}`
}

function scopeBody(orgContext: WorkbenchOrgContext | undefined) {
    if (orgContext?.scope.organizationId) return { organizationId: orgContext.scope.organizationId }
    return { tenantId: orgContext?.scope.tenantId || 'default' }
}

function suggestedWatchTerm(item: WorkbenchCase) {
    return [item.matchedTerm, item.company, item.evidence[0]?.metadata?.find(meta => meta.label.toLowerCase().includes('domain'))?.value]
        .map(value => String(value || '').trim())
        .find(value => value && value.toLowerCase() !== 'none') || ''
}

function inferTermKind(value: string) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return 'domain'
    if (value.includes('@')) return 'email'
    return 'company'
}

function watchlistCoverage(orgContext: WorkbenchOrgContext | undefined, term: string) {
    const normalized = term.trim().toLowerCase()
    if (!normalized) return undefined
    for (const watchlist of orgContext?.watchlists || []) {
        const match = (watchlist.terms || []).find(candidate => String(candidate.value || '').trim().toLowerCase() === normalized)
        if (match) return { covered: true, watchlistId: watchlist.id, watchlistName: watchlist.name }
    }
    return { covered: false }
}

function mapDwmDecision(status: string, currentStatus: string) {
    if (status === 'reviewing') return { reviewState: 'reviewing', deliveryState: 'pending_review' }
    if (status === 'escalated') return { reviewState: 'route_to_customer', deliveryState: 'ready_to_send' }
    if (status === 'suppressed') return { reviewState: 'false_positive', deliveryState: 'muted' }
    if (status === 'closed') return { reviewState: 'resolved', deliveryState: currentStatus === 'delivered' ? 'delivered' : 'muted' }
    return { reviewState: 'needs_review', deliveryState: 'pending_review' }
}

function workbenchSummary(cases: WorkbenchCase[]) {
    const latestCase = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return {
        total: cases.length,
        review: cases.filter(item => /review|needs|new|pending/i.test(item.status)).length,
        highPriority: cases.filter(item => item.severity === 'critical' || item.severity === 'high').length,
        persistent: cases.filter(item => item.persistent).length,
        evidence: cases.filter(item => item.evidence.length > 0).length,
        latest: latestCase ? relativeTime(latestCase.updatedAt) : 'listening',
    }
}

function WorkbenchStat({ icon, label: statLabel, value, detail, tone }: { icon: React.ReactNode, label: string, value: string, detail: string, tone: 'neutral' | 'good' | 'warn' }) {
    const toneClass = tone === 'good'
        ? 'text-[#9cf0bc]'
        : tone === 'warn'
            ? 'text-[#ffd58a]'
            : 'text-[#9db8ff]'

    return (
        <div className='rounded-lg border border-[#26344d] bg-[#101827] px-3 py-2'>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8fa0ba]'>{statLabel}</p>
                <span className={toneClass}>{icon}</span>
            </div>
            <p className='mt-2 text-lg font-semibold text-[#edf4ff]'>{value}</p>
            <p className='mt-0.5 truncate text-xs text-[#8fa0ba]'>{detail}</p>
        </div>
    )
}

function ownerLabel(value: string) {
    if (!value || value === 'source-ops') return 'triage'
    if (value === 'unassigned') return 'unassigned'
    return value
}

function operatorSourceLabel(value: string) {
    const clean = value.toLowerCase()
    if (clean.includes('/api/dwm/alerts')) return 'Saved alert record'
    if (clean.includes('/api/cases')) return 'Case file'
    if (clean.includes('/api/dwm/watchlists') || clean.includes('watchlist')) return 'Customer watchlist'
    if (clean.includes('/api/dwm/webhooks') || clean.includes('delivery')) return 'Delivery ledger'
    if (clean.includes('selected queue')) return 'Selected case'
    if (clean.includes('evidence')) return 'Evidence packet'
    if (clean.includes('org')) return 'Organization scope'
    return label(value)
}

function filterCases(cases: WorkbenchCase[], filter: QueueFilter, query: string) {
    const clean = query.trim().toLowerCase()
    return cases.filter(item => {
        if (filter === 'critical' && item.severity !== 'critical') return false
        if (filter === 'high' && item.severity !== 'high') return false
        if (filter === 'persistent' && !item.persistent) return false
        if (filter === 'evidence' && item.kind !== 'source_capture') return false
        if (!clean) return true
        return `${item.title} ${item.subtitle} ${item.actor} ${item.company} ${item.matchedTerm} ${item.queue}`.toLowerCase().includes(clean)
    })
}

function queueSummary(cases: WorkbenchCase[]) {
    const counts = new Map<string, number>()
    for (const item of cases) counts.set(item.queue, (counts.get(item.queue) ?? 0) + 1)
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#2c160f] px-2 py-0.5 text-xs font-semibold text-[#ffd0c2]'
    if (severity === 'high') return 'rounded-full bg-[#2c160f] px-2 py-0.5 text-xs font-semibold text-[#ffd0c2]'
    if (severity === 'medium') return 'rounded-full bg-[#162033] px-2 py-0.5 text-xs font-semibold text-[#7aa5ff]'
    return 'rounded-full bg-[#15284b] px-2 py-0.5 text-xs font-semibold text-[#aab7cc]'
}

function workflowStatusClass(status: WorkbenchWorkflowStep['status']) {
    if (status === 'ready') return 'rounded-full bg-[#0c261c] px-2 py-0.5 text-[11px] font-semibold text-[#9cf0bc] '
    if (status === 'blocked') return 'rounded-full bg-[#2a220f] px-2 py-0.5 text-[11px] font-semibold text-[#ffd879] '
    return 'rounded-full bg-[#162033] px-2 py-0.5 text-[11px] font-semibold text-[#7aa5ff] '
}

function label(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'review'
    return value.replaceAll('_', ' ')
}

function customerOperationalText(value: string) {
    return value
        .replace(/\baction_required\b/gi, 'reviewing')
        .replace(/\baction required\b/gi, 'reviewing')
        .replace(/\bneeds action\b/gi, 'reviewing')
        .replace(/\bneeds work\b/gi, 'reviewing')
        .replace(new RegExp('\\bneeds pr' + 'oof\\b', 'gi'), 'collecting evidence')
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source reference')
        .replace(new RegExp('\\bpr' + 'oof\\b', 'gi'), 'evidence')
        .replace(/\bblocked until\b/gi, 'syncing until')
        .replace(/\bblocked\b/gi, 'syncing')
        .replace(/\bblockers?\b/gi, 'follow-up')
}

function relativeTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}

function formatSeconds(value?: number) {
    if (!value || value <= 0) return 'checking'
    if (value < 60) return `${value}s`
    const minutes = Math.round(value / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
