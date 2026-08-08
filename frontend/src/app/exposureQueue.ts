export type ExposureQueueItem = {
    id: string
    actor: string
    company: string
    claimedData: string
    claimedDataSize: string
    country?: string
    claimTime?: string
    collectedAt?: string
    status: string
    confidence?: number
    sourceName?: string
}

export type ExposureQueue = {
    generatedAt: string
    status: string
    freshness?: {
        latestClaimAt?: string | null
        latestCollectedAt?: string | null
        ageMinutes?: number | null
        collectionAgeMinutes?: number | null
        maxLiveAgeMinutes?: number
    }
    scheduler?: {
        state?: string
        cadenceSeconds?: number
    }
    counts?: {
        visible?: number
        total?: number
        needsReview?: number
        metadataOnly?: number
    }
    page?: {
        limit?: number
        offset?: number
        total?: number
        nextOffset?: number | null
        hasMore?: boolean
    }
    items: ExposureQueueItem[]
}

export function exposureQueueFallback(status: 'checking' | 'unavailable', limit: number): ExposureQueue {
    return {
        generatedAt: new Date().toISOString(),
        status,
        freshness: { latestClaimAt: null, ageMinutes: null, maxLiveAgeMinutes: 60 },
        scheduler: { state: status, cadenceSeconds: 300 },
        page: { limit, offset: 0 },
        items: [],
    }
}

export function normalizeExposureQueue(value: unknown): ExposureQueue {
    const record = isRecord(value) ? value : {}
    const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString()
    const items = Array.isArray(record.items) ? record.items.map(normalizeExposureQueueItem).filter((item): item is ExposureQueueItem => Boolean(item)) : []
    const freshnessRecord = isRecord(record.freshness) ? record.freshness : {}
    const schedulerRecord = isRecord(record.scheduler) ? record.scheduler : {}
    const countsRecord = isRecord(record.counts) ? record.counts : {}
    const pageRecord = isRecord(record.page) ? record.page : {}
    return {
        generatedAt,
        status: String(record.status || (items.length ? 'stale' : 'checking')),
        freshness: {
            latestClaimAt: typeof freshnessRecord.latestClaimAt === 'string' || freshnessRecord.latestClaimAt === null ? freshnessRecord.latestClaimAt : undefined,
            latestCollectedAt: typeof freshnessRecord.latestCollectedAt === 'string' || freshnessRecord.latestCollectedAt === null ? freshnessRecord.latestCollectedAt : undefined,
            ageMinutes: typeof freshnessRecord.ageMinutes === 'number' || freshnessRecord.ageMinutes === null ? freshnessRecord.ageMinutes : undefined,
            collectionAgeMinutes: typeof freshnessRecord.collectionAgeMinutes === 'number' || freshnessRecord.collectionAgeMinutes === null ? freshnessRecord.collectionAgeMinutes : undefined,
            maxLiveAgeMinutes: typeof freshnessRecord.maxLiveAgeMinutes === 'number' ? freshnessRecord.maxLiveAgeMinutes : undefined,
        },
        scheduler: {
            state: typeof schedulerRecord.state === 'string' ? schedulerRecord.state : undefined,
            cadenceSeconds: typeof schedulerRecord.cadenceSeconds === 'number' ? schedulerRecord.cadenceSeconds : undefined,
        },
        counts: {
            visible: typeof countsRecord.visible === 'number' ? countsRecord.visible : undefined,
            total: typeof countsRecord.total === 'number' ? countsRecord.total : undefined,
            needsReview: typeof countsRecord.needsReview === 'number' ? countsRecord.needsReview : undefined,
            metadataOnly: typeof countsRecord.metadataOnly === 'number' ? countsRecord.metadataOnly : undefined,
        },
        page: {
            limit: typeof pageRecord.limit === 'number' ? pageRecord.limit : undefined,
            offset: typeof pageRecord.offset === 'number' ? pageRecord.offset : undefined,
            total: typeof pageRecord.total === 'number' ? pageRecord.total : undefined,
            nextOffset: typeof pageRecord.nextOffset === 'number' || pageRecord.nextOffset === null ? pageRecord.nextOffset : undefined,
            hasMore: typeof pageRecord.hasMore === 'boolean' ? pageRecord.hasMore : undefined,
        },
        items,
    }
}

function normalizeExposureQueueItem(rawItem: unknown): ExposureQueueItem | null {
    const item = isRecord(rawItem) ? rawItem : null
    const id = typeof item?.id === 'string' && item.id.trim() ? item.id : null
    const actor = typeof item?.actor === 'string' && item.actor.trim() ? item.actor : null
    const company = typeof item?.company === 'string' && item.company.trim() ? item.company : null
    if (!item || !id || !actor || !company) return null
    return {
        id,
        actor,
        company,
        claimedData: String(item.claimedData || 'Not disclosed by TA'),
        claimedDataSize: String(item.claimedDataSize || 'Not disclosed by TA'),
        country: String(item.country || 'Not disclosed by TA'),
        claimTime: typeof item.claimTime === 'string' ? item.claimTime : undefined,
        collectedAt: typeof item.collectedAt === 'string' ? item.collectedAt : undefined,
        status: String(item.status || 'unverified'),
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
        sourceName: typeof item.sourceName === 'string' ? item.sourceName : undefined,
    }
}

export function mergeExposureQueueItems(current: ExposureQueueItem[], nextItems: ExposureQueueItem[], mode: 'replace' | 'append') {
    return mode === 'append'
        ? dedupeItems([...current, ...nextItems])
        : dedupeItems([...nextItems, ...current])
}

export function dedupeItems(items: ExposureQueueItem[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

export function formatClaimTime(value?: string | null) {
    if (!value) return 'pending'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
    const hour24 = date.getUTCHours()
    const hour = hour24 % 12 || 12
    const minute = String(date.getUTCMinutes()).padStart(2, '0')
    const suffix = hour24 >= 12 ? 'PM' : 'AM'
    return `${month} ${date.getUTCDate()}, ${hour}:${minute} ${suffix} UTC`
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
