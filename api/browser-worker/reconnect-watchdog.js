(() => {
    let waitingSince = 0
    let lastState = ''
    const retryKey = `hanasand-stream-retries:${location.pathname}`
    let retries = 0
    try { retries = Number(sessionStorage.getItem(retryKey)) || 0 } catch { /* Storage is optional. */ }

    setInterval(() => {
        const player = globalThis.app
        const video = document.querySelector('video')
        const hasFrame = Boolean(video && video.readyState >= 2 && video.videoWidth > 0)
        const state = hasFrame ? 'ready' : player?.showStart ? 'gesture' : 'waiting'
        if (state !== lastState) {
            // The parent verifies this window and origin before using the readiness signal.
            parent.postMessage({ type: 'hanasand-browser-stream', state }, '*')
            lastState = state
        }
        // loadingText is retained by Selkies after connection; it is not a connection signal.
        if (document.visibilityState !== 'visible' || hasFrame || player?.status === 'connected' || player?.showStart) {
            waitingSince = 0
            if (hasFrame && retries) {
                retries = 0
                try { sessionStorage.removeItem(retryKey) } catch { /* Storage is optional. */ }
            }
            return
        }
        if (player?.loadingText !== 'Waiting for stream.') { waitingSince = 0; return }
        if (!waitingSince) waitingSince = Date.now()
        if (Date.now() - waitingSince >= 30_000 && retries < 2) {
            retries++
            try { sessionStorage.setItem(retryKey, String(retries)) } catch { return }
            location.reload()
        }
    }, 1_000)
})()
