type Entry = { expiresAt: number, value: unknown }

const entries = new Map<string, Entry>()
const pending = new Map<string, Promise<unknown>>()
const maxConcurrentReads = 8
const maxQueuedReads = 32
const maxEntries = 64
let activeReads = 0
let queuedReads = 0
let cacheGeneration = 0

export class ReadAdmissionError extends Error {
    code = 'READ_CAPACITY'
    constructor() { super('Read capacity is temporarily busy. Try again shortly.') }
}

export function invalidateReadCache(prefix?: string) {
    cacheGeneration += 1
    for (const key of entries.keys()) if (!prefix || key.startsWith(prefix)) entries.delete(key)
    for (const key of pending.keys()) if (!prefix || key.startsWith(prefix)) pending.delete(key)
}

export async function cachedRead<T>(key: string, ttlMs: number, work: () => Promise<T>): Promise<T> {
    const cached = entries.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.value as T
    if (cached) entries.delete(key)
    const existing = pending.get(key)
    if (existing) return existing as Promise<T>
    if (activeReads >= maxConcurrentReads && queuedReads >= maxQueuedReads) throw new ReadAdmissionError()
    const queued = activeReads >= maxConcurrentReads
    if (queued) queuedReads += 1
    const generation = cacheGeneration
    const operation = (async () => {
        try {
            const deadline = Date.now() + 250
            while (activeReads >= maxConcurrentReads) {
                const remaining = deadline - Date.now()
                if (remaining <= 0) throw new ReadAdmissionError()
                await new Promise(resolve => setTimeout(resolve, Math.min(remaining, 10)))
            }
        } catch (error) {
            if (queued) queuedReads = Math.max(0, queuedReads - 1)
            throw error
        }
        if (queued) queuedReads = Math.max(0, queuedReads - 1)
        activeReads += 1
        try {
            const value = await work()
            if (generation === cacheGeneration) {
                for (const [entryKey, entry] of entries) if (entry.expiresAt <= Date.now()) entries.delete(entryKey)
                entries.set(key, { expiresAt: Date.now() + ttlMs, value })
                while (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
            }
            return value
        } finally {
            activeReads -= 1
        }
    })()
    pending.set(key, operation)
    try { return await operation } finally {
        if (pending.get(key) === operation) pending.delete(key)
    }
}
