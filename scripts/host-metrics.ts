#!/usr/bin/env bun
/** Collect host metrics once; API workers consume the same atomic snapshot. */
import { execFileSync } from 'node:child_process'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { readdirSync, readFileSync, statSync, statfsSync } from 'node:fs'
import { hostname } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

export function number(value) {
    if (value == null) return null
    const parsed = Number(String(value ?? '').trim().split(/\s+/)[0])
    return Number.isFinite(parsed) ? parsed : null
}

export function limitedSensor(label, value, limit, unit) {
    const threshold = limit != null && limit > 0 ? Math.floor(limit * 0.9) : null
    return { label, value, unit, reportedLimit: limit, alertLimit: threshold,
        margin: threshold != null && value != null ? Math.round((threshold - value) * 1000) / 1000 : null }
}

function readNumber(file) {
    try { return number(readFileSync(file, 'utf8')) }
    catch { return null }
}

function matchingEntries(directory, pattern) {
    try { return readdirSync(directory).filter(name => pattern.test(name)).map(name => path.join(directory, name)) }
    catch { return [] }
}

export function updateStatus(file = '/var/lib/hanasand/apt-updates/status.json', read = readFileSync) {
    try {
        const status = JSON.parse(read(file, 'utf8'))
        if (!status || typeof status !== 'object' || Array.isArray(status)) throw new Error('Expected an update status object')
        return status
    } catch (error) {
        return { status: 'unknown', last_error: 'Host update status unavailable: ' + error.constructor.name }
    }
}

function cpuSample() {
    const values = readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number)
    return [values.reduce((sum, value) => sum + value, 0), values[3] + values[4]]
}

export function cpuPercent(first, second) {
    const total = second[0] - first[0]
    const idle = second[1] - first[1]
    return total > 0 ? Math.round((100 * (1 - idle / total)) * 100) / 100 : null
}

function xmlValue(source, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = source.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`))
    return match?.[1].replace(/<[^>]+>/g, '').replace(/&(?:lt|gt|quot|apos|amp);/g, entity => ({ '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' })[entity]).trim() ?? null
}

function xmlPath(source, pathParts) {
    let current = source
    for (const part of pathParts.split('/')) {
        const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const match = current.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`))
        if (!match) return null
        current = match[1]
    }
    return current.replace(/<[^>]+>/g, '').trim()
}

export async function collect() {
    const first = cpuSample()
    const energy = new Map()
    for (const directory of matchingEntries('/sys/class/powercap', /^intel-rapl:/)) {
        if (path.basename(directory).split(':').length !== 2) continue
        const value = readNumber(path.join(directory, 'energy_uj'))
        if (value != null) energy.set(directory, { value, at: performance.now() })
    }
    await delay(1000)
    const cpu = cpuPercent(first, cpuSample())
    const power = []
    for (const [directory, sample] of energy) {
        const end = readNumber(path.join(directory, 'energy_uj'))
        const limit = readNumber(path.join(directory, 'constraint_0_power_limit_uw'))
        const maximum = readNumber(path.join(directory, 'max_energy_range_uj'))
        if (end == null) continue
        let delta = end - sample.value
        if (delta < 0 && maximum) delta += maximum
        const watts = delta / 1_000_000 / ((performance.now() - sample.at) / 1000)
        power.push(limitedSensor(path.basename(directory), Math.round(watts * 100) / 100, limit ? limit / 1_000_000 : null, 'W'))
    }
    const memory = Object.fromEntries(readFileSync('/proc/meminfo', 'utf8').split('\n').filter(line => line.includes(':')).map(line => {
        const [key, raw] = line.split(':')
        return [key, Number(raw.trim().split(/\s+/)[0]) * 1024]
    }).filter(([, value]) => Number.isFinite(value)))
    const storage = []
    const devices = new Set()
    for (const line of readFileSync('/proc/mounts', 'utf8').split('\n')) {
        const [device, rawTarget, kind] = line.split(/\s+/)
        if (!device?.startsWith('/dev/') || ['squashfs', 'iso9660'].includes(kind)) continue
        const target = rawTarget.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
        try {
            const identity = statSync(target).dev
            if (devices.has(identity)) continue
            const stats = statfsSync(target)
            const used = stats.blocks - stats.bfree
            const available = stats.bavail
            storage.push({ path: target, device, usedPercent: used + available ? Math.round(10000 * used / (used + available)) / 100 : null,
                totalBytes: stats.blocks * stats.bsize, availableBytes: available * stats.bsize })
            devices.add(identity)
        } catch { /* A mount can disappear between reading /proc/mounts and statfs. */ }
    }
    const temperatures = []
    for (const hwmon of matchingEntries('/sys/class/hwmon', /^hwmon\d+$/).sort()) {
        for (const file of matchingEntries(hwmon, /^temp.*_input$/).sort()) {
            const stem = path.basename(file).replace(/_input$/, '')
            const value = readNumber(file)
            const limit = readNumber(path.join(hwmon, stem + '_max')) ?? readNumber(path.join(hwmon, stem + '_crit'))
            if (value == null) continue
            let label = stem
            try { label = readFileSync(path.join(hwmon, stem + '_label'), 'utf8').trim() } catch { /* Use sensor name. */ }
            temperatures.push(limitedSensor(`${path.basename(hwmon)} ${label}`, value / 1000, limit ? limit / 1000 : null, '°C'))
        }
    }
    const gpus = []
    const unavailable = []
    try {
        const document = execFileSync('nvidia-smi', ['-q', '-x'], { timeout: 10_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        const gpuElements = [...document.matchAll(/<gpu\b([^>]*)>([\s\S]*?)<\/gpu>/g)]
        for (const [, attributes, content] of gpuElements) {
            const label = xmlValue(content, 'uuid') || attributes.match(/\bid="([^"]+)"/)?.[1]
            if (!label) continue
            gpus.push({ id: label, name: xmlValue(content, 'product_name'), usedPercent: number(xmlPath(content, 'utilization/gpu_util')) })
            for (const [field, limitField, suffix] of [['gpu_temp', 'gpu_temp_max_gpu_threshold', 'GPU'], ['memory_temp', 'gpu_temp_max_mem_threshold', 'memory']]) {
                const value = number(xmlPath(content, `temperature/${field}`))
                const max = number(xmlPath(content, `temperature/${limitField}`))
                if (value != null) temperatures.push(limitedSensor(`${label} ${suffix}`, value, max, '°C'))
            }
            const watts = number(xmlPath(content, 'gpu_power_readings/instant_power_draw'))
            const limit = number(xmlPath(content, 'gpu_power_readings/current_power_limit'))
            if (watts != null) power.push(limitedSensor(label, watts, limit, 'W'))
        }
    } catch (error) { unavailable.push('GPU telemetry unavailable: ' + error.constructor.name) }
    if (energy.size === 0) unavailable.push('CPU package power is unavailable.')
    unavailable.push('Whole-host wall power is not metered; power readings cover the reported CPU/GPU devices only.')
    const aptUpdates = updateStatus()
    const memoryTotalBytes = memory.MemTotal
    const memoryAvailableBytes = memory.MemAvailable
    return { name: hostname(), sampledAt: new Date().toISOString(), cpuPercent,
        memoryPercent: Math.round(10000 * (1 - memoryAvailableBytes / memoryTotalBytes)) / 100,
        memoryTotalBytes, memoryAvailableBytes, storage, gpus, temperatures, power, unavailable, aptUpdates }
}

async function main() {
    const destination = process.argv[2] || '/var/lib/hanasand/metrics/host.json'
    const temporary = destination.replace(/\.[^.]+$/, '.tmp')
    await writeFile(temporary, JSON.stringify(await collect()), { mode: 0o644 })
    await rename(temporary, destination)
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/host-metrics.ts') || process.argv[1]?.endsWith('/host-metrics.ts')) await main()
