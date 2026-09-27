import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { createHandler } from './monitor.ts'

describe('recovery monitor disk diagnostics privacy', () => {
    test('only the private diagnostics endpoint contains directory paths', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'monitor-disk-'))
        const snapshot = { sampledAt: '2026-09-19T00:00:00Z', host: 'test', filesystems: [{ directories: [{ path: '/private/directory', sizeBytes: 42 }] }] }
        await writeFile(path.join(root, 'disk-directories.json'), JSON.stringify(snapshot))
        await mkdir(path.join(root, 'status'))
        await writeFile(path.join(root, 'status/state.json'), JSON.stringify({ sampledAt: Date.now() / 1000, updatedAt: new Date().toISOString(), mode: 'normal', readOnly: false, services: [], diskDiagnostics: snapshot }))
        const handler = createHandler(root)
        try {
            const request = async pathname => {
                let status = 200
                const headers = {}
                let body = ''
                await handler({ url: `http://localhost${pathname}` }, {
                    writeHead(code, values = {}) { status = code; Object.assign(headers, values); return this },
                    end(value = '') { body = value },
                })
                return { status, headers, body }
            }
            expect(JSON.parse((await request('/disk-diagnostics')).body)).toEqual(snapshot)
            for (const endpoint of ['/status', '/health', '/public-status']) {
                const response = await request(endpoint)
                const body = response.body
                expect(body).not.toContain('diskDiagnostics')
                expect(body).not.toContain('/private/directory')
            }
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })
})
