import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const script = readFileSync(new URL('../../ops/browser-worker/verify-runtime-isolation.sh', import.meta.url), 'utf8')

for (const value of [
    'com.hanasand.role=browser-session-worker',
    'hanasand_browsernet',
    'HostConfig.Init',
    'HostConfig.AutoRemove',
    'browser worker does not auto-remove after exit',
    'HostConfig.Privileged',
    'browser worker is privileged',
    'HostConfig.IpcMode',
    'expected private',
    'ReadonlyRootfs',
    'Docker init is not enabled',
    'PidsLimit',
    'CapDrop',
    'CapAdd',
    'SecurityOpt',
    'seccomp=',
    'apparmor=docker-default',
    'no-new-privileges',
    'json .Mounts',
    'browser worker has a host control socket mount',
    '--no-sandbox',
    'DB_PASSWORD',
    'VM_API_TOKEN',
    'MAIL_ADMIN_PASSWORD',
    'API_SSH_KEY',
    'unexpected browser worker environment variable present',
    'browser worker must enforce one browser session per container',
    'forbidden operational tool is installed in browser worker',
    'DOCKER-USER',
    'HANASAND-BROWSER-EGRESS',
    'HANASAND_API_CONTAINER',
    'firewall chain does not block browser worker traffic to API container',
    'firewall chain does not allow API worker websocket control traffic',
    'HANASAND_BROWSER_PIDS_LIMIT',
    'Chromium is running inside the main API container',
    'Chromium is installed inside the main API container',
]) {
    assert(script.includes(value), `runtime isolation verifier should check ${value}`)
}

for (const value of ['10.0.0.0/8', '169.254.0.0/16', '192.168.0.0/16', '::ffff:0:0/96', 'fc00::/7']) {
    assert(script.includes(value), `runtime isolation verifier should check firewall block for ${value}`)
}

console.log('Browser runtime isolation verifier contract passed.')
