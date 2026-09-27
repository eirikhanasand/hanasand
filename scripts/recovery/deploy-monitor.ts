#!/usr/bin/env node
/** Deploy the recovery monitor while keeping its mounts and local settings. */
import { execFileSync, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const release = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(release || '')) throw new Error('Pass the full release commit.')
const name = 'hanasand-health-monitor'
const inspect = JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
if (inspect.HostConfig.NetworkMode !== 'host') throw new Error('Expected host networking.')
const image = `hanasand-recovery-monitor:${release}`
execFileSync('docker', ['build', '-f', 'Dockerfile.monitor', '-t', image, '.'], { cwd: new URL('.', import.meta.url), stdio: 'inherit' })
const settings = Object.fromEntries(inspect.Config.Env.map(value => {
    const separator = value.indexOf('=')
    return [value.slice(0, separator), value.slice(separator + 1)]
}))
settings.HANASAND_RELEASE_COMMIT = release
settings.RECOVERY_ROOT = '/recovery'
const command = ['run', '-d', '--name', name, '--restart', 'unless-stopped', '--network', 'host']
for (const mount of inspect.Mounts) {
    if (mount.Destination !== '/var/run/docker.sock') continue
    const source = mount.Type === 'volume' ? mount.Name : mount.Source
    command.push('-v', `${source}:${mount.Destination}${mount.RW ? '' : ':ro'}`)
}
command.push('-v', '/home/hanasand/hanasand/ops/runtime:/recovery')
for (const key of Object.keys(settings)) if (key.startsWith('RECOVERY_') || key === 'HANASAND_RELEASE_COMMIT') command.push('-e', key)
command.push(image)
const previous = `${name}-before-${release.slice(0, 12)}`
execFileSync('docker', ['stop', name], { stdio: 'ignore' })
execFileSync('docker', ['rename', name, previous], { stdio: 'ignore' })
try {
    execFileSync('docker', command, { env: { ...process.env, ...settings }, stdio: 'inherit' })
    let ready = false
    for (let attempt = 0; attempt < 45; attempt++) {
        try {
            const response = await fetch(`http://127.0.0.1:${settings.RECOVERY_PORT || '19901'}/status`, { signal: AbortSignal.timeout(3000) })
            const state = await response.json()
            if (response.ok && state.notificationHealth === 'case_monitoring' && Date.now() / 1000 - state.sampledAt < 30) { ready = true; break }
        } catch { /* Retry until the fresh monitor sample is visible. */ }
        await delay(2000)
    }
    if (!ready) throw new Error('New monitor did not produce a fresh sample.')
} catch (error) {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
    execFileSync('docker', ['rename', previous, name], { stdio: 'ignore' })
    execFileSync('docker', ['start', name], { stdio: 'ignore' })
    throw error
}
console.log(`Recovery monitor deployed: ${release}`)
