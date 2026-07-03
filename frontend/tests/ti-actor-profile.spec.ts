import { expect, test } from '@playwright/test'

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
        await expect(body).toContainText('Hewlett Packard Enterprise')
        await expect(body).toContainText('Russia-linked SVR/APT29 activity in public government, vendor, and incident reporting')

        const mapBox = await page.getByRole('heading', { name: 'Actor country map' }).boundingBox()
        const activityBox = await page.locator('#ti-activity').boundingBox()
        expect(mapBox?.y ?? 0).toBeLessThan(activityBox?.y ?? Number.POSITIVE_INFINITY)

        const bodyText = await body.innerText()
        expect(bodyText).not.toMatch(/\bblocked\b/i)
        expect(bodyText).not.toMatch(/\baction required\b/i)
        expect(bodyText).not.toMatch(/NATO-aligned states/i)
        expect(bodyText).not.toMatch(/From live source conte(?:nt|xt)/i)
        expect(bodyText).not.toMatch(/What\s+returned/i)
        expect(bodyText).not.toMatch(/\bNorth America\b/)
        expect(bodyText).not.toMatch(/4 mapped/i)

        await testInfo.attach('apt29-country-map', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
        })
    })
})
