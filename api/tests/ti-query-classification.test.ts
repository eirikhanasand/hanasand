import { expect, test } from 'bun:test'
import { classifyTiQuery, searchThreatIntel } from '#utils/ti/search.ts'

test('classifies public TI searches before selecting an enrichment path', () => {
    expect(classifyTiQuery('APT29')).toBe('actor')
    expect(classifyTiQuery('microsoft.com')).toBe('domain')
    expect(classifyTiQuery('CVE-2024-3094')).toBe('cve')
    expect(classifyTiQuery('203.0.113.10')).toBe('indicator')
})

test('keeps unavailable capabilities out of no-evidence results', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    delete process.env.TI_SCRAPER_API_BASE
    try {
        const result = await searchThreatIntel({ query: 'no-evidence-987654.example' })
        expect(result.datasets).toEqual([])
        expect(result).not.toHaveProperty('collectionStrategy')
        expect(result.actionability?.watchlistCandidates).toEqual([{
            kind: 'domain',
            value: 'no-evidence-987654.example',
            reason: 'Exact domain supplied by the user; organization watchlists support domain terms.',
            confidence: 1,
        }])
    } finally {
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('does not synthesize an actor profile when canonical evidence is unavailable', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    delete process.env.TI_SCRAPER_API_BASE
    try {
        const result = await searchThreatIntel({ query: 'APT29' })
        expect(result.status).toBe('searching')
        expect(result.summary).toBe('Searching')
        expect(result.confidence).toBe(0)
        expect(result.operationalStatus).toBeUndefined()
        expect(result.analystLoop).toBeUndefined()
        expect(result.aliases).toEqual([])
        expect(result.recentActivity).toEqual([])
        expect(result.targets).toEqual([])
        expect(result.ttps).toEqual([])
        expect(result.datasets).toEqual([])
        expect(result.sources).toEqual([])
        expect(result.actorIntelligence).toBeUndefined()
    } finally {
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('accepts the scraper canonicalizing actor query casing', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    globalThis.fetch = async () => new Response(JSON.stringify({
        query: 'APT7654321',
        generatedAt: '2026-07-21T08:00:00.000Z',
        mode: 'scraper',
        status: 'partial',
        summary: 'One captured record matches APT7654321.',
        confidence: 0.7,
        lastSeen: '2026-07-21T07:00:00.000Z',
        aliases: [],
        recentActivity: [{ date: '2026-07-21T07:00:00.000Z', title: 'Captured record', detail: 'Observed source text.', confidence: 0.7, sourceIds: ['source_test'] }],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [{ id: 'source_test', name: 'Test source', type: 'public_http', provenance: 'https://example.test/report' }],
        notes: [],
    }), { headers: { 'content-type': 'application/json' } })

    try {
        const result = await searchThreatIntel({ query: 'apt7654321' })
        expect(result.query).toBe('APT7654321')
        expect(result.status).toBe('partial')
        expect(result.recentActivity).toHaveLength(1)
        expect(result.sources).toHaveLength(1)
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})

test('preserves database-backed actor classification for named aliases', async () => {
    const previousScraperBase = process.env.TI_SCRAPER_API_BASE
    const originalFetch = globalThis.fetch
    let requestedUrl = ''
    process.env.TI_SCRAPER_API_BASE = 'http://scraper.test'
    globalThis.fetch = async (input) => {
        requestedUrl = String(input)
        return new Response(JSON.stringify({
            query: 'LockBit',
            queryKind: 'actor',
            generatedAt: '2026-07-21T08:00:00.000Z',
            mode: 'scraper',
            status: 'partial',
            summary: 'One captured record matches LockBit.',
            confidence: 0.7,
            lastSeen: '2026-05-08T07:00:00.000Z',
            aliases: ['LockBit', 'LockBit 3.0'],
            recentActivity: [{ date: '2026-05-08T07:00:00.000Z', title: 'LockBit report', detail: 'Observed source text.', confidence: 0.7, sourceIds: ['source_test'] }],
            targets: [],
            ttps: [],
            datasets: [],
            sources: [{ id: 'source_test', name: 'Test source', type: 'public_http', provenance: 'https://example.test/report' }],
            notes: [],
        }), { headers: { 'content-type': 'application/json' } })
    }

    try {
        const result = await searchThreatIntel({ query: 'LockBit' })
        const cachedResult = await searchThreatIntel({ query: 'lockbit' })
        const requested = new URL(requestedUrl)
        expect(requested.searchParams.has('entityType')).toBe(false)
        expect(result.queryKind).toBe('actor')
        expect(cachedResult.queryKind).toBe('actor')
        expect(result.recentActivity.map((item) => item.title)).toEqual(['LockBit report'])
    } finally {
        globalThis.fetch = originalFetch
        if (previousScraperBase === undefined) delete process.env.TI_SCRAPER_API_BASE
        else process.env.TI_SCRAPER_API_BASE = previousScraperBase
    }
})
