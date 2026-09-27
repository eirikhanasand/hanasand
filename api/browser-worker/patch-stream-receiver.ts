import { readFileSync, writeFileSync } from 'node:fs'

const replaceOnce = (source: string, oldText: string, newText: string, message: string) => {
    if (source.split(oldText).length - 1 !== 1) throw new Error(message)
    return source.replace(oldText, newText)
}

// A zero target every 15 ms prevents the receiver adapting to delayed/reordered
// cellular packets. Keep browser-managed jitter buffering for both synced tracks.
const appPath = '/opt/gst-web/app.js'
let source = readFileSync(appPath, 'utf8')
for (const connected of ['videoConnected', 'audioConnected']) {
    const startMarker = `    if (${connected} === "connected") {\n        // Repeatedly emit minimum latency target`
    const start = source.indexOf(startMarker)
    const close = source.indexOf('        });\n    }', start)
    const nextIf = source.indexOf('    if (', close + '        });\n    }'.length)
    if (start < 0 || close < 0 || nextIf < 0) throw new Error(`Selkies ${connected} jitter-buffer block changed`)
    source = source.slice(0, start) + source.slice(nextIf)
}
writeFileSync(appPath, source)

// The sender also caps receiver playout at zero in an RTP extension. Removing
// just the JavaScript hints would leave this second override in effect.
const gstPath = '/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py'
source = readFileSync(gstPath, 'utf8')
source = replaceOnce(source,
    '        if not audio:\n            rtp_uri_list += ["http://www.webrtc.org/experiments/rtp-hdrext/playout-delay"]\n',
    '', 'Review changed Selkies RTP playout configuration')
writeFileSync(gstPath, source)

// Cancel even wheel events that the trackpad throttle does not forward.
const inputPath = '/opt/gst-web/input.js'
source = readFileSync(inputPath, 'utf8')
source = replaceOnce(source, '    _mouseWheelWrapper(event) {',
    '    _mouseWheelWrapper(event) {\n        event.preventDefault();\n        event.stopPropagation();', 'Review changed Selkies wheel handler')
source = replaceOnce(source, 'name.startsWith(\'touch\') ? { passive: false } : undefined',
    '(name.startsWith(\'touch\') || name === \'wheel\') ? { passive: false } : undefined',
    'Review changed Selkies input listener options')
writeFileSync(inputPath, source)
