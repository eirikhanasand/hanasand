#!/usr/bin/env bun
/** Forced SSH command: accept only a bounded, verified PostgreSQL backup bundle. */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, fsyncSync, closeSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { tmpdir } from 'node:os'

const PHYSICAL = ['base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest', 'verification.json']
const LOGICAL = ['hanasand.dump', 'verification.json']
const MAX_BYTES = 64 * 1024 ** 3
const MAX_ARCHIVE_BYTES = MAX_BYTES + 16 * 1024 ** 2

function tar(args: string[]) { return execFileSync('tar', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 }) }
async function sha256(file: string) {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(file)) hash.update(chunk)
    return hash.digest('hex')
}
function atomicJson(file: string, value: unknown) {
    const temporary = path.join(path.dirname(file), `status-${process.pid}-${Date.now()}.tmp`)
    const fd = openSync(temporary, 'wx', 0o600)
    try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temporary, file)
}
export function validateTarMembers(listed: string[], verbose: string[]) {
    if (listed.length !== verbose.length || !listed.length) throw new Error('Unexpected backup archive format')
    const seen: string[] = []
    let declaredTotal = 0
    for (let i = 0; i < listed.length; i++) {
        const name = listed[i]
        const fields = verbose[i].trim().split(/\s+/)
        if (fields[0]?.[0] !== '-' || ![...PHYSICAL, ...LOGICAL].includes(name) || seen.includes(name)) throw new Error('Unexpected backup member')
        const declaredSize = Number(fields[2])
        if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) throw new Error('Unexpected backup member size')
        declaredTotal += declaredSize
        if (declaredTotal > MAX_BYTES) throw new Error('Backup exceeds receiver capacity limit')
        seen.push(name)
    }
    const physical = PHYSICAL.every(name => seen.includes(name)) && seen.length === PHYSICAL.length
    const logical = LOGICAL.every(name => seen.includes(name)) && seen.length === LOGICAL.length
    if (!physical && !logical) throw new Error('Incomplete or mixed backup')
    return { members: physical ? PHYSICAL : LOGICAL, format: logical ? 'pg_dump-custom' : 'pg_basebackup' }
}

export async function receive(root = process.env.RECOVERY_ROOT || '/home/ubuntu/hanasand-recovery', input = Bun.stdin.stream()) {
    const backups = path.join(root, 'backups')
    mkdirSync(backups, { recursive: true, mode: 0o700 })
    const staging = mkdtempSync(path.join(backups, 'incoming-'))
    const archiveFile = path.join(staging, 'bundle.tar')
    try {
        // The forced SSH command provides stdin as Bun.stdin; tests may supply a ReadableStream.
        const output = createWriteStream(archiveFile, { flags: 'wx', mode: 0o600 })
        let archiveBytes = 0
        const reader = input.getReader()
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = Buffer.from(value)
                archiveBytes += chunk.length
                if (archiveBytes > MAX_ARCHIVE_BYTES) throw new Error('Backup archive exceeds receiver capacity limit')
                if (!output.write(chunk)) await new Promise<void>(resolve => output.once('drain', resolve))
            }
            output.end()
            await new Promise<void>((resolve, reject) => { output.once('finish', resolve); output.once('error', reject) })
        } finally { reader.releaseLock() }

        const listed = tar(['-tf', archiveFile]).trim().split(/\r?\n/).filter(Boolean)
        const verbose = tar(['-tvf', archiveFile, '--numeric-owner']).trim().split(/\r?\n/).filter(Boolean)
        const { members, format } = validateTarMembers(listed, verbose)
        tar(['-xf', archiveFile, '-C', staging, '--no-same-owner', '--no-same-permissions'])
        const total = members.filter(name => name !== 'verification.json').reduce((sum, name) => sum + statSync(path.join(staging, name)).size, 0)
            + statSync(path.join(staging, 'verification.json')).size
        if (total > MAX_BYTES) throw new Error('Backup exceeds receiver capacity limit')
        for (const name of members) chmodSync(path.join(staging, name), 0o600)
        const checksums = Object.fromEntries(await Promise.all(members.map(async name => [name, await sha256(path.join(staging, name))])))
        const proof = JSON.parse(readFileSync(path.join(staging, 'verification.json'), 'utf8'))
        if ((proof.format || 'pg_basebackup') !== format) throw new Error('Backup format mismatch')
        if (proof.restoreVerified !== true || members.some(name => name !== 'verification.json' && checksums[name] !== proof.checksums?.[name]))
            throw new Error('Backup verification mismatch')
        const stamp = proof.backup
        if (!/^\d{8}T\d{6}Z$/.test(stamp || '')) throw new Error('Invalid backup identity')
        const final = path.join(backups, stamp)
        if (existsSync(final)) throw new Error('Backup already received')
        rmSync(archiveFile)
        renameSync(staging, final)
        const state = { status: 'verified', backup: stamp, verifiedAt: proof.verifiedAt, restoreVerifiedAt: proof.verifiedAt,
            receivedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), bytes: total, restoreRequired: false, format }
        atomicJson(path.join(backups, 'status.json'), state)
        const bundles = readdirSync(backups, { withFileTypes: true }).filter(item => item.isDirectory() && /^\d{8}T\d{6}Z$/.test(item.name))
            .map(item => path.join(backups, item.name)).filter(dir => existsSync(path.join(dir, 'verification.json')))
            .filter(dir => (JSON.parse(readFileSync(path.join(dir, 'verification.json'), 'utf8')).format || 'pg_basebackup') === format)
            .sort()
        for (const old of bundles.slice(0, -14)) rmSync(old, { recursive: true, force: true })
        console.log(JSON.stringify({ received: stamp, verified: true, bytes: total }))
    } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        throw error
    }
}

if (import.meta.main) await receive()
