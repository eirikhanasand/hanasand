import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordBackupResult, removeVerifiedBackups, restoreSizeGiB, verificationProof } from './backup-helper'

describe('backup helpers', () => {
    test('sizes the isolated restore with headroom and rejects malformed manifests', () => {
        expect(restoreSizeGiB(JSON.stringify({ Files: [{ Size: 80 * 1024 ** 3 }] }))).toBe(96)
        expect(restoreSizeGiB(JSON.stringify({ Files: [{ Size: 200 * 1024 ** 3 }] }))).toBe(240)
        expect(() => restoreSizeGiB('{"Files":[]}')).toThrow()
        expect(() => restoreSizeGiB('{"Files":[{"Size":-1}]}')).toThrow()
    })

    test('creates only a complete checksum proof', () => {
        const checksums = ['base.tar.gz', 'pg_wal.tar.gz', 'backup_manifest'].map(name => `${'a'.repeat(64)}  ${name}`).join('\n')
        const proof = verificationProof(checksums, new Date('2026-09-28T00:00:00.000Z')) as any
        expect(proof.restoreVerified).toBe(true)
        expect(Object.keys(proof.checksums).sort()).toEqual(['backup_manifest', 'base.tar.gz', 'pg_wal.tar.gz'])
        expect(() => verificationProof(checksums.split('\n').slice(1).join('\n'))).toThrow()
    })

    test('atomically records status and removes only verified prior snapshots', () => {
        const root = mkdtempSync(join(tmpdir(), 'hanasand-backup-test-'))
        try {
            const status = join(root, 'status.json')
            recordBackupResult(status, 0, 1234)
            expect(JSON.parse(readFileSync(status, 'utf8'))).toEqual({ status: 'verified', at: 1234 })
            const old = join(root, '20260901T000000Z', 'data'), current = join(root, '20260902T000000Z', 'data')
            const unverified = join(root, '20260903T000000Z', 'data')
            for (const directory of [old, current]) { mkdirSync(directory, { recursive: true }); Bun.write(join(directory, 'verification.json'), '{}') }
            mkdirSync(unverified, { recursive: true })
            removeVerifiedBackups(root, '20260902T000000Z')
            expect(existsSync(join(root, '20260901T000000Z'))).toBe(false)
            expect(readFileSync(join(current, 'verification.json'), 'utf8')).toBe('{}')
            expect(existsSync(unverified)).toBe(true)
        } finally { rmSync(root, { recursive: true, force: true }) }
    })
})
