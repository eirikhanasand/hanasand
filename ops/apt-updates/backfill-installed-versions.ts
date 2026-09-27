#!/usr/bin/env -S bun
/** Read saved update events from stdin; emit versions proven by local dpkg logs. */
import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'

const sixHours = 6 * 60 * 60 * 1000

/** @typedef {{run_id: string, occurred_at: string, installed: Array<Record<string, unknown>>}} Event */
/** @param {Event[]} events @param {Iterable<string>} logLines
 *  @returns {Array<{run_id: string, installed: Array<Record<string, unknown>>}>} */
export function enrich(events, logLines) {
    /** @type {Map<string, Array<{at: number, version: string}>>} */
    const records = new Map()
    for (const line of logLines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length !== 6 || parts[2] !== 'status' || parts[3] !== 'installed') continue
        const at = new Date(`${parts[0]}T${parts[1]}`).getTime()
        if (!Number.isFinite(at)) continue
        const values = records.get(parts[4]) || []
        values.push({ at, version: parts[5] })
        records.set(parts[4], values)
    }

    const sorted = [...events].sort((left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at))
    /** @type {Array<{run_id: string, installed: Array<Record<string, unknown>>}>} */
    const updates = []
    for (const [index, event] of sorted.entries()) {
        const start = Date.parse(event.occurred_at)
        let end = start + sixHours
        if (index + 1 < sorted.length) end = Math.min(end, Date.parse(sorted[index + 1].occurred_at))
        let changed = false
        const installed = event.installed.map(item => {
            const result = { ...item }
            if (!result.version) {
                const name = String(result.package)
                const matches = [...records.entries()]
                    .filter(([packageName]) => packageName === name || !name.includes(':') && packageName.split(':')[0] === name)
                    .flatMap(([, values]) => values)
                    .filter(record => record.at >= start && record.at < end)
                const versions = new Set(matches.map(record => record.version))
                // Never substitute today's version or guess between multiple installs.
                if (versions.size === 1) {
                    result.version = versions.values().next().value
                    changed = true
                }
            }
            return result
        })
        if (changed) updates.push({ run_id: event.run_id, installed })
    }
    return updates
}

async function* dpkgLogLines() {
    for (const name of await readdir('/var/log')) {
        if (!name.startsWith('dpkg.log')) continue
        const path = `/var/log/${name}`
        const stream = createReadStream(path)
        const input = name.endsWith('.gz') ? stream.pipe(createGunzip()) : stream
        const lines = createInterface({ input, crlfDelay: Infinity })
        for await (const line of lines) yield line
    }
}

async function readEvents() {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    return JSON.parse(input)
}

if (process.argv[1]?.endsWith('/backfill-installed-versions.ts') ||
    process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/backfill-installed-versions.ts')) {
    process.stdout.write(`${JSON.stringify(enrich(await readEvents(), await collectLines()))}\n`)
}

async function collectLines() {
    const lines = []
    for await (const line of dpkgLogLines()) lines.push(line)
    return lines
}
