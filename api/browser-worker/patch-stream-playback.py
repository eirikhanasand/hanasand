from pathlib import Path


def replace_once(path, old, new):
    source = path.read_text()
    if source.count(old) != 1:
        raise RuntimeError(f'Selkies playback changed in {path.name}; review the player patch')
    path.write_text(source.replace(old, new))


root = Path('/opt/gst-web')
replace_once(root / 'index.html', '<video id="stream"', '<video muted autoplay id="stream"')
replace_once(root / 'app.js', '            showStart: false,', '            showStart: false,\n            showAudioStart: false,')
replace_once(root / 'app.js', '''            webrtc.playStream();
            audio_webrtc.playStream();
            this.showStart = false;''', '''            webrtc.playStream();
        },
        playAudio() {
            audio_webrtc.playStream();''')
replace_once(root / 'app.js', '''audio_webrtc.onplaystreamrequired = () => {
    app.showStart = true;
}''', '''audio_webrtc.onplaystreamrequired = () => {
    app.showAudioStart = true;
}
webrtc.element.addEventListener('playing', () => { app.showStart = false; });
audio_webrtc.element.addEventListener('playing', () => { app.showAudioStart = false; });''')
replace_once(root / 'index.html', '      <canvas id="capture"></canvas>', '''      <canvas id="capture"></canvas>
      <v-btn v-if="status === 'connected' && showAudioStart" v-on:click="playAudio()"
        small style="position:fixed;bottom:12px;left:12px;z-index:10" aria-label="Enable remote sound">
        Enable sound
      </v-btn>''')
# Calling load() again aborts pending playback and resets an already playing
# MediaStream. Audio autoplay denial must not interrupt the video/input path.
replace_once(root / 'webrtc.js', '''        this.element.load();

        var playPromise = this.element.play();''', '''        var playPromise = this.element.play();''')
replace_once(root / 'webrtc.js', '''            }).catch(() => {
                if (this.onplaystreamrequired !== null) {''', '''            }).catch((error) => {
                if (error.name === 'AbortError') return;
                if (this.onplaystreamrequired !== null) {''')
