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
console.log('remote_app_path=/home/ubuntu/hanasand')
console.log('remote_openresty_path=/home/ubuntu/openresty')
console.log('remote_frontend_rebuild=cd /home/ubuntu/hanasand && docker compose up -d --build frontend')
console.log('remote_web_service=docker container openresty')
console.log('remote_openresty_check=cd /home/ubuntu/openresty && docker compose exec -T openresty openresty -t')
console.log('remote_openresty_reload=cd /home/ubuntu/openresty && docker compose up -d --build')
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
