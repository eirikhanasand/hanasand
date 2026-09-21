(() => {
    let waitingSince = 0
    let lastState = ''
    let healthySince = 0
    let lastDimensions = ''
    const retryKey = `hanasand-stream-retries:${location.pathname}`
    let retries = 0
    try { retries = Number(sessionStorage.getItem(retryKey)) || 0 } catch { /* Storage is optional. */ }

    setInterval(() => {
        const player = globalThis.app
        const video = document.querySelector('video')
        const hasFrame = Boolean(video && video.readyState >= 2 && video.videoWidth > 0)
        const state = hasFrame ? 'ready' : player?.showStart ? 'gesture' : 'waiting'
        const width = video?.videoWidth || 0
        const height = video?.videoHeight || 0
        const dimensions = `${width}x${height}`
        if (state !== lastState || dimensions !== lastDimensions) {
            // The parent verifies this window and origin before using the readiness signal.
            parent.postMessage({ type: 'hanasand-browser-stream', state, width, height }, '*')
            lastState = state
            lastDimensions = dimensions
        }
        // loadingText is retained by Selkies after connection; it is not a connection signal.
        if (document.visibilityState !== 'visible' || (hasFrame && (!player || player.status === 'connected')) || player?.showStart) {
            waitingSince = 0
            if (hasFrame) healthySince ||= Date.now()
            if (hasFrame && retries && Date.now() - healthySince > 10_000) {
                retries = 0
                try { sessionStorage.removeItem(retryKey) } catch { /* Storage is optional. */ }
            }
            return
        }
        healthySince = 0
        if (!waitingSince) waitingSince = Date.now()
        if (Date.now() - waitingSince >= Math.min(30_000, 5_000 * 2 ** Math.min(retries, 3))) {
            retries++
            try { sessionStorage.setItem(retryKey, String(retries)) } catch { return }
            waitingSince = Date.now()
            location.reload()
        }
    }, 1_000)
})()
