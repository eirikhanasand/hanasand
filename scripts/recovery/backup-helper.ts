import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

export function restoreSizeGiB(manifest: string): number {
    const files = JSON.parse(manifest).Files
    if (!Array.isArray(files) || files.length === 0) throw new Error('Backup manifest contains no files')
    const sizes = files.map((entry: { Size?: string | number }) => Number(entry.Size))
    if (sizes.some((size: number) => !Number.isSafeInteger(size) || size < 0)) throw new Error('Backup manifest contains an invalid file size')
    return Math.max(96, Math.ceil(sizes.reduce((sum: number, size: number) => sum + size, 0) * 1.2 / 1024 ** 3))
}

export function verificationProof(checksumsText: string, now = new Date()): object {
    const checksums: Record<string, string> = {}
    for (const line of checksumsText.trim().split('\n')) {
        const match = line.match(/^([a-f0-9]{64})\s+([\w.-]+)$/)
        if (!match) throw new Error('Backup checksum output is malformed')
        checksums[match[2]] = match[1]
    }
    const expected = ['base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest']
    if (Object.keys(checksums).length !== expected.length || expected.some(name => !checksums[name]))
        throw new Error('Backup checksum set is incomplete')
    return { backup: now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'), verifiedAt: now.toISOString(), restoreVerified: true, checksums }
}

export function recordBackupResult(statusFile: string, exitCode: number, now = Date.now()): void {
    const temporary = statusFile.replace(/\.[^/.]+$/, '.tmp')
    writeFileSync(temporary, JSON.stringify({ status: exitCode === 0 ? 'verified' : 'failed', at: now }))
    renameSync(temporary, statusFile)
}

export function removeVerifiedBackups(root: string, keepStamp: string): void {
    for (const name of readdirSync(root)) {
        if (!/^\d{8}T\d{6}Z$/.test(name) || name === keepStamp) continue
        const directory = join(root, name)
        if (existsSync(join(directory, 'data', 'verification.json'))) rmSync(directory, { recursive: true, force: true })
    }
}

if (import.meta.main) {
    const [action, ...args] = Bun.argv.slice(2)
    if (action === 'size') console.log(restoreSizeGiB(readFileSync(args[0], 'utf8')))
    else if (action === 'proof') console.log(JSON.stringify(verificationProof(args[0])))
    else if (action === 'result') recordBackupResult(args[0], Number(args[1]))
    else if (action === 'retain') removeVerifiedBackups(args[0], basename(args[1]))
    else throw new Error('Usage: backup-helper.ts size|proof|result|retain ...')
}
