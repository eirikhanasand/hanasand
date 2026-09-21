import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Run inside the release image: testing repository files alone misses stale
// player assets inherited from an older container image.
const root = process.env.BROWSER_STREAM_ASSET_DIR || '/opt/gst-web'
const read = (name: string) => readFileSync(`${root}/${name}`, 'utf8')
assert.equal(read('reconnect-watchdog.js'), readFileSync(new URL('../browser-worker/reconnect-watchdog.js', import.meta.url), 'utf8'), 'Installed watchdog must match this release')
const html = read('index.html')
assert.match(html, /<video muted autoplay id="stream"[^>]+playsinline/)
assert.match(html, /showAudioStart[^>]+playAudio\(\)/)

const appSource = read('app.js')
const videoEvents = new Map<string, () => void>()
const audioEvents = new Map<string, () => void>()
const app = { showStart: false, showAudioStart: false }
const webrtc = { element: { addEventListener: (name: string, fn: () => void) => videoEvents.set(name, fn) }, onplaystreamrequired: () => {} }
const audio = { element: { addEventListener: (name: string, fn: () => void) => audioEvents.set(name, fn) }, onplaystreamrequired: () => {} }
const handlers = appSource.match(/webrtc\.onplaystreamrequired = \(\) => \{[\s\S]+?(?=\/\/ Actions to take whenever window changes focus)/)?.[0]
assert(handlers, 'Playback handlers found')
runInNewContext(handlers, { app, webrtc, audio_webrtc: audio })
audio.onplaystreamrequired()
assert.equal(app.showStart, false, 'Audio autoplay denial must not cover working video')
assert.equal(app.showAudioStart, true)
audioEvents.get('playing')?.()
assert.equal(app.showAudioStart, false)
webrtc.onplaystreamrequired()
assert.equal(app.showStart, true, 'Actual video autoplay denial remains recoverable')
videoEvents.get('playing')?.()
assert.equal(app.showStart, false)

const method = read('webrtc.js').match(/ {4}playStream\(\) \{[\s\S]+?(?= {4}\/\/ \[END playStream\])/)?.[0]
assert(method, 'Playback method found')
for (const failure of [null, 'AbortError', 'NotAllowedError']) {
    let playCalls = 0
    let prompts = 0
    const client = runInNewContext(`({${method}})`)
    client.element = {
        load: () => { throw new Error('Playback must not reset the MediaStream') },
        play: () => { playCalls++; return failure ? Promise.reject({ name: failure }) : Promise.resolve() },
    }
    client._setDebug = () => {}
    client.onplaystreamrequired = () => { prompts++ }
    client.playStream()
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(playCalls, 1)
    assert.equal(prompts, failure === 'NotAllowedError' ? 1 : 0)
}
console.log('Installed player verified: current watchdog, muted inline video, separate audio consent, no playback reset.')

const inputSource = read('input.js')
const touchMethod = inputSource.slice(inputSource.indexOf('    _touch(event) {'), inputSource.indexOf('\n    /**', inputSource.indexOf('    _touch(event) {'))).trim()
assert.equal(touchMethod, readFileSync(new URL('../browser-worker/touch-input.js', import.meta.url), 'utf8').trim(), 'Installed touch handler must match this release')
assert.match(inputSource, /addListener\(this.element, 'touchstart'/)
assert.match(inputSource, /addListener\(this.element, 'touchcancel'/)
assert.match(inputSource, /name.startsWith\('touch'\) \|\| name === 'wheel'\) \? \{ passive: false \}/)
const wheelMethod = inputSource.match(/ {4}_mouseWheelWrapper\(event\) \{[\s\S]+?(?=\n {4}\/\*\*)/)?.[0]
assert(wheelMethod)
let prevented = 0
let stopped = 0
const wheelMessages: string[] = []
const wheel = runInNewContext(`({${wheelMethod}})`, { document: { pointerLockElement: null } })
Object.assign(wheel, { x: 100, y: 200, buttonMask: 0, send: (message: string) => wheelMessages.push(message) })
const wheelEvent = (deltaY: number, deltaMode = 0) => wheel._mouseWheelWrapper({ deltaY, deltaMode,
    preventDefault: () => { prevented++ }, stopPropagation: () => { stopped++ } })
for (let i = 0; i < 5; i++) wheelEvent(10)
assert.equal(wheelMessages.length, 0, 'Small trackpad movements accumulate without acceleration')
wheelEvent(50)
assert.equal(wheelMessages[0], 'm,100,200,8,1')
wheelEvent(10000)
assert.equal(wheelMessages[2], 'm,100,200,8,3', 'Large wheel events are capped')
wheelEvent(-100)
assert.equal(wheelMessages[4], 'm,100,200,16,1', 'Direction reversals respond immediately')
assert.equal(prevented, 8)
assert.equal(stopped, 8)
assert.match(html, /hanasand-loading/)
assert.match(html, /html, body \{ overscroll-behavior: none; \}/)
assert.doesNotMatch(html, /<scale-loader|\{\{ loadingText \}\}/)
assert.match(html, /video::-webkit-media-controls-start-playback-button/)
assert.doesNotMatch(appSource, /receiver\.(?:jitterBufferTarget|jitterBufferDelayHint|playoutDelayHint)\s*=/, 'Let the receiver adapt to network jitter')
const messages: number[][] = []
const input = runInNewContext(`({${touchMethod}})`)
Object.assign(input, { buttonMask: 0, _windowMath: () => {}, _clientToServerX: (x: number) => x,
    _clientToServerY: (y: number) => y, send: (message: string) => messages.push(message.split(',').slice(1).map(Number)) })
const touch = (type: string, y: number, count = 1) => input._touch({ type, cancelable: true, preventDefault() {},
    touches: Array.from({ length: type === 'touchend' ? 0 : count }, () => ({})), changedTouches: [{ identifier: 7, clientX: 100, clientY: y }] })
touch('touchstart', 200)
assert.equal(messages.length, 0, 'Touch down must not hold the mouse button')
touch('touchmove', 176)
assert.deepEqual(messages, [[100, 176, 8, 1], [100, 176, 0, 0]], 'First swipe movement sends scroll immediately, without timers')
touch('touchend', 176)
assert.equal(messages.length, 2, 'Swipes must not click or select text on release')
messages.length = 0
touch('touchstart', 200)
touch('touchmove', 224)
assert.equal(messages[0][2], 16, 'Downward finger movement scrolls up')
touch('touchcancel', 224)
assert.equal(input._touchGesture, null)
messages.length = 0
touch('touchstart', 200)
touch('touchmove', 202)
touch('touchend', 202)
assert.deepEqual(messages, [[100, 202, 1, 0], [100, 202, 0, 0]], 'Tap remains a single click despite small finger jitter')
messages.length = 0
touch('touchstart', 200)
touch('touchstart', 200, 2)
touch('touchend', 200)
assert.equal(messages.length, 0, 'Multitouch must not leave a pressed button or accidental click')
const mouseMethod = inputSource.match(/ {4}_mouseButtonMovement\(event\) \{[\s\S]+?(?=\n {4}\/\*\*)/)?.[0]
assert(mouseMethod)
const mouse = runInNewContext(`({${mouseMethod}})`, { document: { pointerLockElement: null } })
Object.assign(mouse, { buttonMask: 0, x: 100, y: 200, _suppressTouchMouseUntil: Date.now() + 800,
    send: (message: string) => messages.push(message.split(',').slice(1).map(Number)) })
mouse._mouseButtonMovement({ type: 'mousedown', button: 0, preventDefault() {} })
assert.equal(messages.length, 0, 'Synthetic mouse events after a tap must not duplicate input')
mouse._suppressTouchMouseUntil = 0
mouse._mouseButtonMovement({ type: 'mousedown', button: 0, preventDefault() {} })
mouse._mouseButtonMovement({ type: 'mouseup', button: 0, preventDefault() {} })
assert.deepEqual(messages, [[100, 200, 1, 0], [100, 200, 0, 0]], 'Hybrid devices retain ordinary mouse clicks')
console.log('Installed touch input verified: immediate scrolling, tap click, cancellation, multitouch and hybrid mouse.')

const framerateAction = appSource.match(/const framerateSetting = app.getIntParam[\s\S]+?(?=\n {4}} else if)/)?.[0]
assert(framerateAction, 'Framerate action found')
assert.match(appSource, /this.setIntParam\("videoFramerateV2", newValue\)/)
for (const saved of [null, 45]) {
    const player = { videoFramerate: 0, getIntParam: (key: string) => key === 'videoFramerateV2' ? saved : 30 }
    runInNewContext(framerateAction, { app: player, action: 'framerate,60' })
    assert.equal(player.videoFramerate, saved ?? 60, 'Ignore the old automatic 30 FPS preference while preserving new user choices')
}
console.log('Installed framerate migration verified: new 60 FPS default and explicit preferences.')
