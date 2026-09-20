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
