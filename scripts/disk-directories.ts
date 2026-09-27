#!/usr/bin/env bun
/** Bounded, low-priority directory diagnostics for high-storage incidents. */
import { spawn } from 'node:child_process'
import { hostname } from 'node:os'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function largestDirectories(root, timeout = 120) {
    root = path.resolve(root)
    const macOS = process.platform === 'darwin'
    const child = spawn('du', macOS ? ['-x', '-k', '-d', '1', root] : ['-x', '-B1', '--null', '--', root], { stdio: ['ignore', 'pipe', 'ignore'], detached: true })
    let buffer = Buffer.alloc(0)
    const largest = []
    let timedOut = false
    const consume = chunk => {
        buffer = Buffer.concat([buffer, chunk])
        if (macOS) {
            let end
            while ((end = buffer.indexOf(10)) >= 0) {
                const row = buffer.subarray(0, end).toString()
                buffer = buffer.subarray(end + 1)
                const separator = row.indexOf('\t')
                if (separator < 0) continue
                const size = Number(row.slice(0, separator)) * 1024
                const directory = row.slice(separator + 1)
                if (Number.isSafeInteger(size) && size >= 0 && directory !== root) {
                    largest.push({ path: directory, sizeBytes: size })
                    largest.sort((left, right) => right.sizeBytes - left.sizeBytes)
                    if (largest.length > 20) largest.pop()
                }
            }
            return
        }
        let end
        while ((end = buffer.indexOf(0)) >= 0) {
            const row = buffer.subarray(0, end)
            buffer = buffer.subarray(end + 1)
            const separator = row.indexOf(9)
            if (separator < 0) continue
            const size = Number(row.subarray(0, separator).toString())
            const directory = row.subarray(separator + 1).toString()
            if (!Number.isSafeInteger(size) || size < 0 || directory === root) continue
            largest.push({ path: directory, sizeBytes: size })
            largest.sort((left, right) => right.sizeBytes - left.sizeBytes)
            if (largest.length > 20) largest.pop()
        }
    }
    child.stdout.on('data', consume)
    const timer = setTimeout(() => {
        timedOut = true
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* Process already exited. */ }
    }, Math.max(0, timeout * 1000))
    const code = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('close', (status, signal) => resolve(signal ? 128 : status ?? 1))
    }).finally(() => clearTimeout(timer))
    return { complete: !timedOut && code === 0, directories: largest }
}

export async function collect(snapshot, now = new Date()) {
    const sampled = Date.parse(snapshot.sampledAt)
    const age = (now.getTime() - sampled) / 1000
    if (!Number.isFinite(sampled) || age < -5 || age > 90) throw new Error('Host telemetry is stale')
    const filesystems = []
    for (const filesystem of snapshot.storage || []) {
        if ((filesystem.usedPercent || 0) < 80) continue
        filesystems.push({ path: filesystem.path, usedPercent: filesystem.usedPercent, ...(await largestDirectories(filesystem.path)) })
    }
    return { sampledAt: now.toISOString(), host: hostname(), filesystems }
}

async function main() {
    const metricsPath = process.argv[2] || '/var/lib/hanasand/metrics/host.json'
    const destination = path.join(path.dirname(metricsPath), 'disk-directories.json')
    const snapshot = JSON.parse(await readFile(metricsPath, 'utf8'))
    const temporary = destination.replace(/\.[^.]+$/, '.tmp')
    await writeFile(temporary, JSON.stringify(await collect(snapshot)), { mode: 0o644 })
    await rename(temporary, destination)
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/disk-directories.ts') || process.argv[1]?.endsWith('/disk-directories.ts')) await main()
