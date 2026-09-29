type Entry = { expiresAt: number, value: unknown }

const entries = new Map<string, Entry>()
const pending = new Map<string, Promise<unknown>>()
const maxConcurrentReads = 8
const maxQueuedReads = 32
type Lane = { active: number, maxActive: number, maxQueued: number, waiters: Array<(release: () => void) => void> }
// Keep the database execution lane bounded while allowing a burst of rule
// previews to wait in the application instead of being rejected as busy.
const previewMaxQueued = 1000
const lanes = {
    default: { active: 0, maxActive: maxConcurrentReads, maxQueued: maxQueuedReads, waiters: [] },
    preview: { active: 0, maxActive: maxConcurrentReads, maxQueued: previewMaxQueued, waiters: [] },
} satisfies Record<string, Lane>
const maxEntries = 64
let cacheGeneration = 0
type ReadOptions = { lane?: keyof typeof lanes }

export class ReadAdmissionError extends Error {
    code = 'READ_CAPACITY'
    constructor() { super('Read capacity is temporarily busy. Try again shortly.') }
}

export function invalidateReadCache(prefix?: string) {
    cacheGeneration += 1
    for (const key of entries.keys()) if (!prefix || key.startsWith(prefix)) entries.delete(key)
}

function acquire(lane: Lane): Promise<() => void> {
    if (lane.active < lane.maxActive) {
        lane.active += 1
        return Promise.resolve(() => release(lane))
    }
    if (lane.waiters.length >= lane.maxQueued) throw new ReadAdmissionError()
    return new Promise(resolve => lane.waiters.push(resolve))
}

function release(lane: Lane) {
    const next = lane.waiters.shift()
    if (next) next(() => release(lane))
    else lane.active -= 1
}

export async function cachedRead<T>(key: string, ttlMs: number, work: () => Promise<T>, options: ReadOptions = {}): Promise<T> {
    const lane = lanes[options.lane || 'default']
    const cached = entries.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.value as T
    if (cached) entries.delete(key)
    const existing = pending.get(key)
    if (existing) return existing as Promise<T>
    const generation = cacheGeneration
    const operation = (async () => {
        const release = await acquire(lane)
        try {
            const value = await work()
            if (generation === cacheGeneration) {
                for (const [entryKey, entry] of entries) if (entry.expiresAt <= Date.now()) entries.delete(entryKey)
                entries.set(key, { expiresAt: Date.now() + ttlMs, value })
                while (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
            }
            return value
        } finally {
            release()
        }
    })()
    pending.set(key, operation)
    try { return await operation } finally {
        if (pending.get(key) === operation) pending.delete(key)
    }
}
