import { expect, test } from '@playwright/test'

const table = '| Task | Hours | Notes |\n| --- | --- | --- |\n| First | 1 | One |\n| Second | 2 | Two |\n'
const sheets = [
    { id: 'timetable', name: 'Timetable', title: '# Timetable', body: table },
    { id: 'plan', name: 'Plan', title: '# Plan', body: table },
]
const initialBody = '<!-- thesis-workspace:2 ' + encodeURIComponent(JSON.stringify(sheets.map(({ body, ...sheet }) => ({ ...sheet, length: body.length })))) + ' -->\n' + sheets.map(sheet => sheet.body).join('\n\n')

test.beforeEach(async({ page, context, baseURL }) => {
    test.skip(process.env.THESIS_WORKSPACE_TEST !== '1', 'Requires the disposable thesis API.')
    test.setTimeout(60000)
    expect(baseURL).toBe('http://127.0.0.1:3205')
    await context.addCookies([{ name: 'id', value: 'eirikhanasand', url: baseURL! }, { name: 'access_token', value: 'synthetic-owner', url: baseURL! }])
    await context.addInitScript(() => {
        const NativeSocket = window.WebSocket
        window.WebSocket = class extends NativeSocket {
            constructor(url: string | URL, protocols?: string | string[]) { super(String(url).endsWith('/api/ws/thesis') ? 'ws://127.0.0.1:3202/api/ws/thesis' : url, protocols) }
        }
    })
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    expect((await context.request.put(baseURL + '/api/thesis', { headers: { Origin: baseURL! }, data: { ...current, title: '# Timetable', body: initialBody } })).ok()).toBe(true)
    await page.goto('/thesis')
    await expect(page.getByRole('button', { name: 'Insert table', exact: true })).toBeVisible()
})

test('help is expandable and table actions follow the selected cell', async({ page }) => {
    const tools = page.getByRole('group', { name: 'Active table controls' })
    await expect(tools).toHaveCount(0)
    await expect(page.getByText('Write here…', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Click a cell to edit\. Enter adds a line/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Table help', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Working with tables' })).toBeVisible()
    await page.getByRole('button', { name: 'Table help', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Working with tables' })).toHaveCount(0)
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.click()
    await expect(tools).toContainText('Table 1 · B2')
    await expect(tools.getByRole('button', { name: 'Remove column B', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cell above', exact: true })).toBeHidden()
    await b2.press('ArrowDown')
    await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('textbox', { name: 'Cell A3', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
    await tools.getByRole('button', { name: 'Add column after B', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell C3', exact: true })).toBeFocused()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveValue('Two')
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Cell D3', exact: true })).toHaveValue('Two')
    await page.getByRole('heading', { name: 'Timetable', exact: true }).click()
    await expect(tools).toHaveCount(0)
    await page.getByRole('button', { name: 'History', exact: true }).click()
    const history = page.getByRole('region', { name: 'Version history' })
    await expect(history.getByRole('heading', { name: 'Previous version', exact: true })).toBeVisible()
    await expect(page.getByText(/A checkpoint is saved/)).toHaveCount(0)
    await history.getByRole('button', { name: 'About version history' }).click()
    await expect(history.getByText(/A checkpoint is saved every 20 minutes/)).toBeVisible()
    await history.getByRole('button', { name: 'About version history' }).click()
    await expect(page.getByText(/A checkpoint is saved/)).toHaveCount(0)
})

test('undo survives a pending save, redo saves again, and a new edit clears redo', async({ page, context, baseURL }) => {
    const initial = await (await context.request.get(baseURL + '/api/thesis')).json()
    let release!: () => void, started!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const requestStarted = new Promise<void>(resolve => { started = resolve })
    let held = false
    await page.route('**/api/thesis', async route => {
        if (route.request().method() === 'PUT' && !held) { held = true; started(); await gate }
        await route.continue()
    })
    try {
        const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
        await b2.fill('10')
        await requestStarted
        await b2.press('ControlOrMeta+z')
        await expect(b2).toHaveValue('1')
        expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('hanasand-thesis-recovery:')).map(key => JSON.parse(localStorage.getItem(key)!).body))).toContain(initial.body)
        release()
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).revision, { timeout: 18000 }).toBeGreaterThanOrEqual(initial.revision + 2)
        await expect(b2).toHaveValue('1')
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled()
        await b2.press('ControlOrMeta+Shift+z')
        await expect(b2).toHaveValue('10')
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 12000 }).toContain('| First | 10 |')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await b2.fill('7')
        await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
        await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 12000 }).toContain('| First | 7 |')
        await page.reload()
        await expect(b2).toHaveValue('7')
    } finally { release() }
})

test('remote conflicts disable undo until resolved and reset obsolete edit history', async({ page, context, baseURL }) => {
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.fill('10')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    expect((await context.request.put(baseURL + '/api/thesis', { headers: { Origin: baseURL! }, data: { ...current, body: current.body.replace('| First | 1 |', '| First | 9 |') } })).ok()).toBe(true)
    await expect(page.getByRole('button', { name: 'Use latest version' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Use latest version' }).click()
    await expect(b2).toHaveValue('9')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
})

test('active toolbar fits phones and tablets, supports multiline cells, and hides on blur', async({ page }) => {
    const b2 = page.getByRole('textbox', { name: 'Cell B2', exact: true })
    await b2.fill('First line\nSecond line')
    await b2.press('Home')
    await b2.press('ArrowUp')
    await expect(b2).toBeFocused()
    for (const [width, height] of [[390, 844], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1440, 900]]) {
        await page.setViewportSize({ width, height })
        await b2.focus()
        const tools = page.getByRole('group', { name: 'Active table controls' })
        await expect(tools).toBeVisible()
        const toolbar = page.locator('[aria-label="Document actions"]')
        const bounds = (await toolbar.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(16)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 16)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const rows = await toolbar.locator('button').evaluateAll(buttons => buttons.filter(button => button.getBoundingClientRect().height).map(button => Math.round(button.getBoundingClientRect().top)))
        expect(new Set(rows).size).toBe(1)
        await tools.getByRole('button', { name: 'Add column after B', exact: true }).scrollIntoViewIfNeeded()
        await expect(tools.getByRole('button', { name: 'Add column after B', exact: true })).toBeInViewport()
    }
    await page.setViewportSize({ width: 820, height: 1180 })
    await page.screenshot({ path: '/tmp/thesis-tools-ipad.png' })
    await b2.press('Escape')
    await expect(page.getByRole('group', { name: 'Active table controls' })).toHaveCount(0)
})

test.describe('touch controls', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })
    test('mobile movement controls navigate the active table', async({ page }) => {
        await page.getByRole('textbox', { name: 'Cell B2', exact: true }).tap()
        await page.getByRole('button', { name: 'Cell below', exact: true }).tap()
        await expect(page.getByRole('textbox', { name: 'Cell B3', exact: true })).toBeFocused()
        await page.getByRole('button', { name: 'Cell above', exact: true }).tap()
        await expect(page.getByRole('textbox', { name: 'Cell B2', exact: true })).toBeFocused()
        await page.screenshot({ path: '/tmp/thesis-tools-mobile.png' })
    })
})


test('vertical navigation centers cells in a large table', async({ page, context, baseURL }) => {
    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    const body = '| Task | Hours | Notes |\n| --- | --- | --- |\n' + Array.from({ length: 60 }, (_, index) => `| Task ${index + 1} | ${index + 1} | Notes |`).join('\n')
    expect((await context.request.put(baseURL + '/api/thesis', { headers: { Origin: baseURL! }, data: { ...current, body } })).ok()).toBe(true)
    await page.reload()
    const b20 = page.getByRole('textbox', { name: 'Cell B20', exact: true })
    await b20.click()
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
        await page.keyboard.press(key)
        await expect.poll(async() => page.locator('[data-table-cell]:focus').evaluate(element => {
            const bounds = element.getBoundingClientRect()
            const viewport = element.closest('.enterprise-theme')!
            const frame = viewport.getBoundingClientRect()
            return Math.abs(bounds.top + bounds.height / 2 - (frame.top + viewport.clientHeight / 2))
        })).toBeLessThan(3)
    }
    await expect(page.getByRole('textbox', { name: 'Cell B21', exact: true })).toBeFocused()
})

test('arrows create temporary edges, clean up empty cells, and save entered text', async({ page, context, baseURL }) => {
    const cell = (name: string) => page.getByRole('textbox', { name: `Cell ${name}`, exact: true })
    const count = () => page.locator('[data-table-cell]').count()
    const saved = await (await context.request.get(baseURL + '/api/thesis')).json()
    for (const [start, key, next, back] of [['B3', 'ArrowDown', 'B4', 'ArrowUp'], ['B1', 'ArrowUp', 'B1', 'ArrowDown'], ['A2', 'ArrowLeft', 'A2', 'ArrowRight'], ['C2', 'ArrowRight', 'D2', 'ArrowLeft']]) {
        await cell(start).focus()
        if (key === 'ArrowLeft' || key === 'ArrowUp') await page.keyboard.press('Home')
        else await page.keyboard.press('End')
        await page.keyboard.press(key)
        await expect(cell(next)).toBeFocused()
        await expect.poll(count).toBe(12)
        await page.keyboard.press(back)
        await expect.poll(count).toBe(9)
    }
    await cell('B3').focus()
    for (let n = 0; n < 20; n++) {
        await page.keyboard.press('ArrowDown')
        await expect(cell('B4')).toBeFocused()
        await expect.poll(count).toBe(12)
    }
    await page.getByRole('separator', { name: 'Resize row 4', exact: true }).press('ArrowDown')
    await page.getByRole('heading', { name: 'Timetable', exact: true }).click()
    await expect.poll(count).toBe(9)
    expect((await (await context.request.get(baseURL + '/api/thesis')).json()).body).toBe(saved.body)
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await cell('B3').focus()
    await page.keyboard.press('ArrowDown')
    await cell('B4').fill('New text')
    await page.keyboard.press('ArrowUp')
    await expect.poll(count).toBe(12)
    await expect.poll(async() => (await (await context.request.get(baseURL + '/api/thesis')).json()).body, { timeout: 15000 }).toContain('New text')
    await page.reload()
    await expect(cell('B4')).toHaveValue('New text')
})


test('Shift+Enter moves down and creates the same temporary edge as arrow navigation', async({ page }) => {
    const cell = (name: string) => page.getByRole('textbox', { name: `Cell ${name}`, exact: true })
    await cell('B2').fill('First line\nSecond line')
    await cell('B2').press('ControlOrMeta+a')
    await page.keyboard.press('Shift+Enter')
    await expect(cell('B3')).toBeFocused()
    await expect(cell('B2')).toHaveValue('First line\nSecond line')
    await page.keyboard.press('Shift+Enter')
    await expect(cell('B4')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(cell('B3')).toBeFocused()
    await expect(cell('B4')).toHaveCount(0)
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await expect(cell('B3')).toHaveValue('2\n')
})
