export interface TiSearchRequest {
    query: string
}

export interface TiSearchResponse {
    query: string
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search'
    status?: 'queued' | 'searching' | 'partial' | 'ready'
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
}

export interface TiOperationalStatus {
    state: 'idle' | 'queued' | 'searching' | 'partial' | 'ready' | 'blocked' | 'degraded'
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

        const seeded = await liveSearch(query)
        const operationalStatus = buildOperationalStatus(body.scheduler, {
            query,
            mode: 'scraper',
            runId: run.id,
            taskCount: run.taskCount ?? 0,
            reviewTaskCount: run.reviewTaskCount ?? 0
        })
        return {
            ...seeded,
            mode: seeded.mode === 'live_search' ? 'live_search' : 'scraper',
            status: seeded.status ?? (seeded.recentActivity.length ? 'partial' : 'queued'),
            runId: run.id,
            refreshAfterSeconds: 3,
            summary: seeded.summary,
            operationalStatus,
            sources: [
                {
                    id: run.id,
                    name: 'TI scraper run',
                    type: 'scraper_run',
                    provenance: `${run.taskCount ?? 0} tasks queued, ${run.reviewTaskCount ?? 0} review tasks, ${run.rejectedSourceCount ?? 0} sources rejected by policy`
                },
                ...seeded.sources
            ],
            notes: [
                operationalStatus.headline,
                `Run ${run.id}`,
                ...seeded.notes
            ]
        }
    } catch {
        return null
    }
}

async function liveSearch(query: string): Promise<TiSearchResponse> {
    const known = knownActorProfile(query)
    const matches = await searchClearWeb(query)
    if (matches.length) {
        const generatedAt = new Date().toISOString()
        const activity = matches.slice(0, 6).map((match, index) => ({
            date: generatedAt.slice(0, 10),
            title: match.title,
            detail: match.snippet || `Live public result for ${query}: ${match.url}`,
            confidence: Math.max(0.28, 0.52 - index * 0.04),
            sourceIds: [match.id],
            url: safeTiLink(match.url)
        }))
        return {
            query,
            generatedAt,
            mode: 'live_search',
            status: 'partial',
            refreshAfterSeconds: 3,
            summary: summarizeLiveResult(query, matches, known),
            confidence: known ? 0.62 : 0.48,
            lastSeen: generatedAt,
            aliases: known?.aliases ?? [],
            recentActivity: activity,
            targets: mergeTargets(inferLiveTargets(query, matches), known?.targets ?? []),
            ttps: mergeTtps(inferLiveTtps(matches), known?.ttps ?? []),
            datasets: liveDatasets(),
            sources: matches.slice(0, 8).map(match => ({
                id: match.id,
                name: match.title,
                type: 'live_clear_web',
                provenance: match.url,
                url: safeTiLink(match.url)
            })),
            notes: [
                'Live results are discovery evidence until capture and extraction finish.',
                'Restricted sources remain metadata-only and policy-gated.'
            ],
            operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search', taskCount: matches.length })
        }
    }

    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: known ? 'partial' : 'searching',
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
        operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search' })
    }
}

function seededSearch(query: string): TiSearchResponse {
    const known = knownActorProfile(query)

    return {
        query,
        generatedAt: new Date().toISOString(),
        mode: 'live_search',
        status: known ? 'partial' : 'searching',
        refreshAfterSeconds: 3,
        summary: known?.summary ?? 'Searching',
        confidence: known ? 0.46 : 0.2,
        lastSeen: new Date().toISOString(),
        aliases: known?.aliases ?? [],
        recentActivity: [],
        targets: known?.targets ?? [],
        ttps: known?.ttps ?? [],
        datasets: liveDatasets(),
        sources: [{ id: 'live:search:unavailable', name: 'Searching', type: 'system', provenance: 'Live source discovery is not available from this API process' }],
        notes: [],
        operationalStatus: buildOperationalStatus(null, { query, mode: 'live_search' })
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
    if (input.leasedTasks > 0) return 'searching'
    if (input.queuedTasks > 0) return 'queued'
    if (!input.hasScheduler && input.fallbackTaskCount > 0) return 'partial'
    if (input.mode === 'scraper') return 'ready'
    return 'searching'
}

function operationalHeadline(state: TiOperationalStatus['state'], queued: number, leased: number, retryDebt: number, deadLetters: number) {
    if (state === 'blocked') return `${deadLetters} dead-lettered task${deadLetters === 1 ? '' : 's'} need attention before this run is healthy.`
    if (state === 'degraded') return `Scheduler is working with ${retryDebt} retry/backoff item${retryDebt === 1 ? '' : 's'}.`
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
    return null
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
}

async function searchClearWeb(query: string): Promise<LiveSearchMatch[]> {
    const [duckDuckGo, wikipedia] = await Promise.all([
        searchDuckDuckGoHtml(query),
        searchWikipedia(query)
    ])
    const merged: LiveSearchMatch[] = []
    for (const match of [...duckDuckGo, ...wikipedia]) {
        if (!merged.some(existing => existing.url === match.url || existing.title.toLowerCase() === match.title.toLowerCase())) {
            merged.push(match)
        }
    }
    return merged.slice(0, 8)
}

async function searchDuckDuckGoHtml(query: string): Promise<LiveSearchMatch[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)
    try {
        const search = new URL('https://html.duckduckgo.com/html/')
        search.searchParams.set('q', `${query} threat actor cyber`)
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
                    snippet
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
            matches.push({ id, title, url, snippet })
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
