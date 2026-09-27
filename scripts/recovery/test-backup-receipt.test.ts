import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { receive, validateTarMembers } from './receive-backup.ts'

const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
const archiveStream = (archive: string) => Readable.toWeb(Readable.from(readFileSync(archive))) as ReadableStream<Uint8Array>
const makeArchive = (root: string, members: Record<string, Buffer>) => {
    for (const [name, body] of Object.entries(members)) writeFileSync(path.join(root, name), body)
    const archive = path.join(root, 'bundle.tar')
    const result = spawnSync('tar', ['-cf', archive, '-C', root, ...Object.keys(members)], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr)
    return archive
}

describe('verified recovery backup receiver', () => {
    test('accepts a checksummed logical backup and preserves read-only parent ownership', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'backup-receipt-'))
        try {
            const backups = path.join(root, 'backups'); mkdirSync(backups)
            const payload = Buffer.from('verified logical database archive')
            const proof = Buffer.from(JSON.stringify({ restoreVerified: true, backup: '20260924T110000Z', verifiedAt: '2026-09-24T11:00:00Z',
                format: 'pg_dump-custom', checksums: { 'hanasand.dump': hash(payload) } }))
            const archive = makeArchive(backups, { 'hanasand.dump': payload, 'verification.json': proof })
            await receive(root, archiveStream(archive))
            expect(readFileSync(path.join(backups, '20260924T110000Z/hanasand.dump'))).toEqual(payload)
            expect(JSON.parse(readFileSync(path.join(backups, 'status.json'), 'utf8')).format).toBe('pg_dump-custom')
        } finally { rmSync(root, { recursive: true, force: true }) }
    })

    test('rejects mixed members, symlinks, oversized declarations, and checksum mismatches', async () => {
        expect(() => validateTarMembers(['base.tar.gz'], ['-rw-r--r-- 0/0 68719476737 2026-09-24 00:00 base.tar.gz'])).toThrow('capacity limit')
        expect(() => validateTarMembers(['hanasand.dump', 'base.tar.gz', 'verification.json'], [
            '-rw-r--r-- 0/0 1 2026-09-24 00:00 hanasand.dump', '-rw-r--r-- 0/0 1 2026-09-24 00:00 base.tar.gz',
            '-rw-r--r-- 0/0 1 2026-09-24 00:00 verification.json'])).toThrow('Incomplete or mixed')
        expect(() => validateTarMembers(['../escape'], ['-rw-r--r-- 0/0 1 2026-09-24 00:00 ../escape'])).toThrow('Unexpected backup member')
        const root = mkdtempSync(path.join(tmpdir(), 'backup-invalid-'))
        try {
            const backups = path.join(root, 'backups'); mkdirSync(backups)
            const payload = Buffer.from('wrong checksum')
            const proof = Buffer.from(JSON.stringify({ restoreVerified: true, backup: '20260924T110000Z', verifiedAt: '2026-09-24T11:00:00Z',
                format: 'pg_dump-custom', checksums: { 'hanasand.dump': '0'.repeat(64) } }))
            const archive = makeArchive(backups, { 'hanasand.dump': payload, 'verification.json': proof })
            await expect(receive(root, archiveStream(archive))).rejects.toThrow('Backup verification mismatch')
            expect(() => readFileSync(path.join(backups, '20260924T110000Z'))).toThrow()
        } finally { rmSync(root, { recursive: true, force: true }) }
    })
})
