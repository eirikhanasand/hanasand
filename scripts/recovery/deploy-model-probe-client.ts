#!/usr/bin/env node
/** Deploy only the native probe caller, preserving its live Docker configuration. */
import { execFileSync, spawnSync } from 'node:child_process'
import { lstatSync, existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs'
import { request } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

export function modelLanesIdle(fetchMetrics = readMetrics) {
    try {
        for (let port = 18081; port <= 18088; port++) {
            const text = fetchMetrics(port)
            for (const metric of ['num_requests_running', 'num_requests_waiting']) {
                const values = [...text.matchAll(new RegExp(`^vllm:${metric}(?:\\{[^\\n]*\\})? ([^\\s]+)(?: [0-9]+)?$`, 'gm'))].map(match => Number(match[1]))
                if (!values.length || values.some(value => !Number.isFinite(value) || value !== 0)) return false
            }
        }
        return true
    } catch { return false }
}

function readMetrics(port) {
    const result = spawnSync('curl', ['-fsS', '--max-time', '2', `http://127.0.0.1:${port}/metrics`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
    if (result.status !== 0) throw new Error('Model metrics unavailable')
    return result.stdout
}

export function dockerApi(method, pathname, body) {
    return new Promise((resolve, reject) => {
        const req = request({ socketPath: '/var/run/docker.sock', host: 'localhost', method, path: '/v1.41' + pathname, timeout: 45_000,
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' } }, response => {
            const chunks = []
            response.on('data', chunk => chunks.push(chunk))
            response.on('end', () => {
                if (response.statusCode >= 300) return reject(new Error(`Docker operation failed: ${method} ${pathname}: HTTP ${response.statusCode}`))
                const data = Buffer.concat(chunks).toString()
                try { resolve(data ? JSON.parse(data) : null) } catch (error) { reject(error) }
            })
        })
        req.on('timeout', () => req.destroy(new Error('Docker API request timed out')))
        req.on('error', reject)
        if (body !== undefined) req.write(JSON.stringify(body))
        req.end()
    })
}

async function health() {
    const response = await fetch('http://127.0.0.1:18182/health', { signal: AbortSignal.timeout(3000) })
    return response.json()
}
function idle(state) { return Object.hasOwn(state, 'activeRequests') ? state.activeRequests === 0 : modelLanesIdle() }
function parseArgs(args) {
    const values = {}
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index]
        if (!['--release', '--source', '--expected-image'].includes(key) || !args[index + 1]) throw new Error('Expected --release, --source, and --expected-image')
        values[key === '--expected-image' ? 'expectedImage' : key.slice(2)] = args[index + 1]
    }
    return values
}

export async function main(args = process.argv.slice(2)) {
    const options = parseArgs(args)
    if (!/^[a-f0-9]{40}$/.test(options.release || '')) throw new Error('Exact committed release required')
    const file = '/home/hanasand/hanasand/ops/runtime/probe-verification.json'
    const key = existsSync(file) ? (() => {
        const stats = lstatSync(file)
        if (!stats.isFile() || stats.mode & 0o077) throw new Error('Probe verification configuration must be a private regular file')
        const config = JSON.parse(readFileSync(file, 'utf8'))
        if (Object.keys(config).some(name => name !== 'MODEL_PROBE_PROOF_KEY') || !/^[a-f0-9]{64}$/.test(config.MODEL_PROBE_PROOF_KEY || '')) throw new Error('Invalid probe verification configuration')
        return config.MODEL_PROBE_PROOF_KEY
    })() : null
    if (!key) throw new Error('Provision the common verification key first')
    const source = path.resolve(options.source)
    const image = `hanasand-ai-model-client:${options.release}`
    execFileSync('docker', ['build', '-t', image, '--label', `org.opencontainers.image.revision=${options.release}`, '-f', path.join(source, 'ti/ai-model-client/Dockerfile'), source], { stdio: 'inherit' })

    if (process.env.HANASAND_DEPLOY_LOCK_HELD !== '1') {
        const entrypoint = process.env.HANASAND_TYPESCRIPT_ENTRYPOINT || fileURLToPath(import.meta.url)
        const runner = path.resolve(path.dirname(entrypoint), '../run-typescript-node.sh')
        const locked = spawnSync('flock', ['-x', '/tmp/hanasand-frontend-deploy.lock', runner, entrypoint, ...args], {
            env: { ...process.env, HANASAND_DEPLOY_LOCK_HELD: '1' }, stdio: 'inherit',
        })
        process.exit(locked.status ?? 1)
    }

    const name = 'hanasand_ai_model_client'
    const previous = await dockerApi('GET', `/containers/${name}/json`)
    if (previous.Config.Image !== options.expectedImage || previous.HostConfig.NetworkMode !== 'host') throw new Error('Runtime changed; inspect before replacing')
    execFileSync('sudo', ['-n', 'install', '-d', '-m', '700', '-o', 'root', '-g', 'root', '/var/lib/hanasand/model-probe-config', '/var/lib/hanasand/model-probe-receipts'], { stdio: 'inherit' })
    const secretFile = `/tmp/model-probe-key-${process.pid}`
    writeFileSync(secretFile, JSON.stringify({ MODEL_PROBE_PROOF_KEY: key }), { mode: 0o600, flag: 'wx' })
    try { execFileSync('sudo', ['-n', 'install', '-m', '600', '-o', 'root', '-g', 'root', secretFile, '/var/lib/hanasand/model-probe-config/verification.json'], { stdio: 'inherit' }) }
    finally { unlinkSync(secretFile) }
    let isIdle = false
    for (let attempt = 0; attempt < 45; attempt++) {
        const state = await health().catch(() => ({}))
        if (state.connected && state.modelHealth?.ready && idle(state)) {
            await delay(1000)
            if (idle(await health())) { isIdle = true; break }
        }
        await delay(1000)
    }
    if (!isIdle) throw new Error('Model client did not become idle; caller remains running')
    const backup = `${name}_probe_rollback_${options.release.slice(0, 12)}`
    const config = { ...previous.Config, Image: image,
        Env: (previous.Config.Env || []).filter(value => !['MODEL_PROBE_PROOF_DIR', 'MODEL_PROBE_PROOF_KEY', 'MODEL_PROBE_VERIFICATION_FILE', 'HANASAND_RELEASE_COMMIT'].includes(value.split('=', 1)[0])) }
    config.Env.push('MODEL_PROBE_PROOF_DIR=/model-probe-receipts', `HANASAND_RELEASE_COMMIT=${options.release}`)
    config.Labels = { ...config.Labels, 'org.opencontainers.image.revision': options.release }
    const host = { ...previous.HostConfig }
    host.Binds = (host.Binds || []).filter(value => !['/model-probe-receipts', '/model-probe-config'].includes(value.split(':')[1]))
    host.Binds.push('/var/lib/hanasand/model-probe-receipts:/model-probe-receipts:rw', '/var/lib/hanasand/model-probe-config:/model-probe-config:ro')
    config.HostConfig = host
    let stopped = false
    let renamed = false
    let created = false
    try {
        await dockerApi('POST', `/containers/${name}/stop?t=15`); stopped = true
        await dockerApi('POST', `/containers/${name}/rename?name=${backup}`); renamed = true
        await dockerApi('POST', `/containers/create?name=${name}`, config); created = true
        await dockerApi('POST', `/containers/${name}/start`)
        for (let attempt = 0; attempt < 20; attempt++) {
            await delay(6000)
            try {
                const state = await health()
                if (state.connected && state.modelHealth?.ready && state.modelProbeProof?.lastProofAt) {
                    const live = await dockerApi('GET', `/containers/${name}/json`)
                    if (live.Config.Image !== image) throw new Error('Unexpected live model client image')
                    await dockerApi('DELETE', `/containers/${backup}`)
                    console.log(`Model client healthy with native signed proof at release ${options.release}`)
                    return
                }
            } catch { /* Continue only until signed readiness or timeout. */ }
        }
        throw new Error('Signed probe readiness not confirmed')
    } catch (error) {
        if (created) await dockerApi('DELETE', `/containers/${name}?force=true`)
        if (renamed) await dockerApi('POST', `/containers/${backup}/rename?name=${name}`)
        if (stopped) await dockerApi('POST', `/containers/${name}/start`)
        throw error
    }
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/deploy-model-probe-client.ts') || process.argv[1]?.endsWith('/deploy-model-probe-client.ts')) {
    await main()
}
