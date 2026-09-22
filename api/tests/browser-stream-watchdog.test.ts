import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync(process.env.BROWSER_STREAM_ASSET_DIR
    ? `${process.env.BROWSER_STREAM_ASSET_DIR}/reconnect-watchdog.js`
    : new URL('../browser-worker/reconnect-watchdog.js', import.meta.url), 'utf8')

test('stale loading text, hidden tabs, and autoplay prompts never reload a healthy stream', () => {
    let now = 1000
    let tick = () => {}
    let reloads = 0
    const store = new Map<string, string>()
    const video = { readyState: 2, videoWidth: 1280, videoHeight: 720 }
    const app = { loadingText: 'Waiting for stream.', status: 'connected', showStart: false }
    const document = { visibilityState: 'visible', querySelector: () => video }
    const states: string[] = []
    const context = { app, document, Date: { now: () => now }, setInterval: (fn: () => void) => { tick = fn }, location: { reload: () => { reloads++ } }, parent: { postMessage: (message: { state: string }) => states.push(message.state) }, sessionStorage: { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) } }
    const advance = () => { for (let i = 0; i < 40; i++) { now += 1000; tick() } }
    runInNewContext(source, context)
    advance()
    expect(reloads).toBe(0)
    video.readyState = 0
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
    app.status = 'connected'
    video.readyState = 2
    video.videoWidth = 1280
    video.videoHeight = 720
    advance()
    expect(reloads).toBe(0)
    expect(states).toContain('ready')
})

test('report decoded dimensions again when the stream changes size without reconnecting', () => {
    let tick = () => {}
    const messages: { width: number; height: number }[] = []
    const video = { readyState: 2, videoWidth: 1920, videoHeight: 1080 }
    runInNewContext(source, {
        document: { visibilityState: 'visible', querySelector: () => video },
        setInterval: (fn: () => void) => { tick = fn }, location: { pathname: '/stream' },
        parent: { postMessage: (message: { width: number; height: number }) => messages.push(message) },
        sessionStorage: { getItem: () => null },
    })
    tick()
    tick()
    expect(messages.length).toBe(2)
    expect(messages[0].width / messages[0].height).toBe(1920 / 1080)
    video.videoWidth = 390
    video.videoHeight = 844
    tick()
    expect(messages.length).toBe(3)
    expect(messages[2].width / messages[2].height).toBe(390 / 844)
})

test('stream failures keep retrying with capped backoff across page reloads', () => {
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
    expect(reloads).toBe(4)
})


test('playback immediately reports the frame and clears stale loading state', () => {
    const listeners: Record<string, () => void> = {}
    const video = { paused: true, readyState: 4, videoWidth: 1920, videoHeight: 1080, addEventListener: (event: string, listener: () => void) => { listeners[event] = listener } }
    const app = { videoPlaying: false, showStart: true, status: 'connected' }
    const messages: { state: string }[] = []
    runInNewContext(source, {
        app, document: { visibilityState: 'visible', querySelector: () => video },
        setInterval: () => {}, location: { pathname: '/stream' },
        parent: { postMessage: (message: { state: string }) => messages.push(message) },
        sessionStorage: { getItem: () => null },
    })
    video.paused = false
    listeners.playing()
    expect(messages.at(-1)?.state).toBe('ready')
    expect(app.videoPlaying).toBe(true)
    expect(app.showStart).toBe(false)
    video.paused = true
    listeners.pause()
    expect(messages.at(-1)?.state).not.toBe('ready')
    expect(app.videoPlaying).toBe(false)
})
