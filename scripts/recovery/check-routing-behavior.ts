#!/usr/bin/env bun
/** Isolated production-policy routing check; requires Docker and unused ports 29981-29985/19999. */
import { spawnSync } from 'node:child_process'
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { render } from './render_proxy.ts'

const state = { delay: 3000, down: false }
const servers = [29981, 29982].map(port => createServer(async (_request, response) => {
    const primary = port === 29981
    if (primary) await delay(state.delay)
    response.statusCode = primary && state.down ? 503 : 200
    response.end(primary ? 'primary' : 'backup')
}))
for (const server of servers) await new Promise((resolve, reject) => server.listen(server === servers[0] ? 29981 : 29982, '127.0.0.1', error => error ? reject(error) : resolve()))

const config = { proxyIndex: 90, statsPort: 29985, services: [{ id: 'test', listenPort: 29983, checkPath: '/ready', instances: [
    { id: 'primary', address: '127.0.0.1:29981' }, { id: 'backup', address: '127.0.0.1:29982' },
] }] }
const folder = await mkdtemp(path.join(tmpdir(), 'hanasand-routing-check-'))
await chmod(folder, 0o755)
await writeFile(path.join(folder, 'test.cfg'), render(config))
const name = 'hanasand-failover-probe-test'
const image = 'haproxy@sha256:de601ccc9a79b715055bc5c8d51ff357edca04c1e869f4209f02bf6872fde8ac'

async function fetchText(port, route = '/') {
    const response = await globalThis.fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
}
async function statuses() {
    const rows = (await fetchText(29985, '/stats;csv')).replace(/^# /, '').trim().split(/\r?\n/).map(row => row.split(','))
    const headers = rows[0]
    return Object.fromEntries(rows.slice(1).filter(row => ['primary', 'backup'].includes(row[headers.indexOf('svname')]))
        .map(row => [row[headers.indexOf('svname')], row[headers.indexOf('status')]]))
}
async function until(predicate, limit) {
    const end = Date.now() + limit * 1000
    while (Date.now() < end) {
        try { if (await predicate()) return }
        catch { /* Keep polling until the route state settles. */ }
        await delay(1000)
    }
    throw new Error('Timed out waiting for expected route')
}

try {
    const launch = spawnSync('docker', ['run', '-d', '--name', name, '--network', 'host', '-v', `${folder}:/check:ro`, '--tmpfs', '/run/haproxy:mode=700,uid=99,gid=99', image, 'haproxy', '-db', '-f', '/check/test.cfg'], { encoding: 'utf8' })
    if (launch.status !== 0) throw new Error(launch.stderr || 'Unable to start isolated HAProxy')
    await until(async () => (await statuses()).primary === 'UP', 10)
    for (let i = 0; i < 5; i++) {
        if (await fetchText(29983) !== 'primary' || !(await statuses()).primary.startsWith('UP')) throw new Error('Healthy requests did not remain on primary')
        await delay(2000)
    }
    console.log('PASS: 3-second healthy responses remain on primary (old 2-second deadline would fail).')
    state.delay = 0
    state.down = true
    await delay(8000)
    if (!(await statuses()).primary.startsWith('UP')) throw new Error('Brief outage switched away from primary')
    state.down = false
    await until(async () => (await statuses()).primary === 'UP', 10)
    if (await fetchText(29983) !== 'primary') throw new Error('Brief recovery failed to stay on primary')
    console.log('PASS: brief outage does not switch away from primary.')
    state.down = true
    const failedAt = Date.now()
    while (Date.now() - failedAt < 59_000) {
        if (!(await statuses()).primary.startsWith('UP')) throw new Error('Failed over before the one-minute grace period')
        await delay(1000)
    }
    await until(async () => (await statuses()).primary.startsWith('DOWN'), 30)
    if (Date.now() - failedAt < 60_000 || await fetchText(29983) !== 'backup') throw new Error('Sustained failure did not route to backup')
    console.log('PASS: sustained 503 switches to backup.')
    state.down = false
    const recoveredAt = Date.now()
    while (Date.now() - recoveredAt < 59_000) {
        if (!(await statuses()).primary.startsWith('DOWN')) throw new Error('Failed back before stable recovery')
        await delay(1000)
    }
    await until(async () => (await statuses()).primary === 'UP', 30)
    if (Date.now() - recoveredAt < 60_000 || await fetchText(29983) !== 'primary') throw new Error('Sustained recovery did not return to primary')
    console.log('PASS: sustained recovery returns to primary with production rise threshold.')
} finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
    for (const server of servers) await new Promise(resolve => server.close(() => resolve()))
    await rm(folder, { recursive: true, force: true })
}
