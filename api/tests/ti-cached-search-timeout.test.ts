import { afterEach, expect, spyOn, test } from 'bun:test'
import { searchThreatIntel } from '../src/utils/ti/search.ts'
const originalBase = process.env.TI_SCRAPER_API_BASE
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
})

test('cached actor search permits a healthy recovery response beyond 350ms', async () => {
    process.env.TI_SCRAPER_API_BASE = 'https://ti.example.test'
    spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({ query: 'APT9876', summary: 'Catalog profile', sources: [], recentActivity: [], status: 'partial' })), 450)
        options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal?.reason) }, { once: true })
    }))
    const response = await searchThreatIntel({ query: 'APT9876', preferCached: true })
    expect(response.mode).toBe('scraper')
    expect(response.status).toBe('partial')
})
