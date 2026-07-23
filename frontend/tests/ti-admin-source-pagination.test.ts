import { strict as assert } from 'node:assert'
import { afterEach, describe, test } from 'node:test'
import { getTiAdminOverview, getTiAdminSource } from '../src/utils/tiAdmin/ops'

const originalFetch = globalThis.fetch
const originalBase = process.env.HANASAND_TI_SCRAPER_LOCAL_BASE

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.HANASAND_TI_SCRAPER_LOCAL_BASE
    else process.env.HANASAND_TI_SCRAPER_LOCAL_BASE = originalBase
})

describe('TI admin bounded source operations', () => {
    test('fetches a source beyond page one directly and trusts retained aggregates over an empty capture sample', async () => {
        process.env.HANASAND_TI_SCRAPER_LOCAL_BASE = 'https://scraper.example.test'
        const requested: URL[] = []
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            requested.push(url)
            if (url.pathname.endsWith('/source-operations')) {
                return Response.json({
                    total: 1,
                    summary: { activeSourceCount: 1 },
                    qualification: { counts: { total: 0, clearWeb: 0, lawfulDarkWeb: 0, publicTelegram: 0 } },
                    sources: [{
                        id: 'src_06100',
                        name: 'Beyond page one',
                        type: 'rss',
                        lifecycleStatus: 'active',
                        collection: { cadenceSeconds: 3600, createdAt: '2026-07-01T00:00:00Z' },
                        operatingMode: { accessMethod: 'public_http', legalMode: 'public_content', approvalState: 'approved', risk: 'low' },
                        health: { state: 'healthy', lastAttemptAt: '2026-07-23T10:00:00Z' },
                        coverage: { captureCount: 9, observedDomains: ['security.example'], resultTypes: ['advisory'] },
                        qualification: { qualifies: false, reasons: ['insufficient_productive_cycles'] }
                    }]
                })
            }
            if (url.pathname.endsWith('/captures')) return Response.json({ captures: [], total: 0 })
            return Response.json({ collectionRuns: [], total: 0 })
        }) as typeof fetch

        const source = await getTiAdminSource('src_06100')

        assert.equal(source?.id, 'src_06100')
        assert.equal(source?.retainedEvidenceCount, 9)
        assert.deepEqual(source?.domains, ['security.example'])
        assert.deepEqual(source?.resultTypes, ['advisory'])
        assert.equal(requested.find(url => url.pathname.endsWith('/source-operations'))?.searchParams.get('sourceId'), 'src_06100')
        assert.equal(requested.find(url => url.pathname.endsWith('/captures'))?.searchParams.get('q'), 'src_06100')
    })

    test('can render an authoritative source page without loading capture or run samples', async () => {
        process.env.HANASAND_TI_SCRAPER_LOCAL_BASE = 'https://scraper.example.test'
        const requested: string[] = []
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            requested.push(url.pathname)
            return Response.json({
                total: 0,
                summary: { activeSourceCount: 0 },
                qualification: { counts: { total: 0, clearWeb: 0, lawfulDarkWeb: 0, publicTelegram: 0 } },
                sources: []
            })
        }) as typeof fetch

        await getTiAdminOverview('default', { includeSamples: false })

        assert.deepEqual(requested, ['/v1/intel/source-operations'])
    })
})
