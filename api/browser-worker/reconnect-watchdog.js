(() => {
    let waitingSince = 0

    setInterval(() => {
        const waiting = globalThis.app?.loadingText === 'Waiting for stream.'
        if (!waiting || document.visibilityState !== 'visible') {
            waitingSince = 0
            return
        }
        if (!waitingSince) waitingSince = Date.now()
        if (Date.now() - waitingSince >= 10_000) location.reload()
    }, 1_000)
})()
