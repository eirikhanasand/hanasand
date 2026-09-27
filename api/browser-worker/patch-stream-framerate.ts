import { readFileSync, writeFileSync } from 'node:fs'

// The old player saved the server's 30 FPS default as a user preference.
// Give the new default a fresh key; subsequent explicit choices still persist.
const path = '/opt/gst-web/app.js'
let source = readFileSync(path, 'utf8')
for (const [oldText, newText] of [
    ['app.getIntParam("videoFramerate", null)', 'app.getIntParam("videoFramerateV2", null)'],
    ['this.setIntParam("videoFramerate", newValue)', 'this.setIntParam("videoFramerateV2", newValue)'],
]) {
    if (source.split(oldText).length - 1 !== 1) throw new Error('Selkies framerate preferences changed; review the migration')
    source = source.replace(oldText, newText)
}
writeFileSync(path, source)
