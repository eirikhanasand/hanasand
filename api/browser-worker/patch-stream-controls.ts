import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = '/opt/gst-web'
const replaceSection = (source: string, start: string, end: string, replacement: string) => {
    const from = source.indexOf(start)
    const to = source.indexOf(end, from)
    if (from < 0 || to < 0) throw new Error(`Selkies section changed: ${start}`)
    return source.slice(0, from) + replacement + '\n' + source.slice(to)
}

let source = readFileSync(join(root, 'input.js'), 'utf8')
source = replaceSection(source, '    _mouseWheelWrapper(event) {', '\n    /**', readFileSync('/tmp/wheel-input.js', 'utf8').trimEnd())
source = replaceSection(source, '    _touch(event) {', '\n    /**', readFileSync('/tmp/touch-input.js', 'utf8').trimEnd())
writeFileSync(join(root, 'input.js'), source)

const indexPath = join(root, 'index.html')
source = readFileSync(indexPath, 'utf8')
source = replaceSection(source, '      <div class="loading">', '    </v-app>', `      <div class="loading" v-if="!videoPlaying">
        <button class="hanasand-loading" v-on:click="playStream()" aria-label="Resume browser stream">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10" />
          </svg>
        </button>
      </div>
`)
source = source.replace('</head>', `<style>
html, body { overscroll-behavior: none; }
/* Keep the autoplay video visible; cover startup controls with our own loader. */
.loading { inset:0; top:0; display:grid; place-items:center; background:#000; z-index:2; }
video::-webkit-media-controls { display:none !important; }
video::-webkit-media-controls-enclosure { display:none !important; }
video::-webkit-media-controls-panel { display:none !important; }
video::-webkit-media-controls-play-button { display:none !important; }
video::-webkit-media-controls-overlay-play-button { display:none !important; }
video::-webkit-media-controls-start-playback-button { display:none !important; -webkit-appearance:none; }
.hanasand-loading { color:#3056d3; background:transparent; border:0; padding:12px; cursor:pointer; }
.hanasand-loading svg { width:40px; height:40px; animation:hanasand-spin 1s linear infinite; }
@keyframes hanasand-spin { to { transform:rotate(360deg); } }
</style></head>`)
writeFileSync(indexPath, source)

const appPath = join(root, 'app.js')
source = readFileSync(appPath, 'utf8')
const needle = 'webrtc.element.addEventListener(\'playing\', () => { app.showStart = false; });'
if (source.split(needle).length - 1 !== 1) throw new Error('Selkies playing handler changed')
source = source.replace('            showStart: false,', '            showStart: false,\n            videoPlaying: false,')
source = source.replace(needle, 'webrtc.element.addEventListener(\'playing\', () => { app.videoPlaying = true; app.showStart = false; });' +
    '\nwebrtc.element.addEventListener(\'pause\', () => { app.videoPlaying = false; app.showStart = true; webrtc.playStream(); });')
writeFileSync(appPath, source)
