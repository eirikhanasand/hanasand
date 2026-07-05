import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test.describe('public threat actor profile', () => {
    test('APT29 renders country-level map and concrete victim context', async ({ page }, testInfo) => {
        await page.goto('/ti/apt29')

        await expect(page.getByRole('heading', { name: 'APT29', exact: true })).toBeVisible()
        await expect(page.locator('[data-ti-actor-workspace-rail="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-geo-subordinate="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-geo-subordinate="true"]')).toContainText('Geography')
        await expect(page.locator('[data-ti-geo-subordinate="true"]')).toContainText('Open map')
        await expect(page.locator('[data-ti-actor-evidence-spotlight="true"]')).toBeVisible()
        await expect(page.locator('[data-ti-actor-evidence-spotlight="true"]')).toContainText('Watch')
        await expect(page.locator('[data-ti-actor-evidence-spotlight="true"]')).toContainText('Open case')
        await expect(page.locator('[data-ti-actor-evidence-spotlight="true"]')).toContainText('Open details')

        const body = page.locator('body')
        await expect(body).toContainText('Russia')
        await expect(body).toContainText('United States')
        await expect(body).toContainText('United Kingdom')
        await expect(body).toContainText('Germany')
        await expect(body).toContainText('Democratic National Committee')
        await expect(body).toContainText('SolarWinds Orion customers and U.S. federal agencies')
        await expect(body).toContainText('Microsoft corporate email accounts')
        await expect(body).toContainText('Government and policy organizations')
        await expect(body).toContainText('Public reporting attributes APT29 to Russia-linked SVR activity.')
        await expect(body).toContainText('Latest activity')
        await expect(body).toContainText('Sources used')

        const geoBox = await page.locator('[data-ti-geo-subordinate="true"]').boundingBox()
        const activityBox = await page.locator('#ti-activity').boundingBox()
        const spotlightBox = await page.locator('[data-ti-actor-evidence-spotlight="true"]').boundingBox()
        expect(geoBox?.y ?? 0).toBeLessThan(activityBox?.y ?? Number.POSITIVE_INFINITY)
        expect(spotlightBox?.y ?? 0).toBeLessThan(activityBox?.y ?? Number.POSITIVE_INFINITY)

        const bodyText = await body.innerText()
        expect(bodyText).not.toMatch(/\bblocked\b/i)
        expect(bodyText).not.toMatch(/\baction required\b/i)
        expect(bodyText).not.toMatch(/NATO-aligned states/i)
        expect(bodyText).not.toMatch(/From live source conte(?:nt|xt)/i)
        expect(bodyText).not.toMatch(/What\s+returned/i)
        expect(bodyText).not.toMatch(/Actor workbenches/i)
        expect(bodyText).not.toMatch(/Source basis/i)
        expect(bodyText).not.toMatch(/Collection gaps/i)
        expect(bodyText).not.toMatch(/\bNorth America\b/)
        expect(bodyText).not.toMatch(/4 mapped/i)

        await testInfo.attach('apt29-country-map', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
        })
    })

    test('keeps the mobile workbar and queue disclosure compact', async () => {
        const source = await readFile(path.join(root, 'src/app/ti/pageClient.tsx'), 'utf8')
        const workspaceIndex = source.indexOf('data-ti-workspace=\'true\'')
        const mobileWorkbarIndex = source.indexOf('renderMobileWorkbar && mobileEvidenceWorkbar')
        const profileSummaryIndex = source.indexOf('<div className=\'grid gap-4 border-b border-ui-border bg-ui-panel p-4')
        const desktopActionsIndex = source.indexOf('<SelectedEvidenceRail')

        expect(workspaceIndex).toBeGreaterThan(-1)
        expect(mobileWorkbarIndex).toBeGreaterThan(workspaceIndex)
        expect(profileSummaryIndex).toBeGreaterThan(mobileWorkbarIndex)
        expect(desktopActionsIndex).toBeGreaterThan(profileSummaryIndex)
        expect(source).toContain('const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 3')
        expect(source).toContain('const TI_ENRICHMENT_GAP_PREVIEW_ROWS = 2')
        expect(source).toContain('const TI_SOURCE_REFERENCE_ROWS = 2')
        expect(source).toContain('const TI_DOSSIER_SOURCE_FAMILY_ROWS = 3')
        expect(source).toContain('filteredWorkItems.slice(0, TI_EVIDENCE_QUEUE_PREVIEW_ROWS)')
        expect(source).toContain('filteredWorkItems.length > visibleQueueItems.length')
        expect(source).toContain('showFullQueue && filteredWorkItems.length > TI_EVIDENCE_QUEUE_PREVIEW_ROWS')
        expect(source).toContain('lg:hidden')
        expect(source).toContain('<SelectedEvidenceRail')
        expect(source).not.toContain('data-ti-hero-map')
        expect(source).not.toContain('data-ti-hero-evidence')
        expect(source).toContain('data-ti-actor-workspace-rail')
        expect(source).toContain('data-ti-selected-action-rail')
        expect(source).toContain('data-ti-geo-subordinate')
        expect(source).toContain('data-ti-actor-evidence-spotlight')
        expect(source).toContain('>Open case</StripActionButton>')
        expect(source).toContain('actorIntel.geographies.join(\', \')')
        expect(source).not.toContain('actorIntel.geographies.slice(0, 3).join')
        expect(source).toContain('{sourceBasisLabel(source.confidence)}</span>')
        expect(source).not.toContain('{Math.round(source.confidence * 100)}%</span>')
        expect(source).toContain('No intelligence is available for that search yet.')
        expect(source).toContain('summary: \'Checking sources\'')
        expect(source).not.toContain('The TI service did not return results.')
        expect(source).not.toContain('summary: \'Searching\'')
    })
})
