import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'ai-model-connection-'))
    execFileSync('bun', ['build', 'tests/fixtures/ai-model-connection.tsx', '--target=browser', '--define', 'process.env.NODE_ENV="production"', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test('initial model snapshot is displayed, failed connections keep retrying, and prompts work after recovery', async ({ page }) => {
    page.on('pageerror', error => { throw error })
    let attempts = 0
    await page.routeWebSocket('**/client/ws/gpt', socket => {
        attempts++
        if (attempts < 3) { socket.close(); return }
        socket.send(JSON.stringify({ type: 'snapshot', participants: 1, clients: [{ name: 'inspur', displayName: 'Inspur GPU models' }] }))
        socket.onMessage(raw => {
            const prompt = JSON.parse(String(raw))
            expect(prompt.clientName).toBe('inspur')
            socket.send(JSON.stringify({ type: 'prompt_complete', conversationId: prompt.conversationId, content: 'OK' }))
        })
    })
    await page.route('https://ai-model.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('https://ai-model.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script>window.process={env:{}}</script><script src="/fixture.js"></script>' }))
    await page.goto('https://ai-model.test/')
    await expect(page.getByText('Inspur GPU models', { exact: true })).toBeVisible({ timeout: 12000 })
    expect(attempts).toBe(3)
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Test model' }).click()
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByText('Reply OK OK', { exact: true })).toBeVisible()
})
