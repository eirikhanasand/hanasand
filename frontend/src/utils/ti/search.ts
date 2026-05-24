import config from '@/config'

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
    recentActivity: Array<{
        date: string
        title: string
        detail: string
        confidence: number
        sourceIds: string[]
        url?: string
    }>
    targets: Array<{
        sector: string
        regions: string[]
        rationale: string
        confidence: number
    }>
    ttps: Array<{
        name: string
        attackId?: string
        tactic: string
        detail: string
        confidence: number
    }>
    datasets: Array<{
        name: string
        type: string
        coverage: string
        status: string
        url?: string
    }>
    sources: Array<{
        id: string
        name: string
        type: string
        provenance: string
        url?: string
    }>
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
    budgets: Array<{
        workClass: string
        queued: number
        leased: number
        budgetSlots: number
        maxAgeSeconds: number
        retryDebt: number
        action: string
    }>
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

export default async function searchThreatIntel(query: string): Promise<TiSearchResponse | null> {
    const response = await fetch(`${config.url.api}/ti/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    })

    if (!response.ok) {
        return null
    }

    return await response.json() as TiSearchResponse
}
