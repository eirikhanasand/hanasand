import { expect, test } from 'bun:test'
import { classifyTiQuery } from '#utils/ti/search.ts'

test('classifies public TI searches before selecting an enrichment path', () => {
    expect(classifyTiQuery('APT29')).toBe('actor')
    expect(classifyTiQuery('microsoft.com')).toBe('domain')
    expect(classifyTiQuery('CVE-2024-3094')).toBe('cve')
    expect(classifyTiQuery('203.0.113.10')).toBe('indicator')
})
