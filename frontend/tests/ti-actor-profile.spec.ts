import { expect, test } from '@playwright/test'

test.describe('public threat actor profile', () => {
    test('APT29 renders country-level map and concrete victim context', async ({ page }, testInfo) => {
        await page.goto('/ti/APT29')

        await expect(page.getByRole('heading', { name: 'APT29', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Country-Level Actor Map' })).toBeVisible()
        await expect(page.getByText('Reported operator origin', { exact: true })).toBeVisible()
        await expect(page.getByText('Reported victim or target country', { exact: true })).toBeVisible()

        const body = page.locator('body')
        await expect(body).toContainText('Russia')
        await expect(body).toContainText('United States')
        await expect(body).toContainText('United Kingdom')
        await expect(body).toContainText('Germany')
        await expect(body).toContainText('Democratic National Committee')
        await expect(body).toContainText('SolarWinds Orion customers and U.S. federal agencies')
        await expect(body).toContainText('Microsoft corporate email accounts')
        await expect(body).toContainText('Hewlett Packard Enterprise')

        const bodyText = await body.innerText()
        expect(bodyText).not.toMatch(/\bREADY\b|\bReady\b/)
        expect(bodyText).not.toMatch(/NATO-aligned states/i)
        expect(bodyText).not.toMatch(/From live source conte(?:nt|xt)/i)
        expect(bodyText).not.toMatch(/\bNorth America\b/)
        expect(bodyText).not.toMatch(/4 mapped/i)

        await testInfo.attach('apt29-country-map', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
        })
    })
})
