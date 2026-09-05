import { expect, test } from '@playwright/test'

test('thesis is public and read-only, including on mobile', async({ page, request }) => {
    await page.goto('/thesis')
    const thesis = page.getByRole('region', { name: 'Thesis document' })
    await expect(thesis.getByRole('tabpanel', { name: 'Overview' })).toBeVisible()
    await expect(thesis.getByRole('tab')).toHaveCount(4)
    await expect(thesis.locator('.thesis-markdown').first()).not.toBeEmpty()
    await expect(thesis.getByRole('textbox')).toHaveCount(0)
    await expect(thesis.getByRole('button', { name: 'Edit title' })).toHaveCount(0)
    const response = await request.get('/api/thesis')
    expect(response.ok()).toBe(true)
    const saved = await response.json()
    expect(typeof saved.title).toBe('string')
    const denied = await request.put('/api/thesis', {
        headers: { Origin: new URL(page.url()).origin },
        data: saved,
    })
    expect(denied.status()).toBe(403)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(thesis.getByRole('tabpanel', { name: 'Overview' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

