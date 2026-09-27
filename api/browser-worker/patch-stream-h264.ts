import { readFileSync, writeFileSync } from 'node:fs'

const path = '/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py'
let source = readFileSync(path, 'utf8')
const replaceOnce = (oldText: string, newText: string, message: string) => {
    if (source.split(oldText).length - 1 !== 1) throw new Error(message)
    source = source.replace(oldText, newText)
}

const oldProfile = 'h264enc_caps.set_value("profile", "main")'
replaceOnce(oldProfile, 'h264enc_caps.set_value("profile", "constrained-baseline")', 'Review changed Selkies H.264 profile configuration')
const start = source.indexOf('        # Firefox needs profile-level-id=42e01f')
const endMarker = '            if \'level-asymmetry-allowed\' not in sdp_text:'
const end = source.indexOf(endMarker, start)
if (start < 0 || end < 0 || !source.slice(start, end).includes('re.sub')) {
    throw new Error('Review changed Selkies SDP configuration')
}
// Preserve the profile AND level generated from the actual stream. In particular,
// 1080p60 must not be advertised as level 3.1 (42e01f).
source = source.slice(0, start) + '        # Keep GStreamer\'s actual H.264 profile-level-id in the offer.\n' +
    '        if "h264" in self.encoder or "x264" in self.encoder:\n' + source.slice(end)
writeFileSync(path, source)
