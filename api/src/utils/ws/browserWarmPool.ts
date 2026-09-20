export const BROWSER_WARM_POOL_SIZE = 5
export const BROWSER_WARM_IDLE_MS = 15 * 60_000
export const BROWSER_WARM_MAX_AGE_MS = 120 * 60_000

export type WarmWorker = { containerId: string; wsUrl: string; streamIp: string; token: string; createdAt: number; running?: boolean }
export type WarmStatus = { state: 'starting' | 'ready' | 'claimed' | 'retired'; sessionId?: string }
type PoolAdapter = {
    inspect(slot: number): Promise<WarmWorker | null>
    create(slot: number): Promise<unknown>
    status(worker: WarmWorker): Promise<WarmStatus | null>
    claim(worker: WarmWorker, sessionId: string): Promise<boolean>
    detach(worker: WarmWorker): Promise<void>
    remove(worker: WarmWorker): Promise<void>
    retire(worker: WarmWorker): Promise<boolean>
    error(error: unknown): void
}

// Docker's five unique slot names bound the shared pool across API replicas.
// The worker's atomic claim, not this process's local snapshot, grants ownership.
export class BrowserWarmPool {
    private filling: Promise<void> | null = null
    constructor(private adapter: PoolAdapter) {}

    replenish() {
        if (this.filling) return this.filling
        this.filling = Promise.all(Array.from({ length: BROWSER_WARM_POOL_SIZE }, async (_, slot) => {
            try {
                const worker = await this.adapter.inspect(slot)
                if (worker) {
                    const status = await this.adapter.status(worker)
                    if (status?.state === 'claimed') await this.adapter.detach(worker)
                    else if (status?.state === 'retired') await this.adapter.remove(worker)
                    else if (Date.now() - worker.createdAt > BROWSER_WARM_IDLE_MS + slot * 60_000 && status?.state === 'ready') {
                        if (!await this.adapter.retire(worker)) return
                        await this.adapter.remove(worker)
                    } else if (!status && Date.now() - worker.createdAt > (worker.running === false ? 120_000 : BROWSER_WARM_MAX_AGE_MS)) await this.adapter.remove(worker)
                    else return
                }
                await this.adapter.create(slot)
            } catch (error) { this.adapter.error(error) }
        })).then(() => undefined).finally(() => { this.filling = null })
        return this.filling
    }

    async take(sessionId: string) {
        // Probe concurrently; reserve sequentially so one request never claims two.
        const workers = await Promise.all(Array.from({ length: BROWSER_WARM_POOL_SIZE }, async (_, slot) => {
            const worker = await this.adapter.inspect(slot)
            return worker && (await this.adapter.status(worker))?.state === 'ready' ? worker : null
        }))
        for (const worker of workers) {
            if (!worker || !await this.adapter.claim(worker, sessionId)) continue
            // Failure to rename must not lose ownership: maintenance will detach it.
            await this.adapter.detach(worker).catch(error => this.adapter.error(error))
            void this.replenish()
            return worker
        }
        void this.replenish()
        return null
    }
}
