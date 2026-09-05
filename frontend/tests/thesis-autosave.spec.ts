import { expect, test } from '@playwright/test'

test('autosave, idle, WebSocket updates, history restore, closing and draft recovery', async({ browser, baseURL }) => {
    test.skip(process.env.THESIS_TEST_DATABASE !== '1', 'Requires the disposable thesis database and fixture server.')
    test.setTimeout(90000)
    expect(['http://127.0.0.1:3201', 'http://127.0.0.1:3205']).toContain(baseURL)
    const owner = await browser.newContext()
    await owner.addCookies([
        { name: 'id', value: 'eirikhanasand', url: baseURL! },
        { name: 'access_token', value: 'synthetic-owner', url: baseURL! },
    ])
    const reader = await browser.newContext()
    for (const context of [owner, reader]) {
        await context.addInitScript(() => {
            const NativeSocket = window.WebSocket
            window.WebSocket = class extends NativeSocket {
                constructor(url: string | URL, protocols?: string | string[]) {
                    super(String(url).endsWith('/api/ws/thesis') ? 'ws://127.0.0.1:3202/api/ws/thesis' : url, protocols)
                }
            }
        })
    }
    const page = await owner.newPage()
    const publicPage = await reader.newPage()
    const current = async() => {
        const saved = await (await owner.request.get(baseURL + '/api/thesis')).json()
        return { ...saved, body: saved.body.split('\n\n<!-- thesis-sheet:')[0] }
    }
    await page.goto(baseURL + '/content/thesis')
    await page.getByRole('button', { name: 'Edit markdown', exact: true }).click()
    await publicPage.goto(baseURL + '/thesis')
    const body = page.getByRole('textbox', { name: 'Description Markdown' })
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
    await body.fill('First live edit')
    await expect.poll(async() => (await current()).body, { timeout: 9000 }).toBe('First live edit')
    await expect(publicPage.getByText('First live edit', { exact: true })).toBeVisible()
    const first = await current()
    await page.waitForTimeout(5500)
    expect((await current()).revision).toBe(first.revision)
    await body.fill('Second live edit')
    await body.fill('Second live edit, aggregated')
    await expect.poll(async() => (await current()).body, { timeout: 9000 }).toBe('Second live edit, aggregated')
    const history = await (await owner.request.get(baseURL + '/api/thesis/history')).json()
    expect(history).toHaveLength(2)
    await page.getByRole('button', { name: 'History', exact: true }).click()
    const previous = page.getByRole('button', { name: /^Previous version/ })
    const previousRow = page.getByRole('listitem').filter({ has: previous })
    const restore = previousRow.getByRole('button', { name: /^Restore version/ })
    const preview = page.getByRole('region', { name: 'Version preview' })
    await previous.click()
    await expect(previous).toHaveAttribute('aria-expanded', 'true')
    await expect(preview).toContainText('First live edit')
    await previous.click()
    await expect(previous).toHaveAttribute('aria-expanded', 'false')
    await expect(preview).toHaveCount(0)
    await previous.press('Enter')
    await expect(preview).toBeVisible()
    await previous.press('Space')
    await expect(preview).toHaveCount(0)
    await body.focus()
    await page.mouse.move(0, 0)
    await expect(restore).toHaveCSS('opacity', '0')
    await previousRow.hover()
    await expect(restore).toHaveCSS('opacity', '1')
    await page.mouse.move(0, 0)
    await previous.focus()
    await previous.press('Tab')
    await expect(restore).toBeFocused()
    await expect(restore).toHaveCSS('opacity', '1')
    // Restore directly from a collapsed row, through the existing save path.
    await restore.press('Enter')
    await expect.poll(async() => (await current()).body).toBe('First live edit')
    await expect(body).toHaveValue('First live edit')
    await body.fill('Written immediately before leaving')
    await page.goto('about:blank')
    await expect.poll(async() => (await current()).body, { timeout: 7000 }).toBe('Written immediately before leaving')
    await page.goto(baseURL + '/content/thesis')
    await page.getByRole('button', { name: 'Edit markdown', exact: true }).click()
    await expect(body).toHaveValue('Written immediately before leaving')
    // A failed close request must leave a draft that survives reload.
    await page.route('**/api/thesis', route => route.request().method() === 'GET' ? route.continue() : route.abort())
    await body.fill('Recover after interrupted delivery')
    await page.reload()
    await page.getByRole('button', { name: 'Edit markdown', exact: true }).click()
    await expect(body).toHaveValue('Recover after interrupted delivery')
    await page.unroute('**/api/thesis')
    await expect.poll(async() => (await current()).body, { timeout: 9000 }).toBe('Recover after interrupted delivery')
    // A stale tab must preserve its draft instead of overwriting a newer save.
    await body.fill('Local conflicting draft')
    const base = await current()
    const external = await owner.request.put(baseURL + '/api/thesis', {
        headers: { Origin: baseURL! }, data: { ...base, body: 'Newer remote draft' },
    })
    expect(external.ok()).toBe(true)
    await expect(page.getByRole('button', { name: 'Use my draft' })).toBeVisible()
    await expect(body).toHaveValue('Local conflicting draft')
    await page.getByRole('button', { name: 'Use latest version' }).click()
    await expect(body).toHaveValue('Newer remote draft')
    await owner.close()
    await reader.close()
})
