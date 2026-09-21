from pathlib import Path
root = Path('/opt/gst-web')
p = root / 'input.js'
s = p.read_text()
a = s.index('    _mouseWheelWrapper(event) {')
b = s.index('\n    /**', a)
s = s[:a] + Path(__file__).with_name('wheel-input.js').read_text().rstrip() + '\n' + s[b:]
a = s.index('    _touch(event) {')
b = s.index('\n    /**', a)
s = s[:a] + Path(__file__).with_name('touch-input.js').read_text().rstrip() + '\n' + s[b:]
p.write_text(s)
p = root / 'index.html'
s = p.read_text()
a = s.index('      <div class="loading">')
b = s.index('    </v-app>', a)
s = s[:a] + '''      <div class="loading" v-if="status !== 'connected' || showStart">
        <button class="hanasand-loading" v-on:click="playStream()" aria-label="Resume browser stream">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10" />
          </svg>
        </button>
      </div>
''' + s[b:]
s = s.replace('</head>', '''<style>
video::-webkit-media-controls, video::-webkit-media-controls-enclosure,
video::-webkit-media-controls-start-playback-button { display:none !important; -webkit-appearance:none; }
.hanasand-loading { color:#3056d3; background:transparent; border:0; padding:12px; cursor:pointer; }
.hanasand-loading svg { width:40px; height:40px; animation:hanasand-spin 1s linear infinite; }
@keyframes hanasand-spin { to { transform:rotate(360deg); } }
</style></head>''')
p.write_text(s)

p = root / 'app.js'
s = p.read_text()
needle = "webrtc.element.addEventListener('playing', () => { app.showStart = false; });"
assert s.count(needle) == 1
s = s.replace(needle, needle + "\nwebrtc.element.addEventListener('pause', () => { app.showStart = true; webrtc.playStream(); });")
p.write_text(s)
