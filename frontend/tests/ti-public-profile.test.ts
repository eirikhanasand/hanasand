import { expect, test } from 'bun:test'
import { sanitizeTiResultForPublicPage } from '../src/app/ti/publicResult'
import type { TiSearchResponse } from '../src/utils/ti/search'

test('public page projection keeps sourced catalog description, references and dates', () => {
    const candidate = { canonicalName: 'APT29', associatedNames: [], description: 'Catalog history.(Citation: Research 2026)', referenceSources: [{ name: 'Research 2026', url: 'https://example.com/report' }], createdAt: '2014-11-17', modifiedAt: '2026-08-05' }
    const result = { recentActivity: [], sources: [], actorIdentity: { candidates: [candidate] } } as unknown as TiSearchResponse
    expect(sanitizeTiResultForPublicPage(result)?.actorIdentity?.candidates[0]).toMatchObject(candidate)
})
