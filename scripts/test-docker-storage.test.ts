import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { imageInventory, perform, sameRequest, snapshot, CACHE_BUDGET } from './docker-storage.ts'

describe('Docker storage maintenance', () => {
    test('retains running, pinned, recent and two rollback images per repository', () => {
        const now = 2_000_000
        const images = Array.from({ length: 6 }, (_, i) => ({ Id: String(i + 1), RepoTags: [`app:v${i + 1}`], Created: (i + 1) * 100, Size: 100, SharedSize: 40 }))
        images.push({ Id: 'recent', RepoTags: ['other:new'], Created: now - 1, Size: 50 })
        images.push({ Id: 'pinned', RepoTags: [], Created: 1, Size: 50, Labels: { 'hanasand.keep': 'true' } })
        const rows = imageInventory(images, [{ ImageID: '1' }, { ImageID: '2' }], now)
        expect(new Set(rows.filter(row => row.eligible).map(row => row.id))).toEqual(new Set(['3', '4']))
        expect(rows.filter(row => row.retainedReason === 'Rollback image').map(row => row.id).sort()).toEqual(['5', '6'])
        expect(rows[0].uniqueBytes).toBe(60)
        expect(rows.map(row => row.id)).not.toContain('1')
        expect(rows.map(row => row.id)).not.toContain('2')
    })

    test('counts multitag images once and refreshes only image/cache metrics', () => {
        const images = [{ Id: 'a', RepoTags: ['app:v3', 'app:latest'], Created: 3, Size: 10 },
            { Id: 'b', RepoTags: ['app:v2'], Created: 2, Size: 10 }, { Id: 'c', RepoTags: ['app:v1'], Created: 1, Size: 10 }]
        expect(imageInventory(images, [], 2_000_000).filter(row => row.eligible).map(row => row.id)).toEqual(['c'])
        const calls: string[] = []
        const value = snapshot(url => { calls.push(url); return url.startsWith('/system') ? { BuildCache: [{ Size: 10, InUse: false }], Images: [] } : [] }, () => 'now')
        expect(calls).toEqual(['/system/df?type=build-cache&type=image', '/containers/json?all=1'])
        expect(value.reclaimableCacheBytes).toBe(10)
        expect(value.cacheBudgetBytes).toBe(CACHE_BUDGET)
        expect(sameRequest({ id: 1, nested: { a: 1, b: 2 } }, { nested: { b: 2, a: 1 }, id: 1 })).toBe(true)
    })

    test('refresh preserves queued cleanup requests and clears only a recovered refresh error', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docker-storage-'))
        try {
            writeFileSync(path.join(root, 'status.json'), JSON.stringify({ error: 'scan failed', errorStage: 'refresh', lastSuccessAt: 'previous' }))
            writeFileSync(path.join(root, 'request.json'), JSON.stringify({ requestedAt: 'now' }))
            const commands: string[][] = []
            await perform(false, { stateDir: root, command: async args => { commands.push(args); return '' },
                snapshot: () => ({ checkedAt: 'later' }), now: () => 'later' })
            const saved = JSON.parse(readFileSync(path.join(root, 'status.json'), 'utf8'))
            expect(saved.error).toBeNull()
            expect(saved.lastSuccessAt).toBe('previous')
            expect(commands).toHaveLength(0)
            expect(existsSync(path.join(root, 'request.json'))).toBe(true)
        } finally { rmSync(root, { recursive: true, force: true }) }
    })

    test('manual cleanup removes cache without the nightly budget and records success', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docker-storage-'))
        try {
            writeFileSync(path.join(root, 'request.json'), JSON.stringify({ requestedAt: 'manual' }))
            const commands: string[][] = []
            const dockerCalls: string[] = []
            const measurements = [100, 14]
            await perform(true, { stateDir: root, command: async args => { commands.push(args); return '' },
                docker: url => { dockerCalls.push(url); return [] }, snapshot: () => ({ reclaimableCacheBytes: 0 }),
                freeBytes: () => measurements.shift()!, now: () => '2026-09-28T00:00:00Z' })
            expect(commands).toEqual([['builder', 'prune', '--all', '--force']])
            expect(dockerCalls).toContain('/images/json?all=1')
            expect(dockerCalls).toContain('/containers/json?all=1')
            const state = JSON.parse(readFileSync(path.join(root, 'status.json'), 'utf8'))
            expect(state.running).toBe(false)
            expect(state.phase).toBeNull()
            expect(state.lastFreedBytes).toBe(0)
        } finally { rmSync(root, { recursive: true, force: true }) }
    })

    test('nightly cleanup retains cache budget, consumes only its own request, and records failures', async () => {
        const root = mkdtempSync(path.join(tmpdir(), 'docker-storage-'))
        try {
            const requestFile = path.join(root, 'request.json')
            const request = { requestedAt: 'before' }
            writeFileSync(requestFile, JSON.stringify(request))
            const commands: string[][] = []
            await perform(true, { stateDir: root, command: async args => { commands.push(args); writeFileSync(requestFile, JSON.stringify({ requestedAt: 'during' })); return '' },
                docker: () => [], snapshot: () => ({}), freeBytes: () => 100, now: () => 'now' })
            expect(commands[0]).toEqual(['builder', 'prune', '--all', '--force'])
            expect(existsSync(requestFile)).toBe(true)
            await expect(perform(true, { stateDir: root, command: async () => { throw new Error('prune failed') },
                docker: () => [], snapshot: () => ({}), freeBytes: () => 100, now: () => 'later' })).rejects.toThrow('prune failed')
            const state = JSON.parse(readFileSync(path.join(root, 'status.json'), 'utf8'))
            expect(state.running).toBe(false)
            expect(state.errorStage).toBe('cleanup')
        } finally { rmSync(root, { recursive: true, force: true }) }
    })
})
