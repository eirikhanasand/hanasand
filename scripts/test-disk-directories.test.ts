import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import { collect, largestDirectories } from './disk-directories.ts'

describe('disk directory diagnostics', () => {
    test('reports paths, byte sizes, and only the twenty largest directories', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'disk-dirs-'))
        try {
            for (let i = 0; i < 25; i++) {
                const directory = path.join(root, `directory ${i}`)
                await mkdir(directory)
                await writeFile(path.join(directory, 'data'), Buffer.alloc((i + 1) * 8192))
            }
            const result = await largestDirectories(root)
            expect(result.complete).toBe(true)
            expect(result.directories).toHaveLength(20)
            expect(result.directories[0].path).toBe(path.join(root, 'directory 24'))
            expect(result.directories[0].sizeBytes).toBeGreaterThanOrEqual(25 * 8192)
            expect(result.directories.map(row => row.sizeBytes)).toEqual([...result.directories.map(row => row.sizeBytes)].sort((a, b) => b - a))
        } finally { await rm(root, { recursive: true, force: true }) }
    })

    test('marks an expired scan as incomplete', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'disk-dirs-'))
        try { expect((await largestDirectories(root, 0)).complete).toBe(false) }
        finally { await rm(root, { recursive: true, force: true }) }
    })

    test('rejects stale host metrics', async () => {
        await expect(collect({ sampledAt: '2020-01-01T00:00:00Z', storage: [] })).rejects.toThrow('Host telemetry is stale')
    })
})
