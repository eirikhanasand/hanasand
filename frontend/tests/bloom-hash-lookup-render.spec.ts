import { expect, test } from '@playwright/test'

test('Bloom hash lookup checks exposure without collecting a raw password', async ({ page }) => {
    let count = 23
    await page.route('**/api/pwned', async (route) => {
        const body = route.request().postDataJSON() as { prefix?: string }
        expect(body).toEqual({ prefix: '5BAA6' })

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                schemaVersion: 'bloom_hash.range_proxy.v1',
                prefix: '5BAA6',
                range: `1E4C9B93F3F0682250B6CF8331B7EE68FD8:${count}`,
            }),
        })
    })

    await page.goto('/pwned')

    await expect(page.getByRole('heading', { name: 'Has your password been leaked?' })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.getByText('Paste a SHA-1 hash. We check it against leaked passwords.').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('printf %s \'superman123\' | shasum').filter({ visible: true })).toBeVisible()
    await expect(page.getByText('Bloom prefix boundary')).toHaveCount(0)
    await expect(page.getByText('Exact matches only.', { exact: false })).toHaveCount(0)

    const command = page.getByRole('region', { name: 'Create a hash locally' })
    const formBox = await page.getByRole('button', { name: 'Run Bloom lookup' }).boundingBox()
    const commandBox = await command.boundingBox()
    expect(commandBox!.y).toBeGreaterThan(formBox!.y + formBox!.height)

    await page.getByLabel('SHA-1 hash').filter({ visible: true }).fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Run Bloom lookup' }).click()

    await expect(page.getByText('Exact match found')).toBeVisible()
    await expect(page.getByText('Result', { exact: true })).toBeVisible()
    await expect(page.getByText('Hash matched leaked password.')).toBeVisible()
    await expect(page.getByText('This password has been breached 23 times.')).toBeVisible()
    await expect(page.getByText(/Privacy check:|Next action:|Rotate the underlying secret/)).toHaveCount(0)
    await expect(command).toBeVisible()

    await page.getByRole('button', { name: 'Check another hash' }).click()
    await expect(page.getByLabel('SHA-1 hash').filter({ visible: true })).toHaveValue('')
    count = 0
    await page.getByLabel('SHA-1 hash').filter({ visible: true }).fill('5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8')
    await page.getByRole('button', { name: 'Run Bloom lookup' }).click()
    await expect(page.getByText('No exact match found', { exact: true })).toBeVisible()
    await expect(page.getByText(/This password has been breached|Privacy check:|Next action:/)).toHaveCount(0)
})

test('local hash command is distinct and copyable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async (value: string) => { document.documentElement.dataset.copiedCommand = value } },
        })
    })
    await page.goto('/pwned')

    const command = page.getByRole('region', { name: 'Create a hash locally' })
    await command.getByRole('button', { name: 'Copy code' }).click()
    await expect(command.getByRole('button', { name: 'Copy code' })).toHaveText('Copied')
    await expect(page.locator('html')).toHaveAttribute('data-copied-command', 'printf %s \'superman123\' | shasum')
    const colors = await command.evaluate(element => ({
        panel: getComputedStyle(element).backgroundColor,
        code: getComputedStyle(element.querySelector('pre')!).backgroundColor,
        fits: element.scrollWidth <= element.clientWidth,
    }))
    expect(colors.code).not.toBe(colors.panel)
    expect(colors.fits).toBe(true)
})
