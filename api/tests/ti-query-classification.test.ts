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
