import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { mockSupportLive } from './support-fixture'

let directory: string, bundle: string, css: string
test.beforeAll(async () => {
    directory = mkdtempSync(path.join(tmpdir(), 'feedback-speed-'))
    execFileSync('bun', ['build', 'tests/fixtures/support-feedback.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outdir', directory])
    bundle = readFileSync(path.join(directory, 'support-feedback.js'), 'utf8')
    css = (await postcss([tailwind()]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css
})
test.afterAll(() => rmSync(directory, { recursive: true, force: true }))

for (const guest of [true, false]) test(`${guest ? 'guest' : 'account'} feedback responds under 20ms, restores failures and saves without reloading chat`, async ({ page }) => {
    await page.clock.install()
    const id = '55555555-5555-4555-8555-555555555555'
    const ticket = { id, subject: 'Support question', status: 'closed', channel: 'human', resolution_version: 1, feedback_rating: null as number | null, feedback_comment: '', reply_count: 0 }
    let reads = 0, posts = 0, fail = true
    let finish!: () => void
    await page.route('http://feedback.test/**', async route => {
        const url = new URL(route.request().url())
        if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: bundle })
        if (url.pathname.startsWith('/api/')) {
            const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
            if (body?.action === 'feedback' || url.pathname.endsWith('/feedback')) {
                posts++
                expect(body).toMatchObject({ rating: 3, comment: 'Please explain the steps.', resolutionVersion: 1 })
                await new Promise<void>(resolve => { finish = resolve })
                if (fail) return route.fulfill({ status: 503, json: { error: 'Please try again.' } })
                ticket.feedback_rating = body.rating; ticket.feedback_comment = body.comment
                return route.fulfill({ json: { ok: true } })
            }
            reads++
            return route.fulfill({ json: guest ? { ...ticket, tickets: [ticket], messages: [], pending: false } : url.pathname.endsWith('/messages') ? { messages: [] } : { tickets: [ticket], role: 'user', realtime: true } })
        }
        return route.fulfill({ contentType: 'text/html', body: `<html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>` })
    })
    await mockSupportLive(page)
    await page.goto(`http://feedback.test/${guest ? '?guest' : ''}`)
    await page.getByRole('button', { name: '3 stars', exact: true }).click()
    await page.getByLabel('Feedback', { exact: true }).fill('Please explain the steps.')
    const elapsed = await page.getByRole('button', { name: 'Send feedback', exact: true }).evaluate(button => {
        const start = performance.now()
        ;(button as HTMLButtonElement).click()
        if (!document.body.textContent?.includes('Thank you for your feedback.')) throw new Error('Feedback did not acknowledge the click immediately')
        return performance.now() - start
    })
    console.log(`${guest ? 'Guest' : 'Account'} feedback acknowledgement: ${elapsed.toFixed(3)} ms`)
    expect(elapsed).toBeLessThan(20)
    await expect.poll(() => posts).toBe(1)
    await expect(page.getByText('Sending feedback…', { exact: true })).toBeVisible()
    finish()
    await expect(page.getByRole('alert')).toHaveText('Please try again.')
    await expect(page.getByLabel('Feedback', { exact: true })).toHaveValue('Please explain the steps.')
    fail = false
    await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
    await expect.poll(() => posts).toBe(2)
    const before = reads
    finish()
    await expect(page.getByText('Sending feedback…', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Thank you for your feedback.')).toBeVisible()
    expect(reads).toBe(before)
    await page.reload()
    await expect(page.getByText('Thank you for your feedback.')).toBeVisible()
    await expect(page.getByText('Please explain the steps.', { exact: true })).toBeVisible()
})
