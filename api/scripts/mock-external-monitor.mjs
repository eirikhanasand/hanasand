import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

// Pass a retained JSON event file to retry exactly the same delivery.
const eventPath = process.argv[2]
const endpoint = process.env.EXTERNAL_MONITOR_URL
const key = process.env.EXTERNAL_MONITOR_KEY
if (!eventPath || eventPath !== '--example' && (!endpoint || !key)) {
    throw new Error('Set EXTERNAL_MONITOR_URL and EXTERNAL_MONITOR_KEY, then pass an event JSON file. Use --example to print a sample without sending it.')
}
const event = eventPath === '--example' ? {
    eventId: randomUUID(), sequence: 1, source: 'home-1/basement/moisture', type: 'incident',
    observedAt: new Date().toISOString(), message: 'Moisture detected in the basement. Check for a leak.',
    details: { podId: 'pod-1', sensorId: 'moisture-1', location: 'Basement', value: true },
} : JSON.parse(await readFile(eventPath, 'utf8'))
if (eventPath === '--example') {
    process.stdout.write(JSON.stringify(event, null, 2) + '\n')
} else {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS or a local development endpoint.')
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', 'X-API-Key': key }, body: JSON.stringify(event) })
    const result = await response.json()
    if (!response.ok) throw new Error(`Delivery failed (${response.status}): ${result.error || result.message || 'Retry the same event.'}`)
    process.stdout.write(JSON.stringify(result) + '\n')
}
