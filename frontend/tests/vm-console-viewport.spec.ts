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


test('restart progress keeps existing output and reconnects after a transport interruption', async ({ page }) => {
    await page.context().addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: 'http://127.0.0.1:3272' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: 'http://127.0.0.1:3272' },
    ])
    await page.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    let connection: import('@playwright/test').WebSocketRoute | undefined
    let connections = 0
    await page.routeWebSocket('**/vm/cashflow/console', socket => {
        connection = socket
        connections++
        socket.onMessage(message => {
            if (JSON.parse(String(message)).type === 'auth') socket.send(JSON.stringify({ type: 'ready', username: 'fixture' }))
        })
    })
    await page.goto('/vms/cashflow/console')
    await expect(page.getByRole('status')).toContainText('Connected')
    const send = (message: object) => connection?.send(JSON.stringify(message))
    send({ type: 'output', data: 'output before reboot\r\n' })
    send({ type: 'status', message: 'VM is restarting…' })
    send({ type: 'boot-output', data: 'Restarting system\nStarting services\n' })
    await expect(page.getByRole('status')).toContainText('restarting')
    await expect(page.getByLabel('VM restart log')).toContainText('Starting services')
    await expect(page.locator('.xterm-rows')).toContainText('output before reboot')
    send({ type: 'ready', username: 'fixture' })
    send({ type: 'output', data: 'new shell ready\r\n' })
    await expect(page.getByRole('status')).toContainText('Connected')
    await expect(page.locator('.xterm-rows')).toContainText('new shell ready')
    expect(connections).toBe(1)
    connection?.close({ code: 1012, reason: 'Server restart' })
    await expect.poll(() => connections).toBe(2)
    await expect(page.getByRole('status')).toContainText('Connected')
    await expect(page.locator('.xterm-rows')).toContainText('output before reboot')
    await expect(page.getByLabel('VM restart log')).toContainText('Starting services')
    send({ type: 'error', message: 'Your console access has ended.' })
    connection?.close({ code: 1008 })
    await expect(page.getByRole('status')).toContainText('access has ended')
    await page.waitForTimeout(2200)
    expect(connections).toBe(2)
})

for (const support of ['missing', 'rejected'] as const) {
    test(`mobile fullscreen fills the viewport when native fullscreen is ${support}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.context().addCookies([
            { name: 'id', value: 'dashboard-render-proof-user', url: 'http://127.0.0.1:3272' },
            { name: 'access_token', value: 'local-dashboard-render-proof-token', url: 'http://127.0.0.1:3272' },
        ])
        await page.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
        await page.addInitScript(mode => {
            Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: mode === 'missing' ? undefined : () => Promise.reject(new Error('Not supported')) })
        }, support)
        let connections = 0
        const sizes: number[] = []
        await page.routeWebSocket('**/vm/cashflow/console', socket => {
            connections++
            socket.onMessage(data => {
                const message = JSON.parse(String(data))
                if (message.type === 'auth') socket.send(JSON.stringify({ type: 'ready', username: 'fixture' }))
                if (message.type === 'resize') sizes.push(message.rows)
            })
        })
        await page.goto('/vms/cashflow/console')
        await expect(page.getByRole('status')).toContainText('Connected')
        const terminal = page.getByLabel('cashflow terminal')
        const original = await terminal.evaluate(el => el.getBoundingClientRect().height)
        await page.getByRole('button', { name: 'Enter fullscreen' }).click()
        const expanded = page.locator('section[data-expanded]')
        await expect(expanded).toBeVisible()
        await expect.poll(() => expanded.evaluate(el => el.contains(document.elementFromPoint(30, 30)))).toBe(true)
        await expect.poll(() => expanded.evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(844)
        await expect(page.getByRole('status')).toContainText('Connected')
        await expect.poll(() => terminal.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(original)
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
        const rowsBeforeKeyboard = sizes.at(-1)!
        await page.evaluate(() => {
            Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 430 })
            window.visualViewport!.dispatchEvent(new Event('resize'))
        })
        await expect.poll(() => expanded.evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(430)
        await expect.poll(() => sizes.at(-1)!).toBeLessThan(rowsBeforeKeyboard)
        await page.getByRole('button', { name: 'Exit fullscreen' }).click()
        await expect(expanded).toHaveCount(0)
        await expect.poll(() => page.locator('[data-route-frame]').evaluate(el => (el as HTMLElement).style.zIndex)).toBe('')
        await expect.poll(() => terminal.evaluate(el => el.getBoundingClientRect().height)).toBe(original)
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
        await page.getByRole('button', { name: 'Enter fullscreen' }).click()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
        expect(connections).toBe(1)
    })
}
