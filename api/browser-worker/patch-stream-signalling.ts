import { readFileSync, writeFileSync } from 'node:fs'

const path = '/usr/local/lib/python3.12/dist-packages/selkies_gstreamer/gstwebrtc_app.py'
let source = readFileSync(path, 'utf8')
// GStreamer invokes these callbacks from its own threads. The signalling socket
// belongs to the main asyncio loop; separate loops can interleave socket writes.
for (const callback of ['self.on_sdp(\'offer\', sdp_text)', 'self.on_ice(mlineindex, candidate)']) {
    const oldText = `asyncio.run(${callback})`
    if (source.split(oldText).length - 1 !== 1) throw new Error('Review changed Selkies signalling callbacks')
    source = source.replace(oldText, `asyncio.run_coroutine_threadsafe(${callback}, self.async_event_loop)`)
}
writeFileSync(path, source)
