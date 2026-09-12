import { test, expect } from '@playwright/test'

test('console bounds scrollback, follows output and preserves its connection in fullscreen', async ({ page }) => {
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: 'http://127.0.0.1:3272' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: 'http://127.0.0.1:3272' },
        { name: 'roles', value: JSON.stringify([{ id: 'administrator' }]), url: 'http://127.0.0.1:3272' },
    ])
    await page.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    let send: (data: string) => void = () => {}
    let connections = 0
    await page.routeWebSocket('**/vm/cashflow/console', socket => {
        connections++
        send = data => socket.send(JSON.stringify({ type: 'output', data }))
        socket.onMessage(message => {
            if (JSON.parse(String(message)).type === 'auth') socket.send(JSON.stringify({ type: 'ready', username: 'fixture' }))
        })
    })
    await page.goto('/vms/cashflow/console')
    await expect(page.getByRole('status')).toContainText('Connected')
    const viewport = page.locator('.xterm-screen')
    const rows = page.locator('.xterm-rows')
    const terminal = page.getByLabel('cashflow terminal')
    await expect(terminal).toBeVisible()
    const originalHeight = await terminal.evaluate(el => el.getBoundingClientRect().height)
    for (let batch = 0; batch < 8; batch++) send(Array.from({ length: 100 }, (_, i) => `line ${batch * 100 + i}\r\n`).join(''))
    await expect(rows).toContainText('line 799')
    await expect.poll(() => terminal.evaluate(el => el.getBoundingClientRect().height)).toBe(originalHeight)
    await viewport.hover()
    await page.mouse.wheel(0, -600)
    await expect(rows).not.toContainText('line 799')
    const previous = await rows.innerText()
    send('new output while reading history\r\n')
    await expect.poll(() => rows.innerText()).toBe(previous)
    await page.mouse.wheel(0, 100000)
    await page.mouse.wheel(0, 100000)
    await expect(rows).toContainText('new output while reading history')
    send('latest line\r\n')
    await expect(rows).toContainText('latest line')
    await page.getByRole('button', { name: 'Enter fullscreen' }).click()
    await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
    await page.getByRole('button', { name: 'Exit fullscreen' }).click()
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
    await expect.poll(() => terminal.evaluate(el => el.getBoundingClientRect().height)).toBe(originalHeight)
    expect(connections).toBe(1)
})
