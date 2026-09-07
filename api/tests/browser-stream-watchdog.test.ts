import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync(new URL('../browser-worker/reconnect-watchdog.js', import.meta.url), 'utf8')

test('stale loading text, hidden tabs, and autoplay prompts never reload a healthy stream', () => {
    let now = 1000
    let tick = () => {}
    let reloads = 0
    const store = new Map<string, string>()
    const video = { readyState: 0, videoWidth: 0 }
    const app = { loadingText: 'Waiting for stream.', status: 'connected', showStart: false }
    const document = { visibilityState: 'visible', querySelector: () => video }
    const states: string[] = []
    const context = { app, document, Date: { now: () => now }, setInterval: (fn: () => void) => { tick = fn }, location: { reload: () => { reloads++ } }, parent: { postMessage: (message: { state: string }) => states.push(message.state) }, sessionStorage: { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) } }
    const advance = () => { for (let i = 0; i < 40; i++) { now += 1000; tick() } }
    runInNewContext(source, context)
    advance()
    expect(reloads).toBe(0)
    app.status = 'connecting'
    document.visibilityState = 'hidden'
    advance()
    expect(reloads).toBe(0)
    document.visibilityState = 'visible'
    app.showStart = true
    advance()
    expect(reloads).toBe(0)
    expect(states).toContain('gesture')
    app.showStart = false
    video.readyState = 2
    video.videoWidth = 1280
    advance()
    expect(reloads).toBe(0)
    expect(states).toContain('ready')
})

test('genuine startup failures retry at most twice across page reloads', () => {
    let now = 1000
    let tick = () => {}
    let reloads = 0
    const store = new Map<string, string>()
    const context = { app: { loadingText: 'Waiting for stream.', status: 'connecting' }, document: { visibilityState: 'visible', querySelector: () => null }, Date: { now: () => now }, setInterval: (fn: () => void) => { tick = fn }, location: { reload: () => { reloads++ } }, parent: { postMessage: () => {} }, sessionStorage: { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) } }
    for (let load = 0; load < 4; load++) {
        runInNewContext(source, context)
        tick()
        now += 31000
        tick()
    }
    expect(reloads).toBe(2)
})
