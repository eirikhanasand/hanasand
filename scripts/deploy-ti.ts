#!/usr/bin/env bun
// Redeploy existing TI services while preserving their storage, network and secrets.
import { setTimeout as delay } from 'node:timers/promises'
import { spawnSync } from 'node:child_process'

const [release, ...requested] = Bun.argv.slice(2)
if (!release || !/^[0-9a-f]{40}$/.test(release)) throw new Error('Use the full release commit')
if (process.env.HANASAND_TI_LOCKED !== '1') {
    const result = spawnSync('flock', ['-n', '/tmp/hanasand-ti-deploy.lock', process.execPath, import.meta.path, ...Bun.argv.slice(2)],
        { stdio: 'inherit', env: { ...process.env, HANASAND_TI_LOCKED: '1' } })
    process.exit(result.status ?? 1)
}
const names = requested.length ? requested : ['hanasand_ti_scraper', 'hanasand-ti-actors-query']
if (names.some(name => !['hanasand_ti_scraper', 'hanasand-ti-actors-query'].includes(name))) throw new Error('Unknown TI service')
const image = `hanasand-ti-actors:${release}`
class Docker {
    static request(method: string, path: string, data?: unknown) {
        const result = spawnSync('curl', ['--silent', '--show-error', '--unix-socket', '/var/run/docker.sock', '-X', method,
            '--fail-with-body', '-H', 'Content-Type: application/json', ...(data === undefined ? [] : ['-d', JSON.stringify(data)]), `http://localhost/v1.45${path}`],
        { encoding: 'utf8', timeout: 90000 })
        if (result.status !== 0) throw new Error(result.stderr || `Docker ${method} ${path} failed`)
        return result.stdout ? JSON.parse(result.stdout) : null
    }
}
function run(args: string[], quiet = false) {
    const result = spawnSync(args[0], args.slice(1), { encoding: 'utf8', stdio: quiet ? 'ignore' : 'pipe' })
    if (result.status !== 0) throw new Error(result.stderr || `${args[0]} failed`)
    return result.stdout || ''
}
for (const name of names) {
    const old = Docker.request('GET', `/containers/${name}/json`)
    const backup = `${name}-rollback-${release.slice(0, 12)}-${Date.now()}`
    const config = { ...old.Config, Image: image, Hostname: '' }
    config.Env = config.Env.filter((value: string) => !value.startsWith('HANASAND_RELEASE_COMMIT=')).concat(`HANASAND_RELEASE_COMMIT=${release}`)
    if (name === 'hanasand-ti-actors-query' && old.HostConfig.NetworkMode === 'host') {
        const environment = Object.fromEntries(config.Env.map((item: string) => item.split(/=(.*)/s).slice(0, 2)))
        if (!environment.HANASAND_AI_API_BASE) environment.HANASAND_AI_API_BASE = 'http://127.0.0.1:18181'
        config.Env = Object.entries(environment).map(([key, value]) => `${key}=${value}`)
    }
    config.Labels = { ...(config.Labels || {}), 'org.opencontainers.image.revision': release }
    config.HostConfig = old.HostConfig
    config.NetworkingConfig = { EndpointsConfig: Object.fromEntries(Object.entries(old.NetworkSettings.Networks).map(([network, value]: [string, any]) => [network, { Aliases: value.Aliases || [] }])) }
    Docker.request('POST', `/containers/${name}/stop?t=65`)
    Docker.request('POST', `/containers/${name}/rename?name=${backup}`)
    try {
        Docker.request('POST', `/containers/create?name=${name}`, config)
        Docker.request('POST', `/containers/${name}/start`)
        const probe = `const r=await fetch('http://127.0.0.1:'+Bun.env.SCRAPER_PORT+'/v1/health');const d=await r.json();if(!r.ok||!d.ok)process.exit(1);${name === 'hanasand_ti_scraper' ? "if(!d.collection?.public?.supervisorAttached)process.exit(1);" : ''}const p=await fetch('http://127.0.0.1:'+Bun.env.SCRAPER_PORT+'/v1/dwm/exposure-parser/health',{headers:{'x-hanasand-service-token':Bun.env.TI_SCRAPER_SERVICE_TOKEN||''},signal:AbortSignal.timeout(10000)});if(!p.ok)process.exit(1);`
        let ready = false
        for (let attempt = 0; attempt < 90; attempt++) {
            const check = spawnSync('docker', ['exec', name, 'bun', '-e', probe], { stdio: 'ignore' })
            if (check.status === 0) { ready = true; break }
            await delay(2000)
        }
        if (!ready) throw new Error(`New ${name} failed readiness`)
        console.log(`${name} deployed ${release}`)
    } catch (error) {
        spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
        Docker.request('POST', `/containers/${backup}/rename?name=${name}`)
        Docker.request('POST', `/containers/${name}/start`)
        throw error
    }
}
