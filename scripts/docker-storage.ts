#!/usr/bin/env bun
/** Bounded Docker cache/image cleanup. Never removes containers or volumes. */
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statfsSync, writeFileSync, fsyncSync, closeSync, unlinkSync } from 'node:fs'
import path from 'node:path'

export const STATE_DIR = process.env.DOCKER_STORAGE_STATE_DIR || '/var/lib/hanasand/docker-storage'
export const CACHE_BUDGET = 50_000_000_000
const now = () => new Date().toISOString()
const read = (file: string) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} } }
export function save(file: string, value: unknown) {
    mkdirSync(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    const fd = openSync(temporary, 'w', 0o640)
    try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd) } finally { closeSync(fd) }
    chmodSync(temporary, 0o640)
    renameSync(temporary, file)
}

function docker(pathname: string): any {
    const result = spawnSync('curl', ['--silent', '--show-error', '--fail-with-body', '--unix-socket', '/var/run/docker.sock', `http://localhost/v1.45${pathname}`], { encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 })
    if (result.status !== 0) throw new Error(`Docker inspection failed: ${result.stderr || result.stdout}`)
    return JSON.parse(result.stdout)
}

export function imageInventory(images: any[], containers: any[], clock = Date.now() / 1000) {
    const used = new Set(containers.map(container => container.ImageID))
    const repositories = new Map<string, any[]>()
    for (const image of images) for (const tag of image.RepoTags || []) {
        if (tag !== '<none>:<none>') {
            const key = tag.replace(/:[^:]*$/, '')
            repositories.set(key, [...(repositories.get(key) || []), image])
        }
    }
    const retained = new Set<string>()
    for (const group of repositories.values()) {
        const unique = new Map(group.map(image => [image.Id, image]))
        for (const image of [...unique.values()].sort((a, b) => b.Created - a.Created).slice(0, 2)) retained.add(image.Id)
    }
    return images.flatMap(image => {
        if (used.has(image.Id) || (image.Containers || 0) > 0) return []
        const reason = image.Labels?.['hanasand.keep'] === 'true' ? 'Marked to keep'
            : clock - image.Created < 7 * 86400 ? 'Recent image' : retained.has(image.Id) ? 'Rollback image' : null
        return [{ id: image.Id, names: image.RepoTags?.length ? image.RepoTags : [image.Id.slice(7, 19)], sizeBytes: image.Size,
            uniqueBytes: Math.max(0, image.Size - Math.max(0, image.SharedSize || 0)), retainedReason: reason, eligible: reason === null }]
    }).sort((a, b) => b.sizeBytes - a.sizeBytes)
}

export function snapshot(requestDocker = docker, clock = now) {
    // Container writable-layer accounting is unrelated and can fail during deployment.
    const df = requestDocker('/system/df?type=build-cache&type=image')
    const containers = requestDocker('/containers/json?all=1')
    const cache = df.BuildCache || []
    return { checkedAt: clock(), cacheBytes: cache.reduce((sum: number, row: any) => sum + row.Size, 0),
        reclaimableCacheBytes: cache.filter((row: any) => !row.InUse && !row.Shared).reduce((sum: number, row: any) => sum + row.Size, 0),
        cacheBudgetBytes: CACHE_BUDGET, unusedImages: imageInventory(df.Images || [], containers), schedule: '03:00', timezone: 'Europe/Oslo' }
}

function command(args: string[], timeout = 3_600_000) {
    return new Promise<string>((resolve, reject) => {
        const child = spawn('docker', ['--host', 'unix:///var/run/docker.sock', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = '', stderr = ''
        const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
        child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
        child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
        child.once('error', error => { clearTimeout(timer); reject(error) })
        child.once('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(stderr.trim().slice(-2000) || 'Docker cleanup failed')) })
    })
}

function freeBytes() { const stats = statfsSync('/'); return stats.bavail * stats.bsize }
const normalize = (value: any): any => Array.isArray(value) ? value.map(normalize)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value
export function sameRequest(first: unknown, second: unknown) { return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second)) }

export async function perform(clear = false, options: any = {}) {
    const stateDir = options.stateDir || STATE_DIR
    const requestDocker = options.docker || docker
    const runCommand = options.command || command
    const clock = options.now || now
    const takeSnapshot = options.snapshot || (() => snapshot(requestDocker, clock))
    const getFreeBytes = options.freeBytes || freeBytes
    mkdirSync(stateDir, { recursive: true })
    const stateFile = path.join(stateDir, 'status.json')
    const requestFile = path.join(stateDir, 'request.json')
    const request = clear ? read(requestFile) : {}
    const state = { ...read(stateFile), running: clear, error: clear ? null : read(stateFile).error }
    const publish = (changes: Record<string, unknown>) => { Object.assign(state, changes); save(stateFile, state) }
    let timer: ReturnType<typeof setInterval> | undefined
    let before = 0
    const stopReporting = () => { if (timer) clearInterval(timer); timer = undefined }
    if (clear) {
        Object.assign(state, { freedBytes: 0, progressAt: clock(), phase: 'build_cache', startedAt: clock(), lastAttemptAt: clock() })
        save(stateFile, state)
    }
    try {
        before = getFreeBytes()
        if (clear) {
            timer = setInterval(() => { try { publish({ freedBytes: Math.max(0, getFreeBytes() - before), progressAt: clock() }) } catch { /* Keep last successful progress. */ } }, 1000)
            const args = ['builder', 'prune', '--all', '--force']
            if (!request || Object.keys(request).length === 0) args.push('--keep-storage', String(CACHE_BUDGET))
            await runCommand(args)
            publish({ phase: 'images' })
            const inventory = imageInventory(requestDocker('/images/json?all=1'), requestDocker('/containers/json?all=1'))
            for (const image of inventory) {
                if (!image.eligible) continue
                if (requestDocker('/containers/json?all=1').some((container: any) => container.ImageID === image.id)) continue
                const inspect = requestDocker(`/images/${encodeURIComponent(image.id)}/json`)
                const references = inspect.RepoTags?.length ? inspect.RepoTags : [image.id]
                await runCommand(['image', 'rm', ...references])
            }
            publish({ phase: 'refresh' })
        }
        const measurement = takeSnapshot()
        stopReporting()
        Object.assign(state, measurement)
        const failedAt = state.failedAt || ''
        const recoveredScan = state.errorStage === 'refresh' || (state.lastAttemptAt && state.lastSuccessAt && state.lastAttemptAt <= state.lastSuccessAt && state.lastSuccessAt < failedAt)
        if (clear || recoveredScan) Object.assign(state, { error: null, errorStage: null })
        Object.assign(state, { running: false, phase: null })
        if (clear) {
            const freed = Math.max(0, getFreeBytes() - before)
            Object.assign(state, { lastSuccessAt: clock(), lastFreedBytes: freed, freedBytes: freed, progressAt: clock() })
        }
        save(stateFile, state)
    } catch (error) {
        stopReporting()
        Object.assign(state, { running: false, phase: null, error: (error as Error).message, errorStage: clear ? 'cleanup' : 'refresh', failedAt: clock() })
        save(stateFile, state)
        throw error
    } finally {
        stopReporting()
        if (clear && Object.keys(request).length && sameRequest(request, read(requestFile))) unlinkSync(requestFile)
    }
}

if (import.meta.main) {
    const clear = Bun.argv.includes('--clear')
    if (process.env.HANASAND_DOCKER_STORAGE_LOCKED !== '1') {
        const child = spawnSync('flock', ['-n', path.join(STATE_DIR, 'lock'), process.execPath, import.meta.path, ...(clear ? ['--clear'] : [])],
            { stdio: 'inherit', env: { ...process.env, HANASAND_DOCKER_STORAGE_LOCKED: '1' } })
        process.exit(child.status ?? 1)
    }
    await perform(clear)
}
