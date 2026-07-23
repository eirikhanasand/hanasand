import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getTiAdminOverview } from '../src/utils/tiAdmin/ops'

test.describe.configure({ mode: 'serial' })

test('builds the operations view from canonical live resources', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async input => {
        const pathname = new URL(String(input)).pathname
        const payload = pathname.endsWith('/captures')
            ? { captures: [{ id: 'cap_live', sourceId: 'src_live', collectedAt: '2026-07-20T09:05:00.000Z', publishedAt: '2026-07-20T08:55:00.000Z', contentHash: 'hash-live', mediaType: 'text/html', storageKind: 'inline_text', url: 'https://reports.example/acme', metadata: { actor: 'Actor Live', domain: 'acme.example', title: 'Live report', parserVersion: 'parser-live-v1' } }] }
            : pathname.endsWith('/collection-runs')
                ? { collectionRuns: [{ id: 'run_live', sourceId: 'src_live', status: 'completed', startedAt: '2026-07-20T09:00:00.000Z', finishedAt: '2026-07-20T09:06:00.000Z', captureCount: 1, rowCount: 1 }] }
                : {
                    total: 1,
                    summary: { activeSourceCount: 1 },
                    qualification: { counts: { total: 0, clearWeb: 0, lawfulDarkWeb: 0, publicTelegram: 0 } },
                    sources: [{ id: 'src_live', name: 'Live source', type: 'rss', status: 'active', family: 'rss', operatingMode: { accessMethod: 'public_http', risk: 'low', legalMode: 'public_content', approvalState: 'approved' }, collection: { cadenceSeconds: 1800, createdAt: '2026-07-20T08:00:00.000Z' }, health: { lastAttemptAt: '2026-07-20T09:06:00.000Z' }, coverage: { captureCount: 1 } }],
                }
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    try {
        const overview = await getTiAdminOverview()
        expect(overview.availability.state).toBe('live')
        expect(overview.sources).toHaveLength(1)
        expect(overview.captures[0]).toMatchObject({ id: 'cap_live', sourceId: 'src_live', actor: 'Actor Live', domain: 'acme.example' })
        expect(overview.runs[0]).toMatchObject({ id: 'run_live', sourceId: 'src_live', captures: 1 })
        expect(overview.domains[0]).toMatchObject({ domain: 'acme.example', sourceIds: ['src_live'], resultCount: 1 })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('returns an honest degraded empty state when canonical resources fail', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => { throw new Error('offline') }
    try {
        const overview = await getTiAdminOverview()
        expect(overview.availability.state).toBe('degraded')
        expect(overview.availability.failedResources).toHaveLength(3)
        expect(overview.sources).toEqual([])
        expect(overview.captures).toEqual([])
        expect(overview.runs).toEqual([])
        expect(overview.domains).toEqual([])
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('contains no projected intelligence or ephemeral case promotion path', async () => {
    const root = process.cwd()
    const operations = await readFile(path.join(root, 'src/utils/tiAdmin/ops.ts'), 'utf8')
    const workbench = await readFile(path.join(root, 'src/app/dashboard/ti/workbench/page.tsx'), 'utf8')

    expect(operations).toContain('fetchResource(base, \'/v1/intel/captures\'')
    expect(operations).toContain('fetchResource(base, \'/v1/intel/collection-runs\'')
    expect(operations).not.toContain('fetchResource(base, \'/v1/intel/sources\'')
    expect(operations).not.toContain('new Date(0)')
    expect(operations).not.toContain('direct_actor_pages')
    expect(operations).not.toContain('projectSource')
    expect(operations).not.toContain('projectRun')
    expect(workbench).not.toContain('domainToCase')
    expect(workbench).not.toContain('captureToCase')
})
