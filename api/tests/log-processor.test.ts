import { afterAll, afterEach, expect, spyOn, test } from 'bun:test'
import { startLogProcessor } from '../src/utils/mill/processor.ts'

let callback: () => void, delay: number
const timeout = spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms: number) => {
    callback = fn; delay = ms
    return { unref() {} } as ReturnType<typeof setTimeout>
}) as typeof setTimeout)
const clear = spyOn(globalThis, 'clearTimeout').mockImplementation(() => {})
afterEach(() => { timeout.mockClear(); clear.mockClear() })
afterAll(() => { timeout.mockRestore(); clear.mockRestore() })
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

test('busy passes use configured cadence, idle passes back off, and shutdown cancels the next pass', async () => {
    let busy = true, interval = 100
    const stop = startLogProcessor(async () => busy, () => {}, () => interval, () => 0)
    expect(delay).toBe(0)
    callback(); await settle(); expect(delay).toBe(100)
    interval = 5000; callback(); await settle(); expect(delay).toBe(5000)
    busy = false; interval = 100; callback(); await settle(); expect(delay).toBe(5000)
    await stop(); expect(clear).toHaveBeenCalledTimes(1)
})
test('busy cadence includes processing time instead of adding another idle interval', async () => {
    let elapsed = 0, duration = 3000
    const stop = startLogProcessor(async () => { elapsed += duration; return true }, () => {}, () => 5000, () => elapsed)
    callback(); await settle(); expect(delay).toBe(2000)
    duration = 7000; callback(); await settle(); expect(delay).toBe(50)
    await stop()
})
test('no next pass is scheduled until persistence completes, including during shutdown', async () => {
    let finish!: (value: boolean) => void
    const stop = startLogProcessor(() => new Promise(resolve => { finish = resolve }), () => {}, () => 100)
    callback(); await settle(); expect(timeout).toHaveBeenCalledTimes(1)
    let stopped = false
    const stopping = stop().then(() => { stopped = true })
    await settle(); expect(stopped).toBe(false)
    finish(true); await stopping
    expect(timeout).toHaveBeenCalledTimes(1)
})
test('processing and configuration failures are reported and back off', async () => {
    for (const duringProcessing of [true, false]) {
        const errors: unknown[] = []
        const stop = startLogProcessor(async () => { if (duringProcessing) throw new Error('write failed'); return true }, error => errors.push(error), () => { throw new Error('invalid control') })
        callback(); await settle()
        expect(errors).toHaveLength(1); expect(delay).toBe(5000)
        await stop()
    }
})
