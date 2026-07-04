import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test.describe('public threat actor profile', () => {
    test('APT29 renders country-level map and concrete victim context', async ({ page }, testInfo) => {
        await page.goto('/ti/APT29')

        await expect(page.getByRole('heading', { name: 'APT29', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Actor country map' })).toBeVisible()
        await expect(page.getByText('Reported operator origin and victim or target countries from linked sources.')).toBeVisible()

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
        const desktopActionsIndex = source.indexOf('<ActorActionStrip')

        expect(workspaceIndex).toBeGreaterThan(-1)
        expect(mobileWorkbarIndex).toBeGreaterThan(workspaceIndex)
        expect(profileSummaryIndex).toBeGreaterThan(mobileWorkbarIndex)
        expect(desktopActionsIndex).toBeGreaterThan(profileSummaryIndex)
        expect(source).toContain('filteredWorkItems.slice(0, 3)')
        expect(source).toContain('showFullQueue && filteredWorkItems.length > 3')
        expect(source).toContain('lg:hidden')
        expect(source).toContain('renderDesktopActions')
        expect(source).not.toContain('data-ti-hero-map')
        expect(source).not.toContain('data-ti-hero-evidence')
    })
})
