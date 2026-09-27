import { readFileSync, writeFileSync } from 'node:fs'

const path = '/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py'
let source = readFileSync(path, 'utf8')
const replaceOnce = (oldText: string, newText: string, message: string) => {
    if (source.split(oldText).length - 1 !== 1) throw new Error(message)
    source = source.replace(oldText, newText)
}

const slicedThreads = 'x264enc.set_property("sliced-threads", True)'
replaceOnce(slicedThreads, 'x264enc.set_property("sliced-threads", False)', 'Review changed Selkies H.264 threading configuration')
// Encode a picture as one slice. With independently decodable slices, a receiver
// can display only part of a picture after packet loss and retain stale regions.
// Frame threading preserves throughput with a small encoding delay.
const congestionControl = 'self.congestion_control = congestion_control'
replaceOnce(congestionControl, 'self.congestion_control = congestion_control and encoder != \'x264enc\'',
    'Review changed Selkies congestion control configuration')
// The pinned GCC/x264 path corrupts pictures when packet timing varies. Keep the
// bounded encoder bitrate and RTP retransmission path that passes the same loss
// test; other codecs retain their existing congestion-control configuration.
writeFileSync(path, source)
