import { expect, test } from '@playwright/test'

test('workspace fills the screen and retries creation without losing the draft', async ({ page }) => {
    let attempts = 0
    let saved = ''
    await page.route('**/api/share', async route => {
        const body = route.request().postDataJSON()
        attempts++
        if (attempts === 1) return route.fulfill({ status: 502, body: 'Unavailable' })
        saved = body.content
        await route.fulfill({ json: { ...body, alias: body.id, owner: 'anonymous', timestamp: new Date().toISOString(), tree: [] } })
    })
    await page.routeWebSocket('**/api/ws/share/*', socket => {
        socket.onMessage(message => {
            const data = JSON.parse(String(message))
            if (data.type === 'edit') {
                saved = data.content
                socket.send(JSON.stringify({ type: 'ack', content: saved }))
            }
        })
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/s/editor-recovery-test?new=1')
    await expect(page.getByText('Unable to save this workspace yet.', { exact: false })).toBeVisible()
    const editor = page.getByRole('textbox', { name: 'Workspace editor' })
    await editor.fill('const draft = "keep this text";')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect.poll(() => saved).toContain('keep this text')
    await expect(editor).toHaveValue('const draft = "keep this text";')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await editor.fill('const edited = 42;')
    await expect.poll(() => saved).toBe('const edited = 42;')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        const bounds = await page.getByRole('main', { name: 'Code editor' }).boundingBox()
        expect(bounds!.height).toBeGreaterThan(750)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1000)
        expect(await page.getByRole('main', { name: 'Code editor' }).evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    }
})
