type Entry = { value?: unknown, updatedAt: number, retryAt: number, pending?: Promise<unknown> }
const entries = new Map<string, Entry>()
const MAX_ENTRIES = 128
const MAX_STALE_MS = 5 * 60_000

// Call only after authorization. Log records are shared by system administrators,
// but neither cached data nor an in-flight refresh grants access to a request.
export async function cachedLogQuery<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    let entry = entries.get(key)
    if (!entry) {
        if (entries.size >= MAX_ENTRIES) {
            const oldest = [...entries].find(([, candidate]) => !candidate.pending)
            if (oldest) entries.delete(oldest[0])
            else return load()
        }
        entry = { updatedAt: 0, retryAt: 0 }
        entries.set(key, entry)
    }
    const current = entry
    const age = Date.now() - current.updatedAt
    if (current.value !== undefined && age < ttl) return current.value as T

    if (!current.pending && Date.now() >= current.retryAt) {
        current.pending = load().then(value => {
            current.value = value
            current.updatedAt = Date.now()
            current.retryAt = 0
            return value
        }).catch(error => {
            current.retryAt = Date.now() + 5000
            throw error
        }).finally(() => { current.pending = undefined })
        // Refresh failures must be observed even when returning a previous snapshot.
        void current.pending.catch(() => console.warn('Log snapshot refresh failed; retrying in five seconds.'))
    }
    if (current.value !== undefined && age < MAX_STALE_MS) return current.value as T
    if (current.pending) return current.pending as Promise<T>
    throw new Error('Log snapshot is unavailable. Please retry shortly.')
}
