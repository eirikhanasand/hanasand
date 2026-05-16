const apiBase = process.env.API_BASE || 'https://api.hanasand.com/api'
const expectedPattern = new RegExp(process.env.EXPECTED_MODEL_CLIENT_PATTERN || 'hanasand|inspur', 'i')
const timeoutMs = Number(process.env.MODEL_CLIENT_TIMEOUT_MS || 15000)

const socketUrl = toWebsocketUrl(apiBase).replace(/\/+$/, '') + '/client/ws/gpt'
const socket = new WebSocket(socketUrl)

const timeout = setTimeout(() => {
    fail(`Timed out waiting for model client snapshot from ${socketUrl}`)
}, timeoutMs)

socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.type !== 'snapshot' && message.type !== 'update') {
        return
    }

    const clients = Array.isArray(message.clients)
        ? message.clients
        : message.client
            ? [message.client]
            : []

    if (!clients.length) {
        fail(`No model clients are registered on ${socketUrl}.`)
    }

    const names = clients
        .map((client) => [client.name, client.displayName, client.modelId, client.profile].filter(Boolean).join(' '))
        .filter(Boolean)

    if (!names.some((name) => expectedPattern.test(name))) {
        fail(`Expected an Inspur/Hanasand model client, but saw: ${names.join(', ') || '(unnamed clients)'}`)
    }

    clearTimeout(timeout)
    socket.close()
    console.log(`Model client smoke passed: ${names.join(', ')}`)
})

socket.addEventListener('error', () => {
    fail(`Unable to connect to ${socketUrl}.`)
})

function fail(message) {
    clearTimeout(timeout)
    try {
        socket.close()
    } catch {
        // The socket may already be closing after an upgrade failure.
    }
    console.error(message)
    process.exit(1)
}

function toWebsocketUrl(url) {
    if (url.startsWith('https://')) {
        return `wss://${url.slice('https://'.length)}`
    }
    if (url.startsWith('http://')) {
        return `ws://${url.slice('http://'.length)}`
    }
    return url
}
