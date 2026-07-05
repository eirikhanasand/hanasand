import { expect, test } from '@playwright/test'

test('Bloom hash lookup checks exposure without collecting a raw password', async ({ page }) => {
    await page.route('**/api/pwned', async (route) => {
        const body = route.request().postDataJSON() as { prefix?: string }
        expect(body).toEqual({ prefix: '5BAA6' })

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                schemaVersion: 'bloom_hash.range_proxy.v1',
                prefix: '5BAA6',
                range: '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3303003',
            }),
        })
    })

    await page.goto('/pwned')

    await expect(page.getByRole('heading', { name: /Bloom-index checks from a SHA-1 hash/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.getByText('This lookup does not ask for, derive, or transmit the underlying secret.')).toBeVisible()

    await page.getByLabel('SHA-1 hash').fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Run Bloom lookup' }).click()

    await expect(page.getByText('Exact match found')).toBeVisible()
    await expect(page.getByText('This hash appears 3,303,003 times in the Bloom exposure index.')).toBeVisible()
    await expect(page.getByText(/The full hash and underlying secret were not sent to Hanasand/i)).toBeVisible()
})
