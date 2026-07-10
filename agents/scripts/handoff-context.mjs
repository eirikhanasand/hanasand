#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = os.homedir()
const personalRoot = path.join(home, 'Desktop', 'personal')
const hanasandRoot = path.join(personalRoot, 'hanasand')
const openrestyRoot = path.join(personalRoot, 'openresty')
const sshConfigPath = path.join(home, '.ssh', 'config')
const zshrcPath = path.join(home, '.zshrc')

const sshConfig = readIfExists(sshConfigPath)
const zshrc = readIfExists(zshrcPath)
const hostBlock = findSshHostBlock(sshConfig, 'hanasand')
const alias = findLastAlias(zshrc, 'hanasand') || '(not found)'

console.log('Hanasand handoff context')
console.log('')
console.log(`personal_root=${personalRoot}`)
console.log(`hanasand_repo=${hanasandRoot}`)
console.log(`openresty_repo=${openrestyRoot}`)
console.log('codex_parent_start=codex --skip-git-repo-check')
console.log('')
console.log(`ssh_alias=${alias}`)
console.log('ssh_host=hanasand')
console.log(`ssh_config=${sshConfigPath}`)
console.log(hostBlock ? indent(hostBlock) : '  (Host hanasand not found)')
console.log('')
console.log('remote_app_path=/home/hanasand/hanasand')
console.log('remote_openresty_path=/home/hanasand/openresty')
console.log('remote_app_update=cd /home/hanasand/hanasand && git fetch github main && git pull --ff-only github main')
console.log('remote_browser_sandbox_rebuild=cd /home/hanasand/hanasand && docker compose -p hanasand --profile unsafe-dev-only build api browser-worker && sudo ops/browser-worker/install-egress-firewall.sh hanasand_browsernet && sudo ops/browser-worker/verify-egress-firewall.sh hanasand_browsernet && docker compose -p hanasand up -d --no-deps api')
console.log('remote_browser_sandbox_enable=after firewall verification, set BROWSER_SANDBOX_EGRESS_FIREWALL_READY=1 for the API service and restart api')
console.log('remote_browser_sandbox_verify=cd /home/hanasand/hanasand && sudo ops/browser-worker/verify-runtime-isolation.sh')
console.log('remote_frontend_rebuild=cd /home/hanasand/hanasand && docker compose -p hanasand up -d --build frontend')
console.log('remote_web_service=docker container openresty')
console.log('remote_openresty_check=cd /home/hanasand/openresty && docker compose exec -T openresty openresty -t')
console.log('remote_openresty_reload=cd /home/hanasand/openresty && docker compose up -d --build')
console.log('remote_deploy_execution=if scp/tar-pipe/stdin SSH is blocked with Operation not permitted, use an execution mode with unrestricted outbound SSH or an interactive `ssh -o BatchMode=yes hanasand` session and apply scoped patches/heredocs there')

function readIfExists(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8')
    } catch {
        return ''
    }
}

function findSshHostBlock(source, host) {
    const lines = source.split(/\r?\n/)
    const result = []
    let capture = false

    for (const line of lines) {
        if (/^\s*Host\s+/i.test(line)) {
            if (capture) {
                break
            }
            capture = line.trim().split(/\s+/).slice(1).includes(host)
        }

        if (capture) {
            result.push(line)
        }
    }

    return result.join('\n').trim()
}

function findLastAlias(source, name) {
    let value = ''
    for (const line of source.split(/\r?\n/)) {
        const match = line.match(new RegExp(`^alias\\s+${escapeRegExp(name)}=(.+)$`))
        if (match) {
            value = match[1]
        }
    }

    return value
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function indent(value) {
    return value.split('\n').map((line) => `  ${line}`).join('\n')
}
