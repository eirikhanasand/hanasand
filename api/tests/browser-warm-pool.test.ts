import { describe, expect, test } from 'bun:test'
import { BrowserWarmPool, BROWSER_WARM_MAX_AGE_MS, type WarmWorker } from '../src/utils/ws/browserWarmPool.ts'
import { SingleUseBrowser } from '../src/utils/ws/singleUseBrowser.ts'

function fixture() {
    let sequence = 0
    const slots = new Map<number, WarmWorker>()
    const states = new Map<string, SingleUseBrowser<object>>()
    const removed: string[] = []
    const errors: unknown[] = []
    const adapter = {
        async inspect(slot: number) { return slots.get(slot) || null },
        async create(slot: number) {
            if (slots.has(slot)) return // Atomic Docker name reservation.
            const id = String(++sequence)
            slots.set(slot, { containerId: id, streamIp: id, wsUrl: id, token: id, createdAt: Date.now(), running: true })
            const state = new SingleUseBrowser<object>()
            state.ready({ id })
            states.set(id, state)
        },
        async status(worker: WarmWorker) { return states.get(worker.containerId)! },
        async claim(worker: WarmWorker, id: string) { return states.get(worker.containerId)!.claim(id) },
        async detach(worker: WarmWorker) {
            for (const [slot, value] of slots) if (value.containerId === worker.containerId) slots.delete(slot)
        },
        async remove(worker: WarmWorker) { removed.push(worker.containerId); await adapter.detach(worker) },
        async retire(worker: WarmWorker) { return states.get(worker.containerId)!.retire() },
        error(error: unknown) { errors.push(error) },
    }
    return { adapter, slots, states, removed, errors, pool: new BrowserWarmPool(adapter) }
}

describe('five ready browsers shared by API replicas', () => {
    test('replicas fill only five slots and simultaneous callers each get a different browser', async () => {
        const f = fixture()
        const replica = new BrowserWarmPool(f.adapter)
        await Promise.all([f.pool.replenish(), replica.replenish()])
        expect(f.slots.size).toBe(5)
        const original = [...f.slots.values()].map(w => w.containerId)
        const claimed = await Promise.all(Array.from({ length: 5 }, (_, i) => (i % 2 ? replica : f.pool).take(`session-${i}`)))
        expect(new Set(claimed.map(w => w?.containerId)).size).toBe(5)
        expect(claimed.every(w => w && original.includes(w.containerId))).toBe(true)
        await f.pool.replenish()
        await replica.replenish()
        expect(f.slots.size).toBe(5)
        expect([...f.slots.values()].every(w => !original.includes(w.containerId))).toBe(true)
        expect(f.errors).toEqual([])
    })
    test('empty pool returns cold-start fallback without waiting for replacements', async () => {
        const f = fixture()
        expect(await f.pool.take('empty')).toBeNull()
        await f.pool.replenish()
        expect(f.slots.size).toBe(5)
    })
    test('unready and retired browsers are not handed out', async () => {
        const f = fixture()
        await f.pool.replenish()
        for (const s of f.states.values()) s.state = 'starting'
        expect(await f.pool.take('early')).toBeNull()
        for (const s of f.states.values()) s.state = 'retired'
        await f.pool.replenish()
        expect(f.removed.length).toBe(5)
        expect(f.slots.size).toBe(5)
    })
    test('maintenance never removes a browser claimed during idle retirement', async () => {
        const f = fixture()
        await f.pool.replenish()
        for (const w of f.slots.values()) w.createdAt = Date.now() - 30 * 60_000
        f.adapter.retire = async worker => { f.states.get(worker.containerId)!.claim('racing'); return false }
        await f.pool.replenish()
        expect(f.removed).toEqual([])
    })
    test('failed rename keeps claim exclusive and later maintenance refills it', async () => {
        const f = fixture()
        await f.pool.replenish()
        const detach = f.adapter.detach
        f.adapter.detach = async () => { throw new Error('temporary rename failure') }
        const worker = await f.pool.take('first')
        expect(worker).not.toBeNull()
        expect(f.states.get(worker!.containerId)!.claim('second')).toBe(false)
        await f.pool.replenish()
        f.adapter.detach = detach
        await f.pool.replenish()
        expect([...f.slots.values()].some(w => w.containerId === worker!.containerId)).toBe(false)
        expect(f.slots.size).toBe(5)
    })
    test('a temporarily unreachable worker is not destroyed; abandoned workers expire', async () => {
        const f = fixture()
        await f.pool.replenish()
        f.adapter.status = async () => null as never
        for (const w of f.slots.values()) w.createdAt = Date.now() - 5 * 60_000
        await f.pool.replenish()
        expect(f.removed).toEqual([])
        for (const w of f.slots.values()) w.createdAt = Date.now() - BROWSER_WARM_MAX_AGE_MS - 1
        await f.pool.replenish()
        expect(f.removed.length).toBe(5)
    })
})

test('single-use reservation rejects other sessions, duplicate sockets, reuse and retire after claim', () => {
    const state = new SingleUseBrowser<object>()
    expect(state.claim('first')).toBe(false)
    state.ready({ browser: true })
    expect(state.claim('first')).toBe(true)
    expect(state.claim('first')).toBe(false)
    expect(state.claim('second')).toBe(false)
    expect(state.retire()).toBe(false)
    expect(state.connect('second')).toBe(false)
    expect(state.connect('first')).toBe(true)
    expect(state.connect('first')).toBe(false)
    expect(state.take('first')).toEqual({ browser: true })
    expect(() => state.take('first')).toThrow('unavailable')
})
