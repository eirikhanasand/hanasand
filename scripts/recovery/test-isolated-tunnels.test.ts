import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configure, migrate } from './isolated-tunnels'

describe('isolated recovery tunnels', () => {
    test('moves only peer listeners to the isolated ports', () => {
        const input = { site: 'inspur', peerStatusUrl: 'http://127.0.0.1:19911/status', services: [{ instances: [
            { site: 'ovh', address: 'http://127.0.0.1:19080', health: 'http://127.0.0.1:19090/health' },
            { site: 'inspur', address: 'http://127.0.0.1:19080', health: 'http://127.0.0.1:19090/health' },
        ] }] }
        const result = migrate(input)
        expect(result.services[0].instances[0].address).toBe('http://127.0.0.1:29080')
        expect(result.services[0].instances[1]).toEqual(input.services[0].instances[1])
        expect(result.peerStatusUrl).toBe('http://127.0.0.1:29911/status')
        expect(input.services[0].instances[0].address).toBe('http://127.0.0.1:19080')
    })

    test('writes a protected original and atomically updates site config', () => {
        const root = mkdtempSync(join(tmpdir(), 'hanasand-tunnel-test-'))
        try {
            const original = { site: 'ovh', services: [{ instances: [{ site: 'inspur', address: 'http://127.0.0.1:18503' }] }] }
            Bun.write(join(root, 'config.json'), JSON.stringify(original))
            configure(root)
            expect(JSON.parse(readFileSync(join(root, 'config.json'), 'utf8')).services[0].instances[0].address).toBe('http://127.0.0.1:28503')
            expect(JSON.parse(readFileSync(join(root, 'config.before-isolated-tunnels.json'), 'utf8'))).toEqual(original)
        } finally { rmSync(root, { recursive: true, force: true }) }
    })
})
