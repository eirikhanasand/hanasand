import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export type TiAdminSource = {
    id: string
    name: string
    family: string
    type: string
    accessMethod: string
    status: 'active' | 'candidate' | 'paused' | 'review'
    risk: 'low' | 'medium' | 'restricted'
    owner: string
    url: string
    domain: string
    lastRunAt: string
    nextRunAt: string
    monitoredSince: string
    cadenceMinutes: number
    retainedEvidenceCount: number
    productiveCycleCount: number
    qualifiesForBaseline: boolean
    qualificationReasons: string[]
    baselineFamily: string
    healthState: string
    lastCheckedAt: string
    lastContentAt: string
    lastUsefulAt: string
    backoffUntil?: string
    domains: string[]
    resultTypes: string[]
    buyerValue: string
    legalNotes: string
    screenshotIds: string[]
    aiReview?: TiAdminAiReview
}

export type TiAdminDomain = {
    domain: string
    company: string
    matchedTerms: string[]
    sourceIds: string[]
    resultCount: number
    lastSeenAt: string
    status: 'watching' | 'review' | 'quiet'
    aiReview?: TiAdminAiReview
}

export type TiAdminAiReview = {
    reviewer: 'hanasand-ai'
    status: 'approved' | 'rejected' | 'stale' | 'needs_human' | 'pending'
    reviewedAt: string
    confidencePercent: number
    summary: string
    checks: string[]
}

export type TiAdminCapture = {
    id: string
    sourceId: string
    sourceName: string
    sourceFamily: string
    domain: string
    actor: string
    title: string
    publishedAt: string
    capturedAt: string
    monitoredSince: string
    owner: string
    pageUrl: string
    pageType: string
    screenshotLabel: string
    screenshotTakenAt: string
    resultSummary: string
    metadata: Array<{ label: string, value: string }>
}

export type TiAdminRun = {
    id: string
    sourceId: string
    sourceName: string
    sourceFamily: string
    status: 'completed' | 'queued' | 'running' | 'failed'
    startedAt: string
    finishedAt?: string
    nextRunAt: string
    rows: number
    captures: number
    screenshots: number
    message: string
}

export type TiAdminOverview = {
    sources: TiAdminSource[]
    domains: TiAdminDomain[]
    captures: TiAdminCapture[]
    runs: TiAdminRun[]
    availability: {
        state: 'live' | 'degraded'
        failedResources: string[]
    }
    sourcePage: {
        total: number
        cursor: number
        limit: number
        nextCursor?: string
    }
    sourceTotals: {
        configured: number
        executable: number
        active: number
        qualifying: number
        qualifyingClearWeb: number
        qualifyingLawfulDarkWeb: number
        qualifyingPublicTelegram: number
    }
}

type ApiPayload = Record<string, unknown>
const TI_ADMIN_FETCH_TIMEOUT_MS = 2_500

export async function getTiAdminOverview(tenantId: string | null = 'default', page: { cursor?: number, limit?: number, sourceId?: string, includeSamples?: boolean } = {}): Promise<TiAdminOverview> {
    const base = tiScraperApiBase()
    const sampleFilter = page.sourceId ? { query: page.sourceId } : {}
    const resources = await Promise.all([
        page.includeSamples === false ? emptyResource('captures') : fetchResource(base, '/v1/intel/captures', 'captures', tenantId, sampleFilter),
        page.includeSamples === false ? emptyResource('collection-runs') : fetchResource(base, '/v1/intel/collection-runs', 'collectionRuns', tenantId, sampleFilter),
        fetchResource(base, '/v1/intel/source-operations', 'sources', tenantId, {
            cursor: Math.max(0, page.cursor || 0),
            limit: Math.max(1, Math.min(500, page.limit || 100)),
            sourceId: page.sourceId,
        }),
    ])
    const [captureResult, runResult, operationsResult] = resources
    const rawCaptures = captureResult.records
    const captures = rawCaptures.map(toCapture).filter((row): row is TiAdminCapture => Boolean(row))
    const sources = operationsResult.records
        .map(row => toSource(row, row, captures))
        .filter((row): row is TiAdminSource => Boolean(row))
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const runs = runResult.records.map(row => toRun(row, sourceById)).filter((row): row is TiAdminRun => Boolean(row))

    return {
        sources,
        domains: domainsFromCaptures(captures),
        captures: captures.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt)),
        runs: runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
        availability: {
            state: resources.every(result => result.ok) ? 'live' : 'degraded',
            failedResources: resources.filter(result => !result.ok).map(result => result.resource),
        },
        sourcePage: {
            total: operationsResult.total,
            cursor: Math.max(0, page.cursor || 0),
            limit: Math.max(1, Math.min(500, page.limit || 100)),
            nextCursor: operationsResult.nextCursor,
        },
        sourceTotals: sourceTotals(operationsResult.payload),
    }
}

export async function getTiAdminSource(id: string, tenantId: string | null = 'default') {
    return (await getTiAdminOverview(tenantId, { sourceId: id })).sources[0] || null
}

export async function getTiAdminDomain(domain: string) {
    const decoded = decodeURIComponent(domain)
    return (await getTiAdminOverview()).domains.find(item => item.domain === decoded) || null
}

export function sourceRuns(overview: TiAdminOverview, sourceId: string) {
    return overview.runs.filter(run => run.sourceId === sourceId)
}

export function sourceCaptures(overview: TiAdminOverview, sourceId: string) {
    return overview.captures.filter(capture => capture.sourceId === sourceId)
}

export function domainCaptures(overview: TiAdminOverview, domain: string) {
    return overview.captures.filter(capture => capture.domain === domain)
}

export function sourceById(overview: TiAdminOverview, id: string) {
    return overview.sources.find(source => source.id === id)
}

export function formatTiDate(value: string) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return 'not recorded'
    return new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Oslo',
    }).format(date)
}

export function ageDays(since: string) {
    const diff = Date.now() - new Date(since).getTime()
    return Number.isFinite(diff) ? Math.max(1, Math.round(diff / 86400000)) : 0
}

async function fetchResource(base: string, path: string, key: string, tenantId: string | null, page: { cursor?: number, limit?: number, sourceId?: string, query?: string } = {}) {
    const resource = path.split('/').at(-1) || key
    try {
        const target = new URL(path, base)
        if (tenantId) target.searchParams.set('tenantId', tenantId)
        target.searchParams.set('limit', String(page.limit || 500))
        if (page.cursor) target.searchParams.set('cursor', String(page.cursor))
        if (page.sourceId) target.searchParams.set('sourceId', page.sourceId)
        if (page.query) target.searchParams.set('q', page.query)
        const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
        const response = await fetch(target, {
            cache: 'no-store',
            headers: serviceToken ? { 'x-hanasand-service-token': serviceToken } : undefined,
            signal: AbortSignal.timeout(TI_ADMIN_FETCH_TIMEOUT_MS),
        })
        if (!response.ok) return { resource, ok: false, records: [] as ApiPayload[], total: 0, nextCursor: undefined, payload: {} as ApiPayload }
        const payload = await response.json() as ApiPayload
        const records = recordArray(payload[key])
        return {
            resource,
            ok: true,
            records,
            total: numberValue(payload.total, records.length),
            nextCursor: stringValue(payload.nextCursor) || undefined,
            payload,
        }
    } catch {
        return { resource, ok: false, records: [] as ApiPayload[], total: 0, nextCursor: undefined, payload: {} as ApiPayload }
    }
}

function emptyResource(resource: string) {
    return { resource, ok: true, records: [] as ApiPayload[], total: 0, nextCursor: undefined, payload: {} as ApiPayload }
}

function sourceTotals(payload: ApiPayload): TiAdminOverview['sourceTotals'] {
    const summary = objectValue(payload.summary)
    const counts = objectValue(objectValue(payload.qualification).counts)
    return {
        configured: numberValue(summary.sourceCount),
        executable: numberValue(summary.retainedSourceCount, summary.activeSourceCount),
        active: numberValue(summary.activeSourceCount),
        qualifying: numberValue(counts.total),
        qualifyingClearWeb: numberValue(counts.clearWeb),
        qualifyingLawfulDarkWeb: numberValue(counts.lawfulDarkWeb),
        qualifyingPublicTelegram: numberValue(counts.publicTelegram),
    }
}

function toSource(record: ApiPayload, operations: ApiPayload | undefined, captures: TiAdminCapture[]): TiAdminSource | undefined {
    const id = stringValue(record.id)
    if (!id) return undefined
    const collection = objectValue(record.collection)
    const operatingMode = objectValue(record.operatingMode)
    const health = objectValue(operations?.health)
    const coverage = objectValue(operations?.coverage)
    const qualification = objectValue(operations?.qualification)
    const automaticReview = objectValue(objectValue(operations?.verification).automaticReview)
    const cadenceMinutes = Math.max(1, Math.round(numberValue(collection.cadenceSeconds, 3600) / 60))
    const monitoredSince = isoValue(collection.createdAt)
    const lastRunAt = isoValue(health.lastAttemptAt, health.lastSuccessAt)
    const nextRunAt = isoValue(record.nextRunAt) || (lastRunAt ? new Date(Date.parse(lastRunAt) + cadenceMinutes * 60_000).toISOString() : '')
    const sourceCaptures = captures.filter(capture => capture.sourceId === id)
    const retainedEvidenceCount = numberValue(coverage.captureCount, sourceCaptures.length)
    const url = stringValue(record.url)

    return {
        id,
        name: textValue(record.name, id),
        family: textValue(operations?.family, record.type, 'unknown'),
        type: textValue(record.type, 'unknown'),
        accessMethod: textValue(operatingMode.accessMethod, 'not recorded'),
        status: sourceStatus(record.status ?? operations?.lifecycleStatus),
        risk: sourceRisk(operatingMode.risk ?? record.risk),
        owner: textValue(record.owner, 'source-ops'),
        url,
        domain: hostname(url) || textValue(operations?.family, record.type, 'source'),
        lastRunAt,
        nextRunAt,
        monitoredSince,
        cadenceMinutes,
        retainedEvidenceCount,
        productiveCycleCount: numberValue(qualification.productiveCheckCount, qualification.usefulCheckCount),
        qualifiesForBaseline: qualification.qualifies === true,
        qualificationReasons: listValue(qualification.reasons).map(stringValue).filter(Boolean),
        baselineFamily: textValue(qualification.family, 'not qualifying'),
        healthState: textValue(health.state, 'not observed'),
        lastCheckedAt: isoValue(qualification.lastCheckedAt, health.lastAttemptAt),
        lastContentAt: isoValue(qualification.lastContentAt),
        lastUsefulAt: isoValue(qualification.lastUsefulAt),
        backoffUntil: optionalIso(qualification.backoffUntil),
        domains: unique([...listValue(coverage.observedDomains).map(stringValue), ...sourceCaptures.map(capture => capture.domain)].filter(domain => domain && domain !== 'unresolved')),
        resultTypes: unique([...listValue(coverage.resultTypes).map(stringValue), ...sourceCaptures.map(capture => capture.pageType)].filter(Boolean)),
        buyerValue: retainedEvidenceCount ? `${retainedEvidenceCount} retained evidence capture${retainedEvidenceCount === 1 ? '' : 's'} recorded; this page shows a bounded recent sample.` : 'No accepted captures are stored for this source.',
        legalNotes: `${textValue(operatingMode.legalMode, 'operating mode not recorded')} · approval ${textValue(operatingMode.approvalState, 'not recorded')}`,
        screenshotIds: sourceCaptures.filter(capture => capture.screenshotLabel !== 'not captured').map(capture => capture.id),
        aiReview: toAiReview(automaticReview),
    }
}

function toAiReview(review: ApiPayload): TiAdminAiReview | undefined {
    const state = stringValue(review.state)
    if (!state) return undefined
    const status = state === 'approved'
        ? 'approved'
        : state === 'rejected'
            ? 'rejected'
            : state === 'stale'
                ? 'stale'
                : state === 'needs_review'
                    ? 'needs_human'
                    : 'pending'
    const confidence = Math.max(0, Math.min(1, numberValue(review.confidence)))
    return {
        reviewer: 'hanasand-ai',
        status,
        reviewedAt: isoValue(review.reviewedAt),
        confidencePercent: Math.round(confidence * 100),
        summary: state === 'approved'
            ? 'Approved from retained source evidence.'
            : state === 'rejected'
                ? 'Rejected from retained source evidence.'
                : state === 'stale'
                    ? 'The approved review no longer matches retained evidence.'
                    : state === 'needs_review'
                        ? 'Automatic review needs human follow-up.'
                        : 'Automatic review is pending.',
        checks: [textValue(review.claimValidity), textValue(review.modelVersion)].filter(Boolean),
    }
}

function toCapture(record: ApiPayload): TiAdminCapture | undefined {
    const id = stringValue(record.id)
    const sourceId = stringValue(record.sourceId)
    const capturedAt = isoValue(record.collectedAt)
    if (!id || !sourceId || !capturedAt) return undefined
    const metadata = objectValue(record.metadata)
    const provenance = objectValue(record.provenance)
    const publicUrl = stringValue(record.url)
    const domain = captureDomain(metadata, publicUrl)
    const screenshotId = textValue(metadata.screenshotId, metadata.screenshotHash)
    const actor = textValue(metadata.actor, metadata.group, metadata.threatActor, 'Not extracted')
    const title = textValue(metadata.title, metadata.headline, metadata.claimTitle, `${actor === 'Not extracted' ? 'Evidence' : actor} capture`)
    const publishedAt = isoValue(record.publishedAt, capturedAt)
    const pageType = textValue(metadata.pageType, metadata.kind, metadata.adapter, record.mediaType, record.storageKind, 'capture')

    return {
        id,
        sourceId,
        sourceName: textValue(record.sourceName, sourceId),
        sourceFamily: textValue(record.sourceFamily, 'source'),
        domain,
        actor,
        title,
        publishedAt,
        capturedAt,
        monitoredSince: isoValue(provenance.firstObservedAt, publishedAt, capturedAt),
        owner: textValue(metadata.owner, 'source-ops'),
        pageUrl: publicUrl || (record.locatorRedacted ? 'restricted locator redacted' : 'not recorded'),
        pageType,
        screenshotLabel: screenshotId || 'not captured',
        screenshotTakenAt: isoValue(metadata.screenshotTakenAt, capturedAt),
        resultSummary: textValue(metadata.summary, metadata.safeExcerpt, record.redactionReason, 'Captured evidence metadata is available for review.'),
        metadata: captureMetadata(record, metadata),
    }
}

function toRun(record: ApiPayload, sources: Map<string, TiAdminSource>): TiAdminRun | undefined {
    const id = stringValue(record.id)
    const sourceId = stringValue(record.sourceId) || listValue(record.sourceIds).map(item => stringValue(item)).find(Boolean) || ''
    const startedAt = isoValue(record.startedAt, record.createdAt)
    if (!id || !sourceId || !startedAt) return undefined
    const source = sources.get(sourceId)
    return {
        id,
        sourceId,
        sourceName: textValue(record.sourceName, source?.name, sourceId),
        sourceFamily: textValue(record.sourceFamily, source?.family, 'source'),
        status: runStatus(record.status),
        startedAt,
        finishedAt: optionalIso(record.finishedAt, record.completedAt, record.updatedAt),
        nextRunAt: isoValue(record.nextRunAt, source?.nextRunAt, startedAt),
        rows: numberValue(record.rows, record.rowCount, record.processedCount, record.itemCount),
        captures: numberValue(record.captures, record.captureCount),
        screenshots: numberValue(record.screenshots, record.screenshotCount),
        message: textValue(record.message, record.error, `Collection run ${textValue(record.status, 'recorded')}.`),
    }
}

function domainsFromCaptures(captures: TiAdminCapture[]): TiAdminDomain[] {
    const grouped = new Map<string, TiAdminCapture[]>()
    for (const capture of captures) {
        if (capture.domain === 'unresolved') continue
        grouped.set(capture.domain, [...(grouped.get(capture.domain) || []), capture])
    }
    return [...grouped.entries()].map(([domain, rows]) => ({
        domain,
        company: titleCase(domain.split('.')[0].replaceAll('-', ' ')),
        matchedTerms: [domain],
        sourceIds: unique(rows.map(row => row.sourceId)),
        resultCount: rows.length,
        lastSeenAt: rows.map(row => row.capturedAt).sort().at(-1)!,
        status: 'review' as const,
    })).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
}

function captureMetadata(record: ApiPayload, metadata: ApiPayload) {
    const rows = [
        ['Content hash', record.contentHash],
        ['Storage', record.storageKind],
        ['Media type', record.mediaType],
        ['Retention', record.retentionClass],
        ['Parser', metadata.parserVersion ?? metadata.extractorVersion],
        ['Review', metadata.reviewState],
    ]
    return rows.map(([label, value]) => ({ label: String(label), value: textValue(value) })).filter(row => row.value)
}

function captureDomain(metadata: ApiPayload, url: string) {
    const direct = textValue(metadata.domain, metadata.victimDomain, metadata.hostname)
    if (direct) return direct.toLowerCase()
    const matched = listValue(metadata.matchedWatchTerms).map(item => stringValue(item)).find(value => value.includes('.'))
    return (matched || hostname(url) || 'unresolved').toLowerCase()
}

function sourceStatus(value: unknown): TiAdminSource['status'] {
    const status = stringValue(value).toLowerCase()
    if (['active', 'approved', 'canary'].includes(status)) return 'active'
    if (['paused', 'disabled', 'rejected'].includes(status)) return 'paused'
    if (['review', 'approval_required'].includes(status)) return 'review'
    return 'candidate'
}

function sourceRisk(value: unknown): TiAdminSource['risk'] {
    const risk = stringValue(value).toLowerCase()
    if (['restricted', 'high'].includes(risk)) return 'restricted'
    if (risk === 'medium') return 'medium'
    return 'low'
}

function runStatus(value: unknown): TiAdminRun['status'] {
    const status = stringValue(value).toLowerCase()
    if (['queued', 'pending'].includes(status)) return 'queued'
    if (['running', 'leased', 'processing'].includes(status)) return 'running'
    if (['failed', 'error', 'dead_letter'].includes(status)) return 'failed'
    return 'completed'
}

function objectValue(value: unknown): ApiPayload {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiPayload : {}
}

function recordArray(value: unknown): ApiPayload[] {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as ApiPayload[] : []
}

function listValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function textValue(...values: unknown[]) {
    return values.map(stringValue).find(Boolean) || ''
}

function numberValue(...values: unknown[]) {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number) && number >= 0) return number
    }
    return 0
}

function optionalIso(...values: unknown[]) {
    for (const value of values) {
        const date = new Date(stringValue(value))
        if (Number.isFinite(date.getTime())) return date.toISOString()
    }
    return undefined
}

function isoValue(...values: unknown[]) {
    return optionalIso(...values) || ''
}

function hostname(value: string) {
    try { return new URL(value).hostname }
    catch { return '' }
}

function unique(values: string[]) {
    return [...new Set(values)]
}

function titleCase(value: string) {
    return value.replace(/\b\w/g, letter => letter.toUpperCase())
}
