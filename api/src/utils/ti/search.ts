import { XMLParser } from 'fast-xml-parser'

export interface TiSearchRequest {
    query: string
}

export interface TiSearchResponse {
    query: string
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen: string
    aliases: string[]
    recentActivity: TiActivity[]
    targets: TiTarget[]
    ttps: TiTtp[]
    datasets: TiDataset[]
    sources: TiSource[]
    notes: string[]
    operationalStatus?: TiOperationalStatus
    analystLoop?: TiAnalystLoop
}

export type TiResultState = 'queued' | 'searching' | 'partial' | 'ready' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation'

export interface TiOperationalStatus {
    state: 'idle' | 'queued' | 'searching' | 'partial' | 'ready' | 'blocked' | 'degraded' | 'metadata_review' | 'needs_source_activation'
    headline: string
    queue: {
        selectedTasks: number
        queuedTasks: number
        leasedTasks: number
        reviewTasks: number
        maxAgeSeconds: number
        p95AgeSeconds: number
        nextPollSeconds?: number
        backpressureState?: string
        cursorContinuity?: string
    }
    workers: {
        leaseState: string
        retryDebt: number
        deadLetters: number
        backoffState: string
        concurrency: string
        fairness: string
        memoryPressure?: number
    }
    budgets: TiOperationalBudget[]
    fairness: {
        ok: boolean
        worstGroup?: string
        worstShare: number
    }
    aging: Array<{
        label: string
        seconds: number
        tone: 'ok' | 'watch' | 'bad'
    }>
    controls: Array<{
        action: string
        scenario?: string
        warningCodes: string[]
        queueDelta: number
        workerDelta: number
        rollback: string
    }>
    notes: string[]
}

export interface TiOperationalBudget {
    workClass: string
    queued: number
    leased: number
    budgetSlots: number
    maxAgeSeconds: number
    retryDebt: number
    action: string
}

export interface TiActivity {
    date: string
    title: string
    detail: string
    confidence: number
    sourceIds: string[]
    url?: string
    claimType?: 'campaign' | 'victim_claim' | 'malware_activity' | 'vulnerability_exploitation' | 'infrastructure_activity' | 'general_activity'
    victimName?: string
    affectedSectors?: string[]
    countries?: string[]
    impact?: string
    firstReportedAt?: string
    lastReportedAt?: string
    publisherCount?: number
    corroboratingSourceIds?: string[]
    contradictingSourceIds?: string[]
}

export interface TiTarget {
    sector: string
    regions: string[]
    rationale: string
    confidence: number
}

export interface TiTtp {
    name: string
    attackId?: string
    tactic: string
    detail: string
    confidence: number
}

export interface TiDataset {
    name: string
    type: 'clear_web' | 'public_channel' | 'darknet_metadata' | 'vendor_report' | 'stix_export'
    coverage: string
    status: 'available' | 'planned' | 'metadata_only'
    url?: string
}

export interface TiSource {
    id: string
    name: string
    type: string
    provenance: string
    url?: string
}

export interface TiAnalystLoop {
    resultState: TiResultState
    headline: string
    nextSteps: Array<{
        state: 'queued' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation' | 'ready'
        label: string
        detail: string
        tone: 'ok' | 'watch' | 'bad'
    }>
    runStatusClarity: {
        queuedTasks: number
        reviewTasks: number
        rejectedSources: number
        blockedUnsafeTargets: number
        meaningfulWorkCount: number
        summary: string
    }
    metadataReviewInbox: TiMetadataReviewItem[]
    sourceActivationWorkflow: {
        required: boolean
        dryRunOnly: boolean
        actions: Array<{
            action: 'request_approval' | 'restore_source' | 'enable_metadata_only_queue' | 'keep_blocked'
            sourceId?: string
            reason: string
            execution: 'dry_run' | 'human_approval_required' | 'blocked'
        }>
    }
    victimNotificationPacket?: TiVictimNotificationPacket
}

export interface TiMetadataReviewItem {
    id: string
    company?: string
    victim?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
    sourceHash?: string
    provenance: string
    confidence: number
    status: 'needs_review' | 'queued_metadata_only' | 'duplicate' | 'escalated'
    allowedActions: Array<'notify_company' | 'mark_duplicate' | 'request_approval' | 'escalate'>
}

export interface TiVictimNotificationPacket {
    company?: string
    claimSummary: string
    affectedAccounts?: string
    datasetSize?: string
    actorStatement?: string
    sourceHash?: string
    confidence: number
    whatWasNotAccessed: string[]
    recommendedAction: string
}

interface KnownActorContext extends Pick<TiSearchResponse, 'aliases' | 'targets' | 'ttps'> {
    summary: string
}

export async function searchThreatIntel(input: TiSearchRequest): Promise<TiSearchResponse> {
    const query = input.query.trim()
    if (!query) {
        throw new Error('query is required')
    }

    const scraperBase = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    if (scraperBase) {
        const scraperResult = await tryScraperSearch(scraperBase, query)
        if (scraperResult) {
            return scraperResult
        }
    }

    return seededSearch(query)
}

async function tryScraperSearch(scraperBase: string, query: string): Promise<TiSearchResponse | null> {
    try {
        const response = await fetch(`${scraperBase}/v1/intel/runs`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'idempotency-key': `hanasand-ti-${query.toLowerCase()}`
            },
            body: JSON.stringify({
                query,
                entityType: 'actor',
                includeClearWeb: true,
                includeTelegram: true,
                includeDarknetMetadata: true,
                maxTasks: 40,
                tenantId: 'hanasand-public-ti',
                requesterId: 'hanasand.com/ti',
                reason: 'public TI search page'
            })
        })

        if (!response.ok) {
            return null
        }

        const body = await response.json() as {
            run?: { id?: string; taskCount?: number; reviewTaskCount?: number; rejectedSourceCount?: number }
            scheduler?: unknown
        }
        const run = body.run
        if (!run?.id) {
            return null
        }

        const [liveResult, evidenceRows] = await Promise.all([
            liveSearch(query),
            fetchScraperEvidence(scraperBase, query)
        ])
        const seeded = mergeScraperEvidence(query, liveResult, evidenceRows)
        const operationalStatus = buildOperationalStatus(body.scheduler, {
            query,
            mode: 'scraper',
            runId: run.id,
            taskCount: run.taskCount ?? 0,
            reviewTaskCount: run.reviewTaskCount ?? 0
        })
        const analystLoop = buildAnalystLoop({
            query,
            scheduler: body.scheduler,
            run: {
                id: run.id,
                taskCount: run.taskCount ?? 0,
                reviewTaskCount: run.reviewTaskCount ?? 0,
                rejectedSourceCount: run.rejectedSourceCount ?? 0
            },
            operationalStatus,
            seeded
        })
        const publicState = publicResultStateFor(query, seeded, analystLoop)
        const publicOperationalStatus = publicState === analystLoop.resultState
            ? operationalStatus
            : {
                ...operationalStatus,
                state: publicState === 'partial' ? 'partial' : 'searching',
                headline: publicState === 'partial'
                    ? 'Instant actor context is ready while live discovery continues.'
                    : 'Live discovery is running.'
            } satisfies TiOperationalStatus
        const publicAnalystLoop = publicState === analystLoop.resultState
            ? analystLoop
            : {
                ...analystLoop,
                resultState: publicState,
                headline: publicState === 'partial'
                    ? 'Instant actor context is ready while live discovery continues.'
                    : 'Live discovery is still building an evidence-backed answer.',
                nextSteps: [{
                    state: 'queued',
                    label: publicState === 'partial' ? 'Searching' : 'Searching',
                    detail: 'Live discovery is still building an evidence-backed answer.',
                    tone: 'watch'
                }]
            } satisfies TiAnalystLoop
        return {
            ...seeded,
            mode: seeded.mode === 'live_search' ? 'live_search' : 'scraper',
            status: publicState,
            runId: run.id,
            refreshAfterSeconds: 3,
            summary: publicAnalystLoop.metadataReviewInbox[0]?.company
                ? metadataReviewSummary(publicAnalystLoop.metadataReviewInbox[0])
                : seeded.summary,
            operationalStatus: publicOperationalStatus,
            analystLoop: publicAnalystLoop,
            sources: [
                {
                    id: run.id,
                    name: 'TI scraper run',
                    type: 'scraper_run',
                    provenance: publicAnalystLoop.runStatusClarity.summary
                },
                ...seeded.sources
            ],
            notes: [
                publicAnalystLoop.headline,
                publicOperationalStatus.headline,
                `Run ${run.id}`,
                ...seeded.notes
            ]
        }
    } catch {
        return null
    }
}

interface ScraperEvidenceRow {
    id?: string
    sourceId?: string
    title?: string
    summary?: string
    collectedAt?: string
    provenanceHash?: string
}

async function fetchScraperEvidence(scraperBase: string, query: string): Promise<ScraperEvidenceRow[]> {
    try {
        const search = new URL(`${scraperBase}/v1/intel/search`)
        search.searchParams.set('q', query)
        search.searchParams.set('limit', '12')
        const response = await fetch(search)
        if (!response.ok) return []
        const body = await response.json() as { rows?: ScraperEvidenceRow[]; results?: ScraperEvidenceRow[] }
        return (body.rows ?? body.results ?? []).filter(row => row.title || row.summary).slice(0, 12)
    } catch {
        return []
    }
}

function mergeScraperEvidence(query: string, result: TiSearchResponse, rows: ScraperEvidenceRow[]): TiSearchResponse {
    const activity = rows.map((row, index) => evidenceRowToActivity(query, row, index)).filter(Boolean) as TiActivity[]
    if (!activity.length) return result
    const sources = rows.map((row, index) => ({
        id: row.sourceId ?? `capture_${index}`,
        name: row.title ?? row.sourceId ?? 'Captured public source',
        type: 'captured_public_source',
        provenance: row.provenanceHash ?? row.id ?? row.sourceId ?? 'captured evidence'
    }))
    return {
        ...result,
        status: 'partial',
        confidence: Math.max(result.confidence, 0.68),
        lastSeen: activity[0]?.lastReportedAt ?? result.lastSeen,
        recentActivity: [...activity, ...result.recentActivity].slice(0, 8),
        sources: [...sources, ...result.sources].slice(0, 12),
        notes: ['Captured public-source evidence is available for this query.', ...result.notes]
    }
}

function evidenceRowToActivity(query: string, row: ScraperEvidenceRow, index: number): TiActivity | undefined {
    const observedAt = row.collectedAt && Number.isFinite(Date.parse(row.collectedAt)) ? row.collectedAt : new Date().toISOString()
    const title = row.title?.trim() || `${query} captured public source`
    const detail = truncateSentence(row.summary ?? title, 260)
    if (!detail) return undefined
    return {
        date: observedAt.slice(0, 10),
        title,
        detail,
        confidence: Math.max(0.58, 0.72 - index * 0.03),
        sourceIds: [row.sourceId ?? row.id ?? `capture_${index}`],
        claimType: inferClaimType(`${title} ${detail}`),
        firstReportedAt: observedAt,
        lastReportedAt: observedAt,
        publisherCount: 1,
        impact: inferImpact(`${title} ${detail}`) ?? 'Captured public intelligence signal'
    }
}

function publicResultStateFor(query: string, seeded: TiSearchResponse, analystLoop: TiAnalystLoop): TiResultState {
    if (seeded.recentActivity.length > 0 && (analystLoop.resultState === 'queued' || analystLoop.resultState === 'searching')) {
        return 'partial'
    }
    if (analystLoop.resultState !== 'ready') return analystLoop.resultState
    if (seeded.recentActivity.length > 0) return 'partial'
    if (knownActorProfile(query)) return 'partial'
    if (seeded.summary.trim().toLowerCase() === 'searching' && analystLoop.runStatusClarity.meaningfulWorkCount === 0) {
        return 'searching'
    }
    return analystLoop.resultState
}

async function liveSearch(query: string): Promise<TiSearchResponse> {
    const known = knownActorProfile(query)
    const matches = filterLiveMatchesForQuery(query, await searchClearWeb(query, known?.aliases ?? []), Boolean(known))
    if (matches.length) {
        const generatedAt = new Date().toISOString()
        const activityMatches = matches.filter(match => match.kind === 'news' && match.publishedAt)
        const activity = clusterLiveNews(query, activityMatches).slice(0, 6)
        return {
            query,
            generatedAt,
            mode: 'live_search',
            status: 'partial',
            refreshAfterSeconds: 3,
            summary: summarizeLiveResult(query, matches, known),
            confidence: known ? 0.62 : 0.48,
            lastSeen: activity[0]?.lastReportedAt ?? activityMatches[0]?.publishedAt ?? generatedAt,
            aliases: known?.aliases ?? [],
            recentActivity: activity,
            targets: mergeTargets(inferLiveTargets(query, matches), known?.targets ?? []),
            ttps: mergeTtps(inferLiveTtps(matches), known?.ttps ?? []),
            datasets: liveDatasets(),
            sources: matches.slice(0, 8).map(match => ({
                id: match.id,
                name: match.publisher ?? match.title,
                type: match.kind === 'news' ? 'live_news' : match.kind === 'background' ? 'background_reference' : 'live_clear_web',
                provenance: match.url,
                url: safeTiLink(match.url)
            })),
            notes: [
                'Live results are discovery evidence until capture and extraction finish.',
                'Restricted sources remain metadata-only and policy-gated.'
            ],
            operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search', taskCount: matches.length }),
            analystLoop: buildAnalystLoop({ query, seeded: { recentActivity: activity }, operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search', taskCount: matches.length }) })
        }
    }

    const operationalStatus = buildOperationalStatus(null, { query, mode: 'live_search' })
    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: buildAnalystLoop({ query, operationalStatus }).resultState,
        refreshAfterSeconds: 3,
        summary: known?.summary ?? 'Searching',
        confidence: known ? 0.46 : 0.2,
        lastSeen: new Date().toISOString(),
        aliases: known?.aliases ?? [],
        recentActivity: [],
        targets: known?.targets ?? [],
        ttps: known?.ttps ?? [],
        datasets: liveDatasets(),
        sources: [{ id: 'live:search:pending', name: 'Searching', type: 'live_search', provenance: 'Live discovery is in progress' }],
        notes: [],
        operationalStatus,
        analystLoop: buildAnalystLoop({ query, operationalStatus })
    }
}

function seededSearch(query: string): TiSearchResponse {
    const known = knownActorProfile(query)
    const operationalStatus = buildOperationalStatus(null, { query, mode: 'live_search' })
    const analystLoop = buildAnalystLoop({ query, operationalStatus })

    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: analystLoop.resultState === 'searching' && known ? 'partial' : analystLoop.resultState,
        refreshAfterSeconds: 3,
        summary: analystLoop.metadataReviewInbox[0]?.company
            ? metadataReviewSummary(analystLoop.metadataReviewInbox[0])
            : known?.summary ?? 'Searching',
        confidence: known ? 0.46 : 0.2,
        lastSeen: new Date().toISOString(),
        aliases: known?.aliases ?? [],
        recentActivity: [],
        targets: known?.targets ?? [],
        ttps: known?.ttps ?? [],
        datasets: liveDatasets(),
        sources: [{ id: 'live:search:unavailable', name: 'Searching', type: 'system', provenance: 'Live source discovery is not available from this API process' }],
        notes: [],
        operationalStatus,
        analystLoop
    }
}

function buildAnalystLoop(input: {
    query: string
    scheduler?: unknown
    run?: { id: string; taskCount: number; reviewTaskCount: number; rejectedSourceCount: number }
    operationalStatus?: TiOperationalStatus
    seeded?: Partial<Pick<TiSearchResponse, 'recentActivity'>>
}): TiAnalystLoop {
    const scheduler = record(input.scheduler)
    const scraperLoop = record(scheduler?.analystLoop)
    if (scraperLoop) return analystLoopFromScraper(scraperLoop, input.query)

    const queuedTasks = numberValue(scheduler?.queuedTaskCount, input.run?.taskCount, 0)
    const reviewTasks = numberValue(scheduler?.reviewTaskCount, input.run?.reviewTaskCount, 0)
    const rejectedSources = numberValue(input.run?.rejectedSourceCount, 0)
    const blockedReasons = stringArray(scheduler?.blockedReasons)
    const skippedReasons = stringArray(scheduler?.skippedReasons)
    const deferredReasons = stringArray(scheduler?.deferredReasons)
    const allReasons = [...blockedReasons, ...skippedReasons, ...deferredReasons]
    const blockedUnsafeTargets = allReasons.filter((reason) => /payload|download|credential|private|captcha|interaction|unsafe/i.test(reason)).length
    const leakClaim = parseLeakClaim(input.query, input.seeded?.recentActivity ?? [])
    const hasMetadataReview = reviewTasks > 0 || Boolean(leakClaim)
    const needsActivation = /activation|approval|legal|operator|restore|metadata-only review|needs_source_activation/i.test(`${scheduler?.backpressureState ?? ''} ${allReasons.join(' ')}`)
    const resultState: TiResultState = blockedUnsafeTargets > 0 && !hasMetadataReview
        ? 'blocked_unsafe_target'
        : hasMetadataReview
            ? 'metadata_review'
            : needsActivation
                ? 'needs_source_activation'
                : queuedTasks > 0
                    ? 'queued'
                    : input.operationalStatus?.state === 'ready'
                        ? 'ready'
                        : input.operationalStatus?.state === 'partial'
                            ? 'partial'
                            : 'searching'

    const inbox = hasMetadataReview ? [metadataReviewItemFor(input.query, leakClaim, input.run?.id, allReasons)] : []
    const notification = inbox[0] ? notificationPacketFor(inbox[0]) : undefined
    const visibleReviewTasks = Math.max(reviewTasks, inbox.length)
    const meaningfulWorkCount = queuedTasks + visibleReviewTasks
    const nextSteps: TiAnalystLoop['nextSteps'] = []
    if (queuedTasks > 0) {
        nextSteps.push({ state: 'queued', label: 'Approved collection running', detail: `${queuedTasks} approved safe task${queuedTasks === 1 ? '' : 's'} queued or visible to workers.`, tone: 'ok' })
    }
    if (hasMetadataReview) {
        nextSteps.push({ state: 'metadata_review', label: 'Metadata review', detail: 'Review the leak claim metadata and prepare victim notification without opening leaked files.', tone: 'watch' })
    }
    if (blockedUnsafeTargets > 0) {
        nextSteps.push({ state: 'blocked_unsafe_target', label: 'Unsafe target blocked', detail: 'Raw downloads, credentials, private access, or interaction targets were blocked and should stay blocked.', tone: 'bad' })
    }
    if (needsActivation) {
        nextSteps.push({ state: 'needs_source_activation', label: 'Approval needed', detail: 'Use dry-run source approval or restore packets before metadata-only queueing.', tone: 'watch' })
    }
    if (!nextSteps.length) {
        nextSteps.push({ state: resultState === 'ready' ? 'ready' : 'queued', label: resultState === 'ready' ? 'Ready' : 'Waiting', detail: resultState === 'ready' ? 'Reviewed evidence is ready for display.' : 'Waiting for live discovery or scheduler telemetry.', tone: resultState === 'ready' ? 'ok' : 'watch' })
    }

    return {
        resultState,
        headline: analystHeadline(resultState, meaningfulWorkCount, reviewTasks),
        nextSteps,
        runStatusClarity: {
            queuedTasks,
            reviewTasks: visibleReviewTasks,
            rejectedSources,
            blockedUnsafeTargets,
            meaningfulWorkCount,
            summary: `${queuedTasks} queued collection task${queuedTasks === 1 ? '' : 's'}, ${visibleReviewTasks} metadata review task${visibleReviewTasks === 1 ? '' : 's'}, ${blockedUnsafeTargets} unsafe target block${blockedUnsafeTargets === 1 ? '' : 's'}, ${rejectedSources} rejected source${rejectedSources === 1 ? '' : 's'}`
        },
        metadataReviewInbox: inbox,
        sourceActivationWorkflow: {
            required: needsActivation,
            dryRunOnly: true,
            actions: sourceActivationActions(allReasons, input.run?.id, needsActivation, blockedUnsafeTargets)
        },
        victimNotificationPacket: notification
    }
}

function analystLoopFromScraper(loop: Record<string, unknown>, query: string): TiAnalystLoop {
    const runStatus = record(loop.runStatusClarity)
    const sourceActivation = record(loop.sourceActivationWorkflow)
    const inbox = arrayValue(loop.metadataReviewInbox)
        .map((item) => metadataReviewItemFromRecord(record(item)))
        .filter((item): item is TiMetadataReviewItem => Boolean(item))
    const packet = victimNotificationPacketFromRecord(record(loop.victimNotificationPacket))
    const resultState = tiResultState(stringValue(loop.resultState), inbox.length > 0 ? 'metadata_review' : 'searching')
    const reviewTasks = numberValue(runStatus?.reviewTasks, inbox.length, 0)
    return {
        resultState,
        headline: stringValue(loop.headline) ?? analystHeadline(resultState, reviewTasks || 1, reviewTasks),
        nextSteps: arrayValue(loop.nextSteps)
            .map((item) => nextStepFromRecord(record(item)))
            .filter((item): item is TiAnalystLoop['nextSteps'][number] => Boolean(item)),
        runStatusClarity: {
            queuedTasks: numberValue(runStatus?.queuedTasks, 0),
            reviewTasks,
            rejectedSources: numberValue(runStatus?.rejectedSources, 0),
            blockedUnsafeTargets: numberValue(runStatus?.blockedUnsafeTargets, 0),
            meaningfulWorkCount: numberValue(runStatus?.meaningfulWorkCount, reviewTasks),
            summary: stringValue(runStatus?.summary) ?? `${reviewTasks} metadata review task${reviewTasks === 1 ? '' : 's'} for ${query}`
        },
        metadataReviewInbox: inbox,
        sourceActivationWorkflow: {
            required: Boolean(sourceActivation?.required),
            dryRunOnly: sourceActivation?.dryRunOnly !== false,
            actions: arrayValue(sourceActivation?.actions)
                .map((item) => sourceActivationActionFromRecord(record(item)))
                .filter((item): item is TiAnalystLoop['sourceActivationWorkflow']['actions'][number] => Boolean(item))
        },
        victimNotificationPacket: packet
    }
}

function metadataReviewItemFromRecord(item: Record<string, unknown> | null): TiMetadataReviewItem | null {
    if (!item) return null
    return {
        id: stringValue(item.id) ?? `metadata-review:${hashString(JSON.stringify(item))}`,
        company: stringValue(item.company),
        victim: stringValue(item.victim),
        affectedAccounts: stringValue(item.affectedAccounts),
        accountSubjects: stringValue(item.accountSubjects),
        datasetSize: stringValue(item.datasetSize),
        actorStatement: stringValue(item.actorStatement),
        claimedDate: stringValue(item.claimedDate),
        sourceHash: stringValue(item.sourceHash),
        provenance: stringValue(item.provenance) ?? 'scraper metadata-only review item',
        confidence: Math.max(0, Math.min(1, numberValue(item.confidence, 0.5))),
        status: metadataReviewStatus(stringValue(item.status)),
        allowedActions: stringArray(item.allowedActions).map(metadataReviewAction).filter((action): action is TiMetadataReviewItem['allowedActions'][number] => Boolean(action))
    }
}

function victimNotificationPacketFromRecord(packet: Record<string, unknown> | null): TiVictimNotificationPacket | undefined {
    if (!packet) return undefined
    return {
        company: stringValue(packet.company),
        claimSummary: stringValue(packet.claimSummary) ?? 'Metadata-only leak claim requires review.',
        affectedAccounts: stringValue(packet.affectedAccounts),
        datasetSize: stringValue(packet.datasetSize),
        actorStatement: stringValue(packet.actorStatement),
        sourceHash: stringValue(packet.sourceHash),
        confidence: Math.max(0, Math.min(1, numberValue(packet.confidence, 0.5))),
        whatWasNotAccessed: stringArray(packet.whatWasNotAccessed),
        recommendedAction: stringValue(packet.recommendedAction) ?? 'Review metadata and notify through approved channels.'
    }
}

function nextStepFromRecord(item: Record<string, unknown> | null): TiAnalystLoop['nextSteps'][number] | null {
    if (!item) return null
    return {
        state: analystStepState(stringValue(item.state)),
        label: stringValue(item.label) ?? 'Review',
        detail: stringValue(item.detail) ?? 'Review the analyst-loop state.',
        tone: analystTone(stringValue(item.tone))
    }
}

function sourceActivationActionFromRecord(item: Record<string, unknown> | null): TiAnalystLoop['sourceActivationWorkflow']['actions'][number] | null {
    if (!item) return null
    const action = sourceActivationAction(stringValue(item.action))
    if (!action) return null
    return {
        action,
        sourceId: stringValue(item.sourceId),
        reason: stringValue(item.reason) ?? 'Source activation action requires review.',
        execution: sourceActivationExecution(stringValue(item.execution))
    }
}

function metadataReviewItemFor(query: string, claim: ParsedLeakClaim | null, runId: string | undefined, reasons: string[]): TiMetadataReviewItem {
    return {
        id: `metadata-review:${hashString(`${runId ?? 'live'}:${query}`).slice(0, 12)}`,
        company: claim?.company,
        victim: claim?.company,
        affectedAccounts: claim?.affectedAccounts,
        accountSubjects: claim?.accountSubjects,
        datasetSize: claim?.datasetSize,
        actorStatement: claim?.actorStatement ?? truncateSentence(query, 360),
        claimedDate: claim?.claimedDate,
        sourceHash: hashString(`${query}:${reasons.join('|')}`).slice(0, 16),
        provenance: runId ? `Scraper run ${runId}; metadata-only review task` : 'Live query text; metadata-only review candidate',
        confidence: claim ? 0.74 : 0.52,
        status: 'needs_review',
        allowedActions: ['notify_company', 'mark_duplicate', 'request_approval', 'escalate']
    }
}

function notificationPacketFor(item: TiMetadataReviewItem): TiVictimNotificationPacket {
    const parts = [
        item.company ? `${item.company} was named in a leak claim` : 'A leak claim requires review',
        item.affectedAccounts ? `${item.affectedAccounts} were claimed affected` : undefined,
        item.datasetSize ? `${item.datasetSize} was claimed` : undefined
    ].filter(Boolean)
    return {
        company: item.company,
        claimSummary: parts.join('; '),
        affectedAccounts: item.affectedAccounts,
        datasetSize: item.datasetSize,
        actorStatement: item.actorStatement,
        sourceHash: item.sourceHash,
        confidence: item.confidence,
        whatWasNotAccessed: [
            'No raw leaked dataset was downloaded or opened.',
            'No credentials, cookies, private channels, or invite-only areas were accessed.',
            'No CAPTCHA, authentication, or access-control bypass was attempted.',
            'No threat actor interaction was performed.'
        ],
        recommendedAction: 'Validate the claim metadata, mark duplicates, and notify the named organization through approved contact channels.'
    }
}

function metadataReviewSummary(item: TiMetadataReviewItem) {
    return [
        `${item.company ?? 'Leak claim'} is queued for metadata review.`,
        item.affectedAccounts ? `${item.affectedAccounts}.` : undefined,
        item.datasetSize ? `${item.datasetSize}.` : undefined
    ].filter(Boolean).join(' ')
}

function sourceActivationActions(reasons: string[], runId: string | undefined, needsActivation: boolean, blockedUnsafeTargets: number): TiAnalystLoop['sourceActivationWorkflow']['actions'] {
    const actions: TiAnalystLoop['sourceActivationWorkflow']['actions'] = []
    if (needsActivation) {
        actions.push({
            action: 'request_approval',
            sourceId: runId,
            reason: reasons.find((reason) => /approval|legal|operator/i.test(reason)) ?? 'Metadata-only source requires operator/legal approval before queueing.',
            execution: 'human_approval_required'
        })
        actions.push({
            action: 'enable_metadata_only_queue',
            sourceId: runId,
            reason: 'After approval, queue metadata-only work with raw downloads and interactions disabled.',
            execution: 'dry_run'
        })
    }
    if (blockedUnsafeTargets > 0) {
        actions.push({
            action: 'keep_blocked',
            sourceId: runId,
            reason: 'Unsafe raw payload, credential, private access, or interaction target must remain blocked.',
            execution: 'blocked'
        })
    }
    return actions
}

function analystHeadline(state: TiResultState, meaningfulWorkCount: number, reviewTasks: number) {
    if (state === 'metadata_review') return `${reviewTasks || meaningfulWorkCount || 1} metadata review item${(reviewTasks || meaningfulWorkCount || 1) === 1 ? '' : 's'} need analyst action.`
    if (state === 'blocked_unsafe_target') return 'Unsafe raw target blocked; safe metadata remains the only permitted path.'
    if (state === 'needs_source_activation') return 'Operator or legal approval is needed before metadata-only collection can continue.'
    if (state === 'queued') return 'Approved safe collection is queued and waiting for worker progress.'
    if (state === 'ready') return 'Reviewed evidence is ready for the public answer.'
    return 'Live discovery is still building an evidence-backed answer.'
}

interface ParsedLeakClaim {
    company?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
}

function parseLeakClaim(query: string, activity: TiActivity[]): ParsedLeakClaim | null {
    const text = [query, ...activity.flatMap((item) => [item.title, item.detail])].join(' | ')
    if (!/\b(leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|dump(?:ed)?|stolen|exfiltrat(?:ed|ion))\b/i.test(text)) return null
    const company = text.match(/^\s*["“]?([^"|,;]+?)["”]?\s+(?:was\s+)?(?:leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|hit|named)\b/i)?.[1]?.trim()
        ?? text.match(/\b(?:victim|company|organization)\s*:\s*([^|;\n]+)/i)?.[1]?.trim()
    const affectedAccounts = text.match(/\b([\d,.]+\s*(?:k|m|million|thousand)?\s+accounts?)\b/i)?.[1]
    const accountSubjects = text.match(/\b(?:who|account subjects|account owners)\s*:\s*([^|;\n]+)/i)?.[1]?.trim()
    const datasetSize = text.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|TB|PB|records?|files?|rows?))\b/i)?.[1]
    const claimedDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
    return {
        company,
        affectedAccounts,
        accountSubjects,
        datasetSize,
        actorStatement: truncateSentence(text, 420),
        claimedDate
    }
}

function buildOperationalStatus(schedulerInput: unknown, fallback: {
    query: string
    mode: TiSearchResponse['mode']
    runId?: string
    taskCount?: number
    reviewTaskCount?: number
}): TiOperationalStatus {
    const scheduler = record(schedulerInput)
    const queueEconomics = record(scheduler?.queueEconomics)
    const totals = record(queueEconomics?.totals)
    const telemetry = record(record(scheduler?.productionAdapterTelemetry)?.telemetry)
    const canaryControlPlane = record(scheduler?.canaryControlPlane)
    const headroom = record(canaryControlPlane?.headroom)
    const fairness = record(queueEconomics?.fairness)
    const queueAge = record(scheduler?.queueAgeSeconds)
    const runtimeSla = record(scheduler?.runtimeSla)
    const queuedTasks = numberValue(scheduler?.queuedTaskCount, totals?.queued, fallback.taskCount, 0)
    const leasedTasks = numberValue(scheduler?.leasedTaskCount, totals?.leased, 0)
    const reviewTasks = numberValue(scheduler?.reviewTaskCount, fallback.reviewTaskCount, 0)
    const retryDebt = numberValue(totals?.retryDebt, telemetry?.retryDebt, 0)
    const deadLetters = numberValue(totals?.deadLetters, record(queueEconomics?.deadLetterTrend)?.count, 0)
    const maxAgeSeconds = numberValue(queueAge?.max, totals?.maxQueuedAgeSeconds, 0)
    const p95AgeSeconds = numberValue(queueAge?.p95, record(telemetry?.queueAge)?.p95Seconds, 0)
    const backpressureState = stringValue(scheduler?.backpressureState)
    const cursorContinuity = stringValue(scheduler?.cursorContinuity, telemetry?.cursorContinuity)
    const state = operationalState({
        queuedTasks,
        leasedTasks,
        reviewTasks,
        retryDebt,
        deadLetters,
        backpressureState,
        runtimeState: stringValue(runtimeSla?.state),
        mode: fallback.mode,
        fallbackTaskCount: fallback.taskCount ?? 0,
        hasScheduler: Boolean(scheduler)
    })
    const budgetRows = arrayValue(queueEconomics?.workClassBudget)
        .map((item): TiOperationalBudget | null => {
            const row = record(item)
            if (!row) return null
            return {
                workClass: stringValue(row.workClass) ?? 'unknown',
                queued: numberValue(row.queued, 0),
                leased: numberValue(row.leased, 0),
                budgetSlots: numberValue(row.budgetSlots, 0),
                maxAgeSeconds: numberValue(row.maxQueuedAgeSeconds, 0),
                retryDebt: numberValue(row.retryDebt, 0),
                action: stringValue(row.recommendedAction) ?? 'accept'
            }
        })
        .filter((item): item is TiOperationalBudget => Boolean(item))
    const controls = arrayValue(canaryControlPlane?.controls)
        .slice(0, 8)
        .map((item) => {
            const control = record(item) ?? {}
            const delta = record(control.expectedQueueDelta)
            const workerDelta = arrayValue(control.workerPartitionEffects)
                .map((effect) => numberValue(record(effect)?.reservedWorkerSlotDelta, 0))
                .reduce((sum, value) => sum + value, 0)
            return {
                action: stringValue(control.action) ?? 'monitor',
                scenario: stringValue(control.scenario),
                warningCodes: stringArray(control.warningCodes),
                queueDelta: numberValue(delta?.queuedVisibleDelta, 0),
                workerDelta,
                rollback: stringArray(control.rollbackSteps)[0] ?? 'no rollback needed'
            }
        })
    const worstShare = numberValue(fairness?.worstShare, 0)
    const fairnessOk = booleanValue(fairness?.ok, worstShare <= 0.25)
    const memoryPressure = optionalNumber(record(queueEconomics?.memoryPressure)?.ratio)
    const notes = [
        queuedTasks > 0 ? `${queuedTasks} queued task${queuedTasks === 1 ? '' : 's'} waiting for scheduler leases.` : 'No queued scraper tasks are visible for this query yet.',
        leasedTasks > 0 ? `${leasedTasks} task${leasedTasks === 1 ? ' is' : 's are'} leased to workers.` : 'No workers have leased this query yet.',
        retryDebt > 0 ? `${retryDebt} retr${retryDebt === 1 ? 'y is' : 'ies are'} in backoff or retry debt.` : 'Retry debt is clear.',
        deadLetters > 0 ? `${deadLetters} dead-lettered task${deadLetters === 1 ? '' : 's'} need operator attention.` : 'No dead letters are currently attached.',
        fairnessOk ? 'Fairness is within the per-source share policy.' : `Fairness is drifting; ${stringValue(fairness?.worstGroup) ?? 'one source group'} is taking ${formatPercent(worstShare)} of scheduler share.`
    ]

    return {
        state,
        headline: operationalHeadline(state, queuedTasks, leasedTasks, retryDebt, deadLetters),
        queue: {
            selectedTasks: numberValue(scheduler?.selectedTaskCount, fallback.taskCount, queuedTasks + leasedTasks),
            queuedTasks,
            leasedTasks,
            reviewTasks,
            maxAgeSeconds,
            p95AgeSeconds,
            nextPollSeconds: optionalNumber(scheduler?.nextPollSeconds),
            backpressureState,
            cursorContinuity
        },
        workers: {
            leaseState: leasedTasks > 0 ? 'workers active' : queuedTasks > 0 ? 'waiting for lease' : 'idle',
            retryDebt,
            deadLetters,
            backoffState: retryDebt > 0 ? 'backoff active' : 'clear',
            concurrency: queueConcurrencyLabel(budgetRows, headroom),
            fairness: fairnessOk ? 'within policy' : 'fairness drift',
            memoryPressure
        },
        budgets: budgetRows,
        fairness: {
            ok: fairnessOk,
            worstGroup: stringValue(fairness?.worstGroup),
            worstShare
        },
        aging: [
            { label: 'Oldest queued task', seconds: maxAgeSeconds, tone: ageTone(maxAgeSeconds) },
            { label: 'p95 queued age', seconds: p95AgeSeconds, tone: ageTone(p95AgeSeconds) }
        ],
        controls,
        notes
    }
}

function operationalState(input: {
    queuedTasks: number
    leasedTasks: number
    reviewTasks: number
    retryDebt: number
    deadLetters: number
    backpressureState?: string
    runtimeState?: string
    mode: TiSearchResponse['mode']
    fallbackTaskCount: number
    hasScheduler: boolean
}): TiOperationalStatus['state'] {
    if (input.deadLetters > 0 || input.runtimeState === 'breach') return 'blocked'
    if (input.retryDebt > 0 || input.backpressureState?.includes('pressure')) return 'degraded'
    if (input.reviewTasks > 0) return 'metadata_review'
    if (input.leasedTasks > 0) return 'searching'
    if (input.queuedTasks > 0) return 'queued'
    if (!input.hasScheduler && input.fallbackTaskCount > 0) return 'partial'
    if (input.mode === 'scraper') return 'ready'
    return 'searching'
}

function operationalHeadline(state: TiOperationalStatus['state'], queued: number, leased: number, retryDebt: number, deadLetters: number) {
    if (state === 'blocked') return `${deadLetters} dead-lettered task${deadLetters === 1 ? '' : 's'} need attention before this run is healthy.`
    if (state === 'degraded') return `Scheduler is working with ${retryDebt} retry/backoff item${retryDebt === 1 ? '' : 's'}.`
    if (state === 'metadata_review') return 'Metadata-only review is waiting for analyst action.'
    if (state === 'needs_source_activation') return 'Source approval or restore action is required before collection can continue.'
    if (state === 'partial') return 'Live public discovery returned partial evidence; scraper scheduler telemetry is not attached.'
    if (state === 'searching') return leased > 0 ? `${leased} task${leased === 1 ? ' is' : 's are'} leased to scraper workers.` : 'Live discovery is running.'
    if (state === 'queued') return `${queued} task${queued === 1 ? ' is' : 's are'} queued and waiting for worker capacity.`
    if (state === 'ready') return 'No scheduler pressure is visible for this query.'
    return 'Scheduler is idle.'
}

function queueConcurrencyLabel(budgets: TiOperationalBudget[], headroom: Record<string, unknown> | null) {
    const slots = budgets.reduce((sum, item) => sum + item.budgetSlots, 0)
    const queueHeadroom = optionalNumber(headroom?.queueHeadroomTasks)
    if (slots > 0 && queueHeadroom !== undefined) return `${slots} budget slots, ${queueHeadroom} queue headroom`
    if (slots > 0) return `${slots} budget slots`
    if (queueHeadroom !== undefined) return `${queueHeadroom} queue headroom`
    return 'waiting for scheduler telemetry'
}

function ageTone(seconds: number): 'ok' | 'watch' | 'bad' {
    if (seconds >= 900) return 'bad'
    if (seconds >= 120) return 'watch'
    return 'ok'
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function stringValue(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value
    }
    return undefined
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function numberValue(...values: unknown[]): number {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return 0
}

function optionalNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return undefined
}

function booleanValue(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`
}

function knownActorProfile(query: string): KnownActorContext | null {
    const normalized = query.trim().toLowerCase()
    if (normalized === 'apt29' || normalized.includes('cozy bear') || normalized.includes('midnight blizzard')) {
        return {
            summary: 'APT29 is a Russia-linked espionage actor associated with intelligence collection, diplomatic and government targeting, cloud and identity abuse, credential access, and stealthy persistence.',
            aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium', 'The Dukes'],
            targets: [
                {
                    sector: 'Government and diplomacy',
                    regions: ['Europe', 'North America', 'NATO-aligned states'],
                    rationale: 'Strategic intelligence collection against foreign affairs, policy, and diplomatic entities is a persistent public reporting theme.',
                    confidence: 0.78
                },
                {
                    sector: 'Technology and cloud services',
                    regions: ['Global'],
                    rationale: 'Identity and cloud access can provide downstream collection and visibility into many organizations.',
                    confidence: 0.7
                },
                {
                    sector: 'NGO, think tank, and research organizations',
                    regions: ['Europe', 'United States'],
                    rationale: 'Policy and research targets align with espionage collection requirements.',
                    confidence: 0.63
                }
            ],
            ttps: [
                {
                    name: 'Password Spraying',
                    attackId: 'T1110.003',
                    tactic: 'Credential Access',
                    detail: 'Used to gain initial access against identity systems while blending into normal authentication traffic.',
                    confidence: 0.76
                },
                {
                    name: 'Cloud Accounts',
                    attackId: 'T1078.004',
                    tactic: 'Defense Evasion / Persistence',
                    detail: 'Valid cloud identities and tokens are valuable for mailbox, tenant, and application access.',
                    confidence: 0.72
                },
                {
                    name: 'Email Collection',
                    attackId: 'T1114',
                    tactic: 'Collection',
                    detail: 'Mailbox access and diplomatic/policy correspondence collection are consistent with espionage objectives.',
                    confidence: 0.7
                },
                {
                    name: 'Command and Control Over Web Services',
                    attackId: 'T1102',
                    tactic: 'Command and Control',
                    detail: 'Public reporting often describes stealthy infrastructure and use of legitimate-looking services.',
                    confidence: 0.58
                }
            ]
        }
    }
    if (normalized === 'apt42' || normalized.includes('charming kitten') || normalized.includes('mint sandstorm')) {
        return {
            summary: 'APT42 is an Iran-linked espionage actor commonly associated with social engineering, credential theft, account takeover, and targeting of policy, diplomatic, journalist, NGO, and research communities.',
            aliases: ['Charming Kitten', 'Mint Sandstorm', 'TA453', 'Yellow Garuda'],
            targets: [
                {
                    sector: 'Government, policy, and diplomacy',
                    regions: ['Middle East', 'Europe', 'North America'],
                    rationale: 'Public reporting commonly links APT42-style activity to intelligence collection against policy, diplomatic, and regional targets.',
                    confidence: 0.62
                },
                {
                    sector: 'Journalists, NGOs, and researchers',
                    regions: ['Global'],
                    rationale: 'Public reporting frequently describes social-engineering and credential-collection targeting of civil society and research communities.',
                    confidence: 0.58
                }
            ],
            ttps: [
                {
                    name: 'Phishing',
                    attackId: 'T1566',
                    tactic: 'Initial Access',
                    detail: 'Known public reporting commonly describes social-engineering and credential harvesting.',
                    confidence: 0.62
                },
                {
                    name: 'Valid Accounts',
                    attackId: 'T1078',
                    tactic: 'Persistence',
                    detail: 'Credential access can enable account takeover and follow-on collection.',
                    confidence: 0.54
                }
            ]
        }
    }
    return baselineKnownActorProfile(normalized)
}

interface BaselineActorProfile {
    names: string[]
    summary: string
    aliases: string[]
}

const BASELINE_ACTOR_PROFILES: BaselineActorProfile[] = [
    {
        names: ['apt28', 'fancy bear', 'sofacy', 'forest blizzard'],
        summary: 'APT28 is a Russia-linked espionage actor associated with government, defense, political, media, and security-sector targeting, including phishing, credential access, malware deployment, and intelligence collection.',
        aliases: ['Fancy Bear', 'Sofacy', 'Forest Blizzard']
    },
    {
        names: ['lazarus group', 'lazarus', 'hidden cobra'],
        summary: 'Lazarus Group is a North Korea-linked actor associated with espionage, disruptive operations, software supply-chain activity, cryptocurrency theft, and financially motivated intrusions.',
        aliases: ['Hidden Cobra', 'Diamond Sleet']
    },
    {
        names: ['volt typhoon', 'vanguard panda', 'bronze silhouette'],
        summary: 'Volt Typhoon is a China-linked espionage actor associated with critical-infrastructure access, compromised edge devices, living-off-the-land techniques, credential access, and long-term persistence.',
        aliases: ['Vanguard Panda', 'Bronze Silhouette']
    },
    {
        names: ['salt typhoon'],
        summary: 'Salt Typhoon is a China-linked espionage actor publicly associated with telecommunications and network-provider compromises, intelligence collection, and persistent access to communications infrastructure.',
        aliases: []
    },
    {
        names: ['turla', 'snake', 'venomous bear', 'waterbug'],
        summary: 'Turla is a Russia-linked espionage actor associated with government and diplomatic targeting, custom malware, compromised infrastructure, command-and-control operations, and long-duration intelligence collection.',
        aliases: ['Snake', 'Venomous Bear', 'Waterbug']
    },
    {
        names: ['sandworm', 'voodoo bear', 'seashell blizzard'],
        summary: 'Sandworm is a Russia-linked actor associated with disruptive and destructive operations, critical-infrastructure targeting, wiper malware, and military or geopolitical campaigns.',
        aliases: ['Voodoo Bear', 'Seashell Blizzard']
    },
    {
        names: ['kimsuky', 'velvet chollima', 'emerald sleet'],
        summary: 'Kimsuky is a North Korea-linked espionage actor associated with phishing, credential collection, malware delivery, and targeting of government, policy, research, and defense communities.',
        aliases: ['Velvet Chollima', 'Emerald Sleet']
    },
    {
        names: ['muddywater', 'muddy water', 'seedworm', 'static kitten'],
        summary: 'MuddyWater is an Iran-linked espionage actor associated with government and telecommunications targeting, phishing, remote-access tooling, credential theft, and regional intelligence collection.',
        aliases: ['Seedworm', 'Static Kitten', 'Mango Sandstorm']
    },
    {
        names: ['scattered spider', 'unc3944', 'octo tempest'],
        summary: 'Scattered Spider is a financially motivated intrusion cluster associated with social engineering, identity compromise, SIM swapping, help-desk abuse, cloud access, data theft, and extortion.',
        aliases: ['UNC3944', 'Octo Tempest', '0ktapus']
    },
    {
        names: ['lockbit', 'lockbit 3.0', 'lockbitsupp'],
        summary: 'LockBit is a ransomware and extortion operation associated with affiliate-driven intrusions, data theft, encryption, leak-site victim claims, and attacks across many sectors and regions.',
        aliases: ['LockBit 3.0', 'LockBitSupp']
    },
    {
        names: ['clop', 'cl0p'],
        summary: 'Clop is a financially motivated extortion operation associated with ransomware, large-scale data theft, exploitation of file-transfer products, and public victim claims.',
        aliases: ['Cl0p']
    },
    {
        names: ['akira', 'akira ransomware'],
        summary: 'Akira is a ransomware and extortion operation associated with network intrusion, data theft, encryption, leak-site victim claims, and attacks across enterprise environments.',
        aliases: []
    },
    {
        names: ['black basta'],
        summary: 'Black Basta is a ransomware and extortion operation associated with enterprise intrusions, data theft, encryption, affiliate activity, and public victim claims.',
        aliases: []
    },
    {
        names: ['play', 'play ransomware'],
        summary: 'Play is a ransomware and extortion operation associated with enterprise compromise, data theft, encryption, exploitation of exposed services, and public victim claims.',
        aliases: ['PlayCrypt']
    },
    {
        names: ['ransomhub'],
        summary: 'RansomHub is a ransomware and data-extortion operation associated with affiliate-driven intrusions, data theft, encryption, and public victim claims.',
        aliases: []
    },
    {
        names: ['alphv', 'blackcat', 'black cat'],
        summary: 'ALPHV, also known as BlackCat, is a ransomware and extortion operation associated with affiliate intrusions, data theft, encryption, leak-site claims, and attacks against large organizations.',
        aliases: ['BlackCat', 'Black Cat']
    },
    {
        names: ['hunters international'],
        summary: 'Hunters International is a data-extortion and ransomware operation associated with enterprise intrusions, data theft, encryption, and public victim claims.',
        aliases: []
    }
]

function baselineKnownActorProfile(normalized: string): KnownActorContext | null {
    const profile = BASELINE_ACTOR_PROFILES.find(item => item.names.some(name => normalized === name || normalized.includes(name)))
    if (!profile) return null
    return {
        summary: profile.summary,
        aliases: profile.aliases,
        targets: [],
        ttps: []
    }
}

function summarizeLiveResult(query: string, matches: LiveSearchMatch[], known: KnownActorContext | null) {
    if (known) return known.summary
    const top = matches.find(match => match.snippet)?.snippet ?? matches[0]?.title ?? ''
    const compact = truncateSentence(top, 240)
    if (compact) return `${query}: ${compact}`
    return 'Searching'
}

function mergeTargets(primary: TiTarget[], secondary: TiTarget[]) {
    const merged = [...primary]
    for (const item of secondary) {
        if (!merged.some(existing => existing.sector.toLowerCase() === item.sector.toLowerCase())) {
            merged.push(item)
        }
    }
    return merged.slice(0, 5)
}

function mergeTtps(primary: TiTtp[], secondary: TiTtp[]) {
    const merged = [...primary]
    for (const item of secondary) {
        if (!merged.some(existing => existing.name.toLowerCase() === item.name.toLowerCase() || (item.attackId && existing.attackId === item.attackId))) {
            merged.push(item)
        }
    }
    return merged.slice(0, 6)
}

function truncateSentence(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

interface LiveSearchMatch {
    id: string
    title: string
    url: string
    snippet: string
    publishedAt?: string
    publisher?: string
    kind: 'news' | 'web' | 'background'
}

interface LiveClaimCluster {
    matches: LiveSearchMatch[]
    tokens: Set<string>
}

const CLAIM_CLUSTER_STOP_WORDS = new Set([
    'about', 'after', 'against', 'attack', 'attacks', 'campaign', 'claims', 'cyber', 'from',
    'group', 'hacker', 'hackers', 'linked', 'malware', 'new', 'report', 'reports', 'says',
    'threat', 'using', 'with'
])

export function clusterLiveNews(query: string, matches: LiveSearchMatch[]): TiActivity[] {
    const sorted = matches
        .filter(match => match.kind === 'news' && match.publishedAt)
        .sort((left, right) => Date.parse(right.publishedAt ?? '') - Date.parse(left.publishedAt ?? ''))
    const queryTokens = new Set(normalizeLiveSearchText(query).split(/\s+/).filter(Boolean))
    const clusters: LiveClaimCluster[] = []

    for (const match of sorted) {
        const tokens = claimTokens(match.title, queryTokens)
        const timestamp = Date.parse(match.publishedAt ?? '')
        const cluster = clusters.find((candidate) => {
            const candidateTimestamp = Date.parse(candidate.matches[0]?.publishedAt ?? '')
            const withinThreeDays = Math.abs(timestamp - candidateTimestamp) <= 3 * 24 * 60 * 60 * 1000
            return withinThreeDays && tokenSimilarity(tokens, candidate.tokens) >= 0.5
        })
        if (cluster) {
            cluster.matches.push(match)
            for (const token of tokens) cluster.tokens.add(token)
        } else {
            clusters.push({ matches: [match], tokens })
        }
    }

    return clusters
        .map((cluster, index) => claimClusterToActivity(query, cluster.matches, index))
        .sort((left, right) => Date.parse(right.lastReportedAt ?? right.date) - Date.parse(left.lastReportedAt ?? left.date))
}

function claimClusterToActivity(query: string, matches: LiveSearchMatch[], index: number): TiActivity {
    const ordered = [...matches].sort((left, right) => Date.parse(left.publishedAt ?? '') - Date.parse(right.publishedAt ?? ''))
    const first = ordered[0]!
    const latest = ordered.at(-1)!
    const publishers = uniqueStrings(matches.map(match => match.publisher).filter((value): value is string => Boolean(value)))
    const sourceIds = uniqueStrings(matches.map(match => match.id))
    const combinedText = matches.map(match => `${match.title} ${match.snippet}`).join(' ')
    const victimName = inferVictimName(query, matches)
    const sectors = inferLiveTargets(query, matches).map(target => target.sector)

    return {
        date: latest.publishedAt!.slice(0, 10),
        title: stripPublisherSuffix(latest.title, latest.publisher),
        detail: claimClusterDetail(latest, publishers),
        confidence: Math.min(0.86, Math.max(0.4, 0.64 - index * 0.04 + Math.min(0.18, (publishers.length - 1) * 0.06))),
        sourceIds,
        url: safeTiLink(latest.url),
        claimType: inferClaimType(combinedText),
        victimName,
        affectedSectors: sectors.length ? sectors : undefined,
        countries: inferCountries(combinedText),
        impact: inferImpact(combinedText),
        firstReportedAt: first.publishedAt,
        lastReportedAt: latest.publishedAt,
        publisherCount: publishers.length,
        corroboratingSourceIds: sourceIds.length > 1 ? sourceIds : [],
        contradictingSourceIds: []
    }
}

function claimTokens(title: string, queryTokens: Set<string>): Set<string> {
    const normalized = normalizeLiveSearchText(stripPublisherSuffix(title))
    return new Set(normalized
        .split(/\s+/)
        .filter(token => token.length >= 4 && !queryTokens.has(token) && !CLAIM_CLUSTER_STOP_WORDS.has(token)))
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
    if (left.size < 2 || right.size < 2) return 0
    let intersection = 0
    for (const token of left) {
        if (right.has(token)) intersection += 1
    }
    return intersection / Math.min(left.size, right.size)
}

function stripPublisherSuffix(title: string, publisher?: string): string {
    if (publisher) {
        const suffix = new RegExp(`\\s+-\\s+${escapeRegExp(publisher)}$`, 'i')
        return title.replace(suffix, '').trim()
    }
    return title.replace(/\s+-\s+[^-]{2,60}$/, '').trim()
}

function claimClusterDetail(latest: LiveSearchMatch, publishers: string[]): string {
    const title = normalizeLiveSearchText(stripPublisherSuffix(latest.title, latest.publisher))
    const candidateSnippet = truncateSentence(latest.snippet, 240)
    const normalizedSnippet = normalizeLiveSearchText(candidateSnippet)
    const snippet = normalizedSnippet === title || normalizedSnippet.startsWith(`${title} `) ? '' : candidateSnippet
    const coverage = publishers.length > 1
        ? `Reported by ${publishers.length} publishers: ${publishers.slice(0, 4).join(', ')}.`
        : publishers[0] ? `Reported by ${publishers[0]}.` : 'Reported by one public source.'
    return snippet ? `${snippet} ${coverage}` : coverage
}

function inferClaimType(text: string): TiActivity['claimType'] {
    const normalized = text.toLowerCase()
    if (/\b(?:victim|breach|leak site|data leak|extortion)\b/.test(normalized)) return 'victim_claim'
    if (/\b(?:cve-\d{4}-\d+|zero-day|vulnerabilit|exploit)\b/.test(normalized)) return 'vulnerability_exploitation'
    if (/\b(?:botnet|command and control|c2|infrastructure|server|router)\b/.test(normalized)) return 'infrastructure_activity'
    if (/\b(?:malware|backdoor|trojan|ransomware|implant)\b/.test(normalized)) return 'malware_activity'
    if (/\b(?:operation|campaign|espionage|targeting)\b/.test(normalized)) return 'campaign'
    return 'general_activity'
}

function inferVictimName(query: string, matches: LiveSearchMatch[]): string | undefined {
    for (const match of matches) {
        const title = stripPublisherSuffix(match.title, match.publisher)
        if (isLegalProceedingHeadline(title)) continue
        const patterns = [
            /\b(?:targets?|targeted|hits?|hit|breaches?|breached|attacks?|attacked)\s+([A-Z][A-Za-z0-9&.' -]{2,60}?)(?:\s+(?:with|using|in|after|through|via)\b|[:,]|$)/,
            /\b([A-Z][A-Za-z0-9&.' -]{2,60}?)\s+(?:breach|attack|incident|hack)\b/
        ]
        for (const pattern of patterns) {
            const candidate = title.match(pattern)?.[1]?.trim()
            if (candidate && isLikelyVictimName(candidate, query)) return candidate
        }
    }
    return undefined
}

function isLegalProceedingHeadline(title: string): boolean {
    return /\b(?:arrest(?:ed)?|charged?|charges?|indict(?:ed|ment)|pleads?\s+guilty|sentenced?|suspect|defendant|co-?conspirator|feds?|justice department|court|prosecutors?)\b/i.test(title)
}

function isLikelyVictimName(candidate: string, query: string): boolean {
    const normalizedCandidate = normalizeLiveSearchText(candidate)
    if (!normalizedCandidate || normalizedCandidate === normalizeLiveSearchText(query)) return false
    if (/\b(?:man|woman|teen|hacker|suspect|defendant|member|conspirator|co conspirator|person|individual|group|crew|gang|actor)\b/.test(normalizedCandidate)) return false
    if (/\b(?:pleads?|guilty|charged?|arrested|sentenced|indicted|uncovers?|links?)\b/.test(normalizedCandidate)) return false
    return true
}

function inferCountries(text: string): string[] | undefined {
    const countries: Array<[RegExp, string]> = [
        [/\b(?:united states|u\.s\.|american)\b/i, 'United States'],
        [/\b(?:united kingdom|u\.k\.|british)\b/i, 'United Kingdom'],
        [/\b(?:ukraine|ukrainian)\b/i, 'Ukraine'],
        [/\b(?:germany|german)\b/i, 'Germany'],
        [/\b(?:france|french)\b/i, 'France'],
        [/\b(?:japan|japanese)\b/i, 'Japan'],
        [/\b(?:south korea|korean)\b/i, 'South Korea']
    ]
    const matches = countries.filter(([pattern]) => pattern.test(text)).map(([, country]) => country)
    return matches.length ? matches : undefined
}

function inferImpact(text: string): string | undefined {
    const normalized = text.toLowerCase()
    if (/\b(?:data theft|stolen data|exfiltrat|data leak)\b/.test(normalized)) return 'Reported data theft or disclosure'
    if (/\b(?:ransomware|encrypt|extortion)\b/.test(normalized)) return 'Reported ransomware or extortion impact'
    if (/\b(?:account takeover|credential theft|stolen credentials)\b/.test(normalized)) return 'Reported credential or account compromise'
    if (/\b(?:disruption|outage|offline)\b/.test(normalized)) return 'Reported service disruption'
    return undefined
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

async function searchClearWeb(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const [news, duckDuckGo, wikipedia] = await Promise.all([
        searchGoogleNewsRss(query, aliases),
        searchDuckDuckGoHtml(query, aliases),
        searchWikipedia(query)
    ])
    const merged: LiveSearchMatch[] = []
    for (const match of [...news, ...duckDuckGo, ...wikipedia]) {
        if (!merged.some(existing => existing.url === match.url || existing.title.toLowerCase() === match.title.toLowerCase())) {
            merged.push(match)
        }
    }
    return merged.slice(0, 8)
}

const GENERIC_LIVE_SEARCH_TOKENS = new Set([
    'actor',
    'actors',
    'apt',
    'group',
    'threat',
    'cyber',
    'attack',
    'attacks',
    'malware',
    'ransomware',
    'campaign',
    'made',
    'unknown',
    'random',
    'test'
])

function filterLiveMatchesForQuery(query: string, matches: LiveSearchMatch[], knownActor: boolean): LiveSearchMatch[] {
    if (knownActor) return matches
    const normalized = normalizeLiveSearchText(query)
    const distinctiveTokens = normalized
        .split(/\s+/)
        .filter(token => token.length >= 4 && !GENERIC_LIVE_SEARCH_TOKENS.has(token))

    return matches.filter((match) => {
        const haystack = normalizeLiveSearchText(`${match.title} ${match.snippet} ${match.url}`)
        if (normalized.length >= 4 && haystack.includes(normalized)) return true
        if (distinctiveTokens.length === 0) return false
        return distinctiveTokens.some(token => haystack.includes(token))
    })
}

function normalizeLiveSearchText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

async function searchDuckDuckGoHtml(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
        const search = new URL('https://html.duckduckgo.com/html/')
        search.searchParams.set('q', `${buildActorSearchExpression(query, aliases)} threat actor cyber`)
        const response = await fetch(search, {
            headers: {
                accept: 'text/html,application/xhtml+xml',
                'user-agent': 'hanasand-ti-scraper/0.1 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        const html = await response.text()
        return parseDuckDuckGoResults(html)
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

async function searchGoogleNewsRss(query: string, aliases: string[] = []): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
        const search = new URL('https://news.google.com/rss/search')
        search.searchParams.set('q', `${buildActorSearchExpression(query, aliases)} (cyber OR malware OR ransomware OR espionage)`)
        search.searchParams.set('hl', 'en-US')
        search.searchParams.set('gl', 'US')
        search.searchParams.set('ceid', 'US:en')
        const response = await fetch(search, {
            headers: {
                accept: 'application/rss+xml,application/xml,text/xml',
                'user-agent': 'hanasand-ti-scraper/0.2 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        return parseGoogleNewsRss(await response.text())
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

export function buildActorSearchExpression(query: string, aliases: string[] = []): string {
    const terms = uniqueStrings([query, ...aliases]).slice(0, 4)
    return terms.map(term => `"${term.replace(/"/g, '')}"`).join(' OR ')
}

export function parseGoogleNewsRss(xml: string): LiveSearchMatch[] {
    try {
        const body = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml) as {
            rss?: { channel?: { item?: GoogleNewsItem | GoogleNewsItem[] } }
        }
        const rawItems = body.rss?.channel?.item
        const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
        return items
            .map((item): LiveSearchMatch | null => {
                const title = stringValue(item.title)
                const url = stringValue(item.link)
                const publishedAt = parsePublishedAt(item.pubDate)
                if (!title || !url || !publishedAt) return null
                const publisher = sourceName(item.source)
                return {
                    id: `live:${hashString(`google-news:${title}:${url}`).slice(0, 16)}`,
                    title,
                    url,
                    snippet: cleanHtml(stringValue(item.description) ?? ''),
                    publishedAt,
                    publisher,
                    kind: 'news'
                }
            })
            .filter((item): item is LiveSearchMatch => Boolean(item))
            .sort((left, right) => Date.parse(right.publishedAt ?? '') - Date.parse(left.publishedAt ?? ''))
            .slice(0, 8)
    } catch {
        return []
    }
}

interface GoogleNewsItem {
    title?: unknown
    link?: unknown
    description?: unknown
    pubDate?: unknown
    source?: unknown
}

function parsePublishedAt(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function sourceName(value: unknown): string | undefined {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return undefined
    return stringValue((value as Record<string, unknown>)['#text'])
}

async function searchWikipedia(query: string): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
        const search = new URL('https://en.wikipedia.org/w/api.php')
        search.searchParams.set('action', 'query')
        search.searchParams.set('list', 'search')
        search.searchParams.set('srsearch', `${query} cyber threat actor`)
        search.searchParams.set('format', 'json')
        search.searchParams.set('utf8', '1')
        const response = await fetch(search, {
            headers: {
                accept: 'application/json',
                'user-agent': 'hanasand-ti-scraper/0.1 (+https://hanasand.com/ti)'
            },
            signal: controller.signal
        })
        if (!response.ok) return []
        const body = await response.json() as {
            query?: {
                search?: Array<{ title?: string; snippet?: string; timestamp?: string }>
            }
        }
        return (body.query?.search ?? [])
            .filter(item => item.title)
            .slice(0, 6)
            .map((item) => {
                const title = item.title ?? query
                const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`
                const snippet = `${cleanHtml(item.snippet ?? '')}${item.timestamp ? ` Updated ${item.timestamp.slice(0, 10)}.` : ''}`.trim()
                return {
                    id: `live:${hashString(`wikipedia:${title}:${url}`).slice(0, 16)}`,
                    title: `${title} - Wikipedia live search`,
                    url,
                    snippet,
                    kind: 'background'
                }
            })
    } catch {
        return []
    } finally {
        clearTimeout(timeout)
    }
}

function parseDuckDuckGoResults(html: string): LiveSearchMatch[] {
    const matches: LiveSearchMatch[] = []
    const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/g
    for (const match of html.matchAll(resultPattern)) {
        const url = normalizeDuckDuckGoUrl(decodeHtml(match[1] ?? ''))
        const title = cleanHtml(match[2] ?? '')
        const snippet = cleanHtml(match[3] ?? match[4] ?? '')
        if (!url || !title) continue
        const id = `live:${hashString(`${title}:${url}`).slice(0, 16)}`
        if (!matches.some(existing => existing.url === url)) {
            matches.push({ id, title, url, snippet, kind: 'web' })
        }
        if (matches.length >= 8) break
    }
    return matches
}

function normalizeDuckDuckGoUrl(raw: string) {
    try {
        const url = raw.startsWith('//') ? new URL(`https:${raw}`) : new URL(raw)
        const uddg = url.searchParams.get('uddg')
        return uddg ? decodeURIComponent(uddg) : url.toString()
    } catch {
        return raw
    }
}

function cleanHtml(value: string) {
    return decodeHtml(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function decodeHtml(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, '\'')
        .replace(/&#39;/g, '\'')
        .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

function hashString(value: string) {
    let hash = 5381
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
    }
    return Math.abs(hash >>> 0).toString(16).padStart(8, '0')
}

function tiResultState(value: string | undefined, fallback: TiResultState): TiResultState {
    return value === 'queued' || value === 'searching' || value === 'partial' || value === 'ready' || value === 'metadata_review' || value === 'blocked_unsafe_target' || value === 'needs_source_activation'
        ? value
        : fallback
}

function analystStepState(value: string | undefined): TiAnalystLoop['nextSteps'][number]['state'] {
    return value === 'queued' || value === 'metadata_review' || value === 'blocked_unsafe_target' || value === 'needs_source_activation' || value === 'ready'
        ? value
        : 'metadata_review'
}

function analystTone(value: string | undefined): 'ok' | 'watch' | 'bad' {
    return value === 'ok' || value === 'watch' || value === 'bad' ? value : 'watch'
}

function metadataReviewStatus(value: string | undefined): TiMetadataReviewItem['status'] {
    return value === 'needs_review' || value === 'queued_metadata_only' || value === 'duplicate' || value === 'escalated'
        ? value
        : 'needs_review'
}

function metadataReviewAction(value: string): TiMetadataReviewItem['allowedActions'][number] | undefined {
    return value === 'notify_company' || value === 'mark_duplicate' || value === 'request_approval' || value === 'escalate'
        ? value
        : undefined
}

function sourceActivationAction(value: string | undefined): TiAnalystLoop['sourceActivationWorkflow']['actions'][number]['action'] | undefined {
    return value === 'request_approval' || value === 'restore_source' || value === 'enable_metadata_only_queue' || value === 'keep_blocked'
        ? value
        : undefined
}

function sourceActivationExecution(value: string | undefined): TiAnalystLoop['sourceActivationWorkflow']['actions'][number]['execution'] {
    return value === 'dry_run' || value === 'human_approval_required' || value === 'blocked'
        ? value
        : 'dry_run'
}

function liveDatasets(): TiDataset[] {
    return [
        { name: 'Live clear-web search', type: 'clear_web', coverage: 'Real-time public web discovery plus approved scraper captures', status: 'available' },
        { name: 'Public Telegram/channel mentions', type: 'public_channel', coverage: 'Public channels only through official APIs', status: 'planned', url: 'https://core.telegram.org/bots/api' },
        { name: 'Darknet/leak metadata', type: 'darknet_metadata', coverage: 'Metadata-only actor/victim/date claims; no leaked file downloads', status: 'metadata_only' },
        { name: 'STIX-like export bundle', type: 'stix_export', coverage: 'Evidence-backed indicators/entities/relationships once live captures exist', status: 'planned', url: 'https://oasis-open.github.io/cti-documentation/' }
    ]
}

function safeTiLink(value?: string): string | undefined {
    if (!value) return undefined
    try {
        const url = new URL(value)
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
        if (url.protocol === 'http:' && url.hostname.endsWith('.onion')) return url.toString()
        return undefined
    } catch {
        const onion = value.match(/\bhttps?:\/\/[a-z2-7]{16,56}\.onion[^\s<>"']*/i)?.[0]
        return onion
    }
}

function inferLiveTargets(query: string, matches: LiveSearchMatch[]): TiTarget[] {
    const text = `${query} ${matches.map(match => `${match.title} ${match.snippet}`).join(' ')}`.toLowerCase()
    const targets: TiTarget[] = []
    if (/\bgovernment|diplomat|ministry|embassy|state|defense|nato\b/.test(text)) {
        targets.push({
            sector: 'Government, diplomacy, or defense',
            regions: ['From live source context'],
            rationale: 'Live public results include government, diplomacy, defense, or NATO-related language.',
            confidence: 0.38
        })
    }
    if (/\bhealthcare|hospital|pharma|medical\b/.test(text)) {
        targets.push({
            sector: 'Healthcare',
            regions: ['From live source context'],
            rationale: 'Live public results include healthcare-related language.',
            confidence: 0.34
        })
    }
    if (/\btechnology|cloud|software|identity|microsoft|google\b/.test(text)) {
        targets.push({
            sector: 'Technology and cloud services',
            regions: ['From live source context'],
            rationale: 'Live public results include technology, cloud, or identity platform language.',
            confidence: 0.34
        })
    }
    return targets
}

function inferLiveTtps(matches: LiveSearchMatch[]): TiTtp[] {
    const text = matches.map(match => `${match.title} ${match.snippet}`).join(' ').toLowerCase()
    const ttps: TiTtp[] = []
    if (/\bphishing|spear.?phishing\b/.test(text)) {
        ttps.push({ name: 'Phishing', attackId: 'T1566', tactic: 'Initial Access', detail: 'Live source snippets mention phishing-related access.', confidence: 0.34 })
    }
    if (/\bpassword spraying|credential|token|identity\b/.test(text)) {
        ttps.push({ name: 'Credential or identity abuse', attackId: 'T1110', tactic: 'Credential Access', detail: 'Live source snippets mention credentials, tokens, identity, or password attacks.', confidence: 0.34 })
    }
    if (/\bransomware|encrypt|extortion|leak\b/.test(text)) {
        ttps.push({ name: 'Data encrypted or extortion activity', tactic: 'Impact', detail: 'Live source snippets mention ransomware, extortion, leaks, or encryption.', confidence: 0.3 })
    }
    return ttps
}
