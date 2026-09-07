import { expect, test } from '@playwright/test'

const candidate = {
    catalogId: 'mitre-attack-enterprise', externalId: 'G0016', canonicalName: 'APT29',
    description: 'APT29 is a Russia-linked espionage group.(Citation: Example Research 2026)\n\nDetailed SolarWinds campaign history remains available.',
    associatedNames: ['Cozy Bear'], matchKinds: ['canonical'], status: 'current', aptNumberDesignationPresent: true,
    sourceUrl: 'https://attack.mitre.org/groups/G0016/', referenceSources: [{ name: 'Example Research 2026', url: 'https://example.com/research' }],
    createdAt: '2014-11-17T00:00:00.000Z', modifiedAt: '2026-08-05T00:00:00.000Z', catalogVersion: '19.2', catalogModifiedAt: '2026-08-05T00:00:00.000Z',
}
const result = (ready: boolean) => ({
    query: 'apt29', queryKind: 'actor', generatedAt: '2026-09-07T10:00:00.000Z', mode: 'scraper', cacheStatus: 'miss', status: ready ? 'ready' : 'partial', refreshAfterSeconds: 3,
    summary: 'Short generated overview.', confidence: 0.9, lastSeen: '2026-06-18T00:00:00.000Z', aliases: ['Cozy Bear'],
    recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
    actorIdentity: { catalogMatched: true, ambiguous: false, activityEvidenceAvailable: ready, candidates: [candidate] },
    actorIntelligence: ready ? { actorClass: 'observed_threat_actor', attribution: 'Short generated overview.', motivation: [], sourceProvenance: [] } : undefined,
})

test('catalog description, references and dates survive the live activity refresh and reload', async ({ page }) => {
    await page.route('**/api/ti/search?**', route => route.fulfill({ json: result(new URL(route.request().url()).searchParams.get('cached') !== 'true') }))
    await page.goto('/ti/apt29')
    const profile = page.locator('[data-ti-actor-info="true"]')
    await expect(page.locator('[data-ti-catalog-only="true"]')).toBeVisible()
    await expect(profile).toContainText('Detailed SolarWinds campaign history remains available.')
    await expect(profile).toContainText('Created 2014-11-17')
    await expect(profile).toContainText('Updated 2026-08-05')
    await expect(page.locator('[data-ti-catalog-only="true"]')).toHaveCount(0, { timeout: 12000 })
    await expect(profile).toContainText('Detailed SolarWinds campaign history remains available.')
    await expect(profile.locator('a[href="#ti-reference-1"]')).toBeVisible()
    await expect(page.locator('#ti-reference-1')).toContainText('Example Research 2026')
    await expect(page.locator('#ti-reference-1 a[href="https://example.com/research"]')).toHaveCount(1)
    await page.reload()
    await expect(profile).toContainText('Detailed SolarWinds campaign history remains available.')
    await expect(profile).toContainText('Created 2014-11-17')
    await expect(profile).not.toContainText('Date unavailable')
})
