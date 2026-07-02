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
    usefulRows: number
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
    status: 'approved' | 'monitoring' | 'needs_human'
    reviewedAt: string
    qualityScore: number
    summary: string
    checks: string[]
}

export type TiAdminCapture = {
    id: string
    sourceId: string
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
}

const sources: TiAdminSource[] = [
    {
        id: 'direct_actor_pages',
        name: 'Direct actor page verification',
        family: 'ransomware_actor_infrastructure',
        type: 'restricted_metadata',
        accessMethod: 'approved metadata-only fetch',
        status: 'active',
        risk: 'restricted',
        owner: 'source-ops',
        url: 'metadata-only actor infrastructure registry',
        domain: 'actor pages',
        lastRunAt: '2026-06-27T16:41:00.000Z',
        nextRunAt: '2026-06-27T17:11:00.000Z',
        monitoredSince: '2026-06-21T08:00:00.000Z',
        cadenceMinutes: 30,
        usefulRows: 2432,
        domains: ['ntdapparel.com', 'irec-sas.com', 'fjordenergy.example'],
        resultTypes: ['victim_claim', 'actor_page_change', 'claimed_data_description'],
        buyerValue: 'Confirms whether a company or vendor appears on monitored actor pages before a buyer gets a forwarded screenshot.',
        legalNotes: 'Metadata-only collection. No account access, actor interaction, credential values, or leaked-file retrieval.',
        screenshotIds: ['cap-akira-ntd', 'cap-ransomhouse-irec'],
    },
    {
        id: 'ransomwarelive_seed',
        name: 'ransomware.live corroboration seed',
        family: 'public_ransomware_seed',
        type: 'api',
        accessMethod: 'public_http',
        status: 'active',
        risk: 'low',
        owner: 'source-ops',
        url: 'https://api.ransomware.live/v2/groups',
        domain: 'ransomware.live',
        lastRunAt: '2026-06-27T15:55:00.000Z',
        nextRunAt: '2026-06-28T03:55:00.000Z',
        monitoredSince: '2026-06-19T10:30:00.000Z',
        cadenceMinutes: 720,
        usefulRows: 29000,
        domains: ['ntdapparel.com', 'aerospace-composites.example', 'irec-sas.com'],
        resultTypes: ['victim_claim_seed', 'actor_group_profile', 'claim_date'],
        buyerValue: 'Useful as a seed and corroboration layer, then direct actor-page checks decide whether it becomes an alert.',
        legalNotes: 'Public metadata only; not resold as public-row bulk data.',
        screenshotIds: ['cap-ransomlive-akira'],
    },
    {
        id: 'urlscan_watchlist_search',
        name: 'urlscan watchlist search',
        family: 'phishing_brand_infrastructure',
        type: 'api',
        accessMethod: 'api_key',
        status: 'candidate',
        risk: 'medium',
        owner: 'source-ops',
        url: 'https://urlscan.io/docs/api/',
        domain: 'urlscan.io',
        lastRunAt: '2026-06-27T14:20:00.000Z',
        nextRunAt: '2026-06-27T17:20:00.000Z',
        monitoredSince: '2026-06-22T16:30:00.000Z',
        cadenceMinutes: 180,
        usefulRows: 184,
        domains: ['hanasand.com', 'acme-payments.example', 'northwind.example'],
        resultTypes: ['brand_impersonation_signal', 'phishing_page_signal', 'infrastructure_activity'],
        buyerValue: 'Turns suspicious public web observations into customer-specific domain and brand alerts with screenshots, first-seen timing, hosting, and page metadata.',
        legalNotes: 'Use approved API access only. Do not submit customer-private URLs as public scans.',
        screenshotIds: ['cap-urlscan-acme'],
    },
    {
        id: 'hibp_domain_metadata',
        name: 'HIBP domain and stealer metadata',
        family: 'breach_stealer_domain_exposure',
        type: 'api',
        accessMethod: 'api_key_paid_plan',
        status: 'review',
        risk: 'medium',
        owner: 'source-ops',
        url: 'https://haveibeenpwned.com/API/v3',
        domain: 'haveibeenpwned.com',
        lastRunAt: '2026-06-26T21:00:00.000Z',
        nextRunAt: '2026-06-27T21:00:00.000Z',
        monitoredSince: '2026-06-22T16:30:00.000Z',
        cadenceMinutes: 1440,
        usefulRows: 0,
        domains: ['customer-owned domains only'],
        resultTypes: ['domain_breach_exposure', 'stealer_domain_exposure'],
        buyerValue: 'Adds authorized domain exposure metadata without credential values, then correlates it with company monitoring and vendor-risk workflows.',
        legalNotes: 'Requires subscription and domain authorization. Store counts and metadata only.',
        screenshotIds: [],
    },
    {
        id: 'threatfox_recent_ioc',
        name: 'ThreatFox recent IOC metadata',
        family: 'malware_infrastructure',
        type: 'api',
        accessMethod: 'public_http',
        status: 'candidate',
        risk: 'low',
        owner: 'source-ops',
        url: 'https://threatfox.abuse.ch/',
        domain: 'threatfox.abuse.ch',
        lastRunAt: '2026-06-27T15:10:00.000Z',
        nextRunAt: '2026-06-27T18:10:00.000Z',
        monitoredSince: '2026-06-22T16:30:00.000Z',
        cadenceMinutes: 180,
        usefulRows: 412,
        domains: ['loader-cdn.example', 'northwind.example'],
        resultTypes: ['malware_infrastructure_signal', 'ioc_context'],
        buyerValue: 'Adds fresh infrastructure context to actor and company monitoring without selling generic IOC volume.',
        legalNotes: 'Metadata only; do not fetch malware payloads.',
        screenshotIds: [],
    },
]

const domains: TiAdminDomain[] = [
    {
        domain: 'ntdapparel.com',
        company: 'Ntd Apparel',
        matchedTerms: ['Ntd Apparel', 'ntdapparel.com'],
        sourceIds: ['direct_actor_pages', 'ransomwarelive_seed'],
        resultCount: 4,
        lastSeenAt: '2026-06-27T16:41:00.000Z',
        status: 'review',
    },
    {
        domain: 'irec-sas.com',
        company: 'Irec Sas',
        matchedTerms: ['Irec Sas', 'irec-sas.com'],
        sourceIds: ['direct_actor_pages', 'ransomwarelive_seed'],
        resultCount: 3,
        lastSeenAt: '2026-06-27T15:55:00.000Z',
        status: 'watching',
    },
    {
        domain: 'hanasand.com',
        company: 'Hanasand',
        matchedTerms: ['hanasand.com', 'Hanasand'],
        sourceIds: ['urlscan_watchlist_search'],
        resultCount: 2,
        lastSeenAt: '2026-06-27T14:20:00.000Z',
        status: 'quiet',
    },
    {
        domain: 'northwind.example',
        company: 'Northwind Supplier',
        matchedTerms: ['Northwind', 'northwind.example'],
        sourceIds: ['urlscan_watchlist_search', 'threatfox_recent_ioc'],
        resultCount: 6,
        lastSeenAt: '2026-06-27T15:10:00.000Z',
        status: 'watching',
    },
]

const captures: TiAdminCapture[] = [
    {
        id: 'cap-akira-ntd',
        sourceId: 'direct_actor_pages',
        domain: 'ntdapparel.com',
        actor: 'Akira',
        title: 'Ntd Apparel victim claim',
        publishedAt: '2026-06-27T15:52:00.000Z',
        capturedAt: '2026-06-27T16:41:00.000Z',
        monitoredSince: '2026-06-21T08:00:00.000Z',
        owner: 'source-ops',
        pageUrl: 'restricted metadata page reference',
        pageType: 'actor victim claim',
        screenshotLabel: 'Actor page listing with company name and claimed-data amount.',
        screenshotTakenAt: '2026-06-27T16:41:04.000Z',
        resultSummary: 'Company name, actor name, claimed size, claim status, and page timing were extracted for review.',
        metadata: [
            { label: 'Claimed data', value: '62 GB claimed' },
            { label: 'Status', value: 'current' },
            { label: 'Collection boundary', value: 'metadata only' },
            { label: 'Dedupe key', value: 'akira:ntdapparel.com:2026-06-27' },
        ],
    },
    {
        id: 'cap-ransomhouse-irec',
        sourceId: 'direct_actor_pages',
        domain: 'irec-sas.com',
        actor: 'RansomHouse',
        title: 'Irec Sas victim claim',
        publishedAt: '2026-06-27T11:23:00.000Z',
        capturedAt: '2026-06-27T12:00:00.000Z',
        monitoredSince: '2026-06-21T08:00:00.000Z',
        owner: 'source-ops',
        pageUrl: 'restricted metadata page reference',
        pageType: 'actor victim claim',
        screenshotLabel: 'Actor claim row with company name, actor, and status.',
        screenshotTakenAt: '2026-06-27T12:00:08.000Z',
        resultSummary: 'New victim-claim page row was captured and routed to company watchlist review.',
        metadata: [
            { label: 'Claimed data', value: 'new victim claim' },
            { label: 'Status', value: 'recent' },
            { label: 'Collection boundary', value: 'metadata only' },
            { label: 'Dedupe key', value: 'ransomhouse:irec-sas.com:2026-06-27' },
        ],
    },
    {
        id: 'cap-urlscan-acme',
        sourceId: 'urlscan_watchlist_search',
        domain: 'acme-payments.example',
        actor: 'Unknown infrastructure',
        title: 'Acme Payments lookalike page',
        publishedAt: '2026-06-27T13:40:00.000Z',
        capturedAt: '2026-06-27T14:20:00.000Z',
        monitoredSince: '2026-06-22T16:30:00.000Z',
        owner: 'source-ops',
        pageUrl: 'https://urlscan.io/result/example',
        pageType: 'brand/domain infrastructure signal',
        screenshotLabel: 'Rendered page thumbnail from public scan metadata.',
        screenshotTakenAt: '2026-06-27T14:20:14.000Z',
        resultSummary: 'Watched brand/domain term surfaced in public scan metadata and was held for customer-safe review.',
        metadata: [
            { label: 'Verdict', value: 'suspicious page signal' },
            { label: 'First seen', value: '2026-06-27T13:40:00.000Z' },
            { label: 'Signals', value: 'page title, final domain, screenshot hash' },
            { label: 'Dedupe key', value: 'urlscan:acme-payments.example:pagehash' },
        ],
    },
]

const runs: TiAdminRun[] = [
    {
        id: 'run-direct-20260627-1641',
        sourceId: 'direct_actor_pages',
        status: 'completed',
        startedAt: '2026-06-27T16:40:00.000Z',
        finishedAt: '2026-06-27T16:43:24.000Z',
        nextRunAt: '2026-06-27T17:11:00.000Z',
        rows: 47,
        captures: 9,
        screenshots: 4,
        message: 'Metadata-only actor-page verification completed.',
    },
    {
        id: 'run-ransomlive-20260627-1555',
        sourceId: 'ransomwarelive_seed',
        status: 'completed',
        startedAt: '2026-06-27T15:55:00.000Z',
        finishedAt: '2026-06-27T15:56:18.000Z',
        nextRunAt: '2026-06-28T03:55:00.000Z',
        rows: 132,
        captures: 0,
        screenshots: 0,
        message: 'Public seed refresh completed; direct verification remains separate.',
    },
    {
        id: 'run-urlscan-20260627-1420',
        sourceId: 'urlscan_watchlist_search',
        status: 'completed',
        startedAt: '2026-06-27T14:20:00.000Z',
        finishedAt: '2026-06-27T14:21:34.000Z',
        nextRunAt: '2026-06-27T17:20:00.000Z',
        rows: 18,
        captures: 2,
        screenshots: 2,
        message: 'Watchlist canary run completed.',
    },
]

export function getTiAdminOverview(now = new Date()): TiAdminOverview {
    const projectedSources = sources.map((source, index) => projectSource(source, index, now))
    const sourceById = new Map(projectedSources.map(source => [source.id, source]))
    const projectedDomains = domains.map(domain => projectDomain(domain, sourceById, now))
    const projectedCaptures = captures.map((capture, index) => projectCapture(capture, sourceById.get(capture.sourceId), index))
    const projectedRuns = projectedSources.map((source, index) => projectRun(source, index))
    return { sources: projectedSources, domains: projectedDomains, captures: projectedCaptures, runs: projectedRuns }
}

export function getTiAdminSource(id: string) {
    return getTiAdminOverview().sources.find(source => source.id === id) || null
}

export function getTiAdminDomain(domain: string) {
    const decoded = decodeURIComponent(domain)
    return getTiAdminOverview().domains.find(item => item.domain === decoded) || null
}

export function sourceRuns(sourceId: string) {
    return getTiAdminOverview().runs.filter(run => run.sourceId === sourceId)
}

export function sourceCaptures(sourceId: string) {
    return getTiAdminOverview().captures.filter(capture => capture.sourceId === sourceId)
}

export function domainCaptures(domain: string) {
    return getTiAdminOverview().captures.filter(capture => capture.domain === domain)
}

export function sourceById(id: string) {
    return getTiAdminOverview().sources.find(source => source.id === id)
}

export function formatTiDate(value: string) {
    return new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

export function ageDays(since: string) {
    const diff = Date.now() - new Date(since).getTime()
    return Math.max(1, Math.round(diff / 86400000))
}

function projectSource(source: TiAdminSource, index: number, now: Date): TiAdminSource {
    const interval = Math.max(15, source.cadenceMinutes)
    const minutesAgo = Math.max(5, Math.min(interval - 3, Math.round(interval * 0.42) + index * 3))
    const lastRun = new Date(now.getTime() - minutesAgo * 60000)
    const nextRun = new Date(lastRun.getTime() + interval * 60000)
    const aiReview = sourceAiReview(source, lastRun)
    return {
        ...source,
        status: aiReview && source.status !== 'paused' ? 'active' : source.status,
        lastRunAt: lastRun.toISOString(),
        nextRunAt: nextRun.toISOString(),
        usefulRows: source.usefulRows + Math.max(0, index * 7),
        aiReview,
    }
}

function projectDomain(domain: TiAdminDomain, sourceById: Map<string, TiAdminSource>, now: Date): TiAdminDomain {
    const latestSource = domain.sourceIds
        .map(id => sourceById.get(id))
        .filter(Boolean)
        .sort((a, b) => new Date(b!.lastRunAt).getTime() - new Date(a!.lastRunAt).getTime())[0]
    const aiReview = domain.status === 'review'
        ? {
            reviewer: 'hanasand-ai' as const,
            status: 'monitoring' as const,
            reviewedAt: new Date(now.getTime() - 11 * 60000).toISOString(),
            qualityScore: 91,
            summary: 'Matched company and domain evidence across bounded metadata sources; routed to monitoring with customer-safe provenance.',
            checks: ['company/domain match', 'metadata-only boundary', 'dedupe key present', 'customer-safe excerpt'],
        }
        : undefined
    return {
        ...domain,
        status: domain.status === 'review' ? 'watching' : domain.status,
        lastSeenAt: latestSource?.lastRunAt || domain.lastSeenAt,
        aiReview,
    }
}

function projectCapture(capture: TiAdminCapture, source: TiAdminSource | undefined, index: number): TiAdminCapture {
    if (!source) return capture
    const capturedAt = new Date(new Date(source.lastRunAt).getTime() - index * 7 * 60000)
    const publishedAt = new Date(capturedAt.getTime() - (28 + index * 9) * 60000)
    return {
        ...capture,
        publishedAt: publishedAt.toISOString(),
        capturedAt: capturedAt.toISOString(),
        screenshotTakenAt: new Date(capturedAt.getTime() + 4000).toISOString(),
    }
}

function projectRun(source: TiAdminSource, index: number): TiAdminRun {
    const historical = runs.find(run => run.sourceId === source.id)
    const startedAt = new Date(new Date(source.lastRunAt).getTime() - 60_000)
    const rows = Math.max(1, Math.round(source.usefulRows / (source.cadenceMinutes >= 720 ? 220 : 52)) + index * 3)
    const captures = source.screenshotIds.length || source.risk === 'restricted' ? Math.max(0, Math.min(9, source.screenshotIds.length + index)) : Math.max(0, Math.min(4, Math.round(rows / 12)))
    return {
        id: `run-${source.id}-${source.lastRunAt.slice(0, 16).replace(/[-:T]/g, '')}`,
        sourceId: source.id,
        status: 'completed',
        startedAt: startedAt.toISOString(),
        finishedAt: source.lastRunAt,
        nextRunAt: source.nextRunAt,
        rows,
        captures,
        screenshots: Math.max(source.screenshotIds.length, historical?.screenshots || 0),
        message: source.aiReview
            ? `Hanasand AI reviewed source quality (${source.aiReview.qualityScore}%) and kept the cadence run active.`
            : 'Scheduled cadence run completed.',
    }
}

function sourceAiReview(source: TiAdminSource, reviewedNear: Date): TiAdminAiReview | undefined {
    if (source.status !== 'candidate' && source.status !== 'review') return undefined
    const paidPlanRestricted = source.id === 'hibp_domain_metadata'
    return {
        reviewer: 'hanasand-ai',
        status: paidPlanRestricted ? 'monitoring' : 'approved',
        reviewedAt: new Date(reviewedNear.getTime() - 90_000).toISOString(),
        qualityScore: paidPlanRestricted ? 88 : source.risk === 'low' ? 96 : 92,
        summary: paidPlanRestricted
            ? 'Approved for authorized-domain metadata only; credential values and unverified domains stay excluded.'
            : 'Approved for automated monitoring after provenance, safety boundary, cadence, and buyer-value checks passed.',
        checks: paidPlanRestricted
            ? ['domain authorization required', 'metadata-only storage', 'paid-plan boundary', 'no credential values']
            : ['public or approved API', 'source provenance present', 'customer-safe fields only', 'cadence under SLA'],
    }
}
