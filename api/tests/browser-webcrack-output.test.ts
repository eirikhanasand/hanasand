import { expect, test } from 'bun:test'
import { watchWebCrackOutput, readWebCrackOutput } from '../src/handlers/onionSession/webcrack'
import type { Page } from 'playwright'

// Provider fixture: the input and progress messages must never become output code.
test('WebCrack captures completed output, bounded in size, and preserves provider errors', async () => {
    let listener: (event: { data: unknown }) => void = () => {}
    const originalWindow = globalThis.window
    const fixture = { Worker: class { addEventListener(_event: string, callback: typeof listener) { listener = callback } } } as unknown as Window
    Object.assign(globalThis, { window: fixture })
    const page = {
        addInitScript: async (fn: () => void) => fn(),
        waitForFunction: async (fn: () => boolean) => { expect(fn()).toBe(true) },
        evaluate: async (fn: () => unknown) => fn(),
    } as unknown as Page
    try {
        await watchWebCrackOutput(page)
        new fixture.Worker('webcrack.worker.js')
        listener({ data: { type: 'sandbox', code: 'untrusted input' } })
        listener({ data: { type: 'progress', value: 50 } })
        expect('__hanasandWebCrackOutput' in fixture).toBe(false)
        listener({ data: { type: 'result', code: 'console.log("decoded");' } })
        expect(await readWebCrackOutput(page)).toEqual({ code: 'console.log("decoded");' })
        listener({ data: { type: 'result', code: 'x'.repeat(500_010) } })
        expect((await readWebCrackOutput(page)).code?.length).toBe(500_000)
        listener({ data: { type: 'error', error: new Error('Invalid JavaScript') } })
        expect(await readWebCrackOutput(page)).toEqual({ error: 'Invalid JavaScript' })
    } finally {
        if (originalWindow) Object.assign(globalThis, { window: originalWindow })
        else Reflect.deleteProperty(globalThis, 'window')
    }
})
