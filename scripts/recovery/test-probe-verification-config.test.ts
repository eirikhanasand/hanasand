import { mkdtemp, chmod, symlink, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { probeVerificationSettings } from './probe-verification-config.ts'

describe('private probe verification configuration', () => {
    test('leaves verification unavailable when the file is absent', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'probe-config-'))
        try { expect(probeVerificationSettings(path.join(root, 'absent'))).toEqual({}) }
        finally { await rm(root, { recursive: true, force: true }) }
    })

    test('loads only private regular files with valid supported keys', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'probe-config-'))
        const file = path.join(root, 'keys.json')
        const valid = { MODEL_PROBE_PROOF_KEY: 'a'.repeat(64), READINESS_AUDIT_PROOF_PUBLIC_KEY: 'b'.repeat(64) }
        try {
            await writeFile(file, JSON.stringify(valid), { mode: 0o600 })
            await chmod(file, 0o600)
            expect(probeVerificationSettings(file)).toEqual(valid)
            await chmod(file, 0o644)
            expect(() => probeVerificationSettings(file)).toThrow('private regular file')
            await chmod(file, 0o600)
            const linked = path.join(root, 'linked')
            await symlink(file, linked)
            expect(() => probeVerificationSettings(linked)).toThrow('private regular file')
            for (const invalid of [{}, [], { OTHER_SECRET: 'a'.repeat(64) }, { MODEL_PROBE_PROOF_KEY: 'short' }, { MODEL_PROBE_PROOF_KEY: 12 }]) {
                await writeFile(file, JSON.stringify(invalid))
                await chmod(file, 0o600)
                expect(() => probeVerificationSettings(file)).toThrow('Invalid probe verification configuration')
            }
        } finally { await rm(root, { recursive: true, force: true }) }
    })
})
