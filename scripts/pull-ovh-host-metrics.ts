#!/usr/bin/env bun
/** Read OVH telemetry through the existing loopback-only SSH tunnel. */
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const maximumResponseBytes = 1_048_576

async function readBoundedJson(url, timeoutMs = 5000) {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`Telemetry returned HTTP ${response.status}`)
    if (!response.body) throw new Error('Telemetry response has no body')
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maximumResponseBytes) {
            await reader.cancel()
            throw new Error('OVH status response is too large')
        }
        chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder().decode(bytes))
}

export async function readSnapshot(now = Date.now()) {
    const status = await readBoundedJson('http://127.0.0.1:19911/status')
    if (status.site !== 'ovhcloud') throw new Error('Expected OVH telemetry')
    const host = status.hostMetrics
    if (!host || typeof host !== 'object') throw new Error('OVH host telemetry is unavailable')
    const sampledAt = Date.parse(host.sampledAt)
    const age = (now - sampledAt) / 1000
    if (!Number.isFinite(sampledAt) || age < -5 || age > 90) throw new Error('OVH host telemetry is stale')

    // A diagnostic outage must not interrupt the fast host health telemetry.
    let diagnostics = null
    try {
        diagnostics = await readBoundedJson('http://127.0.0.1:19911/disk-diagnostics', 3000)
    } catch {
        diagnostics = null
    }
    return { host, diagnostics }
}

async function atomicWrite(path, value) {
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.tmp`
    await writeFile(temporary, JSON.stringify(value), { mode: 0o644 })
    await rename(temporary, path)
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/pull-ovh-host-metrics.ts') ||
    process.argv[1]?.endsWith('/pull-ovh-host-metrics.ts')) {
    const { host, diagnostics } = await readSnapshot()
    if (diagnostics && typeof diagnostics === 'object') {
        await atomicWrite('/var/lib/hanasand/metrics/ovhcloud-disk-directories.json', diagnostics)
    }
    await atomicWrite('/var/lib/hanasand/metrics/ovhcloud.json', host)
}
