import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = '/opt/gst-web'
const replaceOnce = (file: string, oldText: string, newText: string) => {
    const path = join(root, file)
    const source = readFileSync(path, 'utf8')
    if (source.split(oldText).length - 1 !== 1) throw new Error(`Selkies playback changed in ${file}; review the player patch`)
    writeFileSync(path, source.replace(oldText, newText))
}

replaceOnce('index.html', '<video id="stream"', '<video muted autoplay id="stream"')
replaceOnce('app.js', '            showStart: false,', '            showStart: false,\n            showAudioStart: false,')
replaceOnce('app.js', `            webrtc.playStream();
            audio_webrtc.playStream();
            this.showStart = false;`, `            webrtc.playStream();
        },
        playAudio() {
            audio_webrtc.playStream();`)
replaceOnce('app.js', `audio_webrtc.onplaystreamrequired = () => {
    app.showStart = true;
}`, `audio_webrtc.onplaystreamrequired = () => {
    app.showAudioStart = true;
}
webrtc.element.addEventListener('playing', () => { app.showStart = false; });
audio_webrtc.element.addEventListener('playing', () => { app.showAudioStart = false; });`)
replaceOnce('index.html', '      <canvas id="capture"></canvas>', `      <canvas id="capture"></canvas>
      <v-btn v-if="status === 'connected' && showAudioStart" v-on:click="playAudio()"
        small style="position:fixed;bottom:12px;left:12px;z-index:10" aria-label="Enable remote sound">
        Enable sound
      </v-btn>`)

// Calling load() again aborts pending playback and resets an already playing
// MediaStream. Audio autoplay denial must not interrupt the video/input path.
replaceOnce('webrtc.js', `        this.element.load();

        var playPromise = this.element.play();`, '        var playPromise = this.element.play();')
replaceOnce('webrtc.js', `            }).catch(() => {
                if (this.onplaystreamrequired !== null) {`, `            }).catch((error) => {
                if (error.name === 'AbortError') return;
                if (this.onplaystreamrequired !== null) {`)
