import { expect, test } from '@playwright/test'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'shared-mailboxes-test-'))
    execFileSync('bun', ['build', 'tests/fixtures/shared-mailboxes.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))

test('shared folders keep mailbox selections separate and respect sending permissions', async ({ page, context, baseURL }) => {
    await context.addCookies(['id', 'access_token', 'roles'].map(name => ({ name, value: name === 'id' ? 'mail-test' : name === 'roles' ? encodeURIComponent(JSON.stringify([{ id: 'support' }])) : 'fixture-token', url: baseURL! })))
    const requests: URL[] = []
    let holdSupport = false
    let releaseSupport: (() => void) | undefined
    await page.route('**/api/backend/mail/overview?**', async route => {
        const url = new URL(route.request().url()); requests.push(url)
        const user = url.searchParams.get('mailboxUser') || 'mail-test'
        const shared = user.startsWith('shared:')
        if (holdSupport && user === 'shared:support') await new Promise<void>(resolve => { releaseSupport = resolve })
        await route.fulfill({ json: {
            actor: { id: 'mail-test', canAccessAnyMailbox: false, canSend: user !== 'shared:noreply' },
            mailboxUser: user, mailboxAddress: `${shared ? user.slice(7) : 'personal'}@example.test`,
            accessibleAccounts: [{ id: 'mail-test', name: 'Me', address: 'personal@example.test', unreadCount: 1 }, ...['support', 'sales', 'noreply'].map(name => ({ id: `shared:${name}`, name: name[0].toUpperCase() + name.slice(1), address: `${name}@example.test`, shared: true, unreadCount: name === 'support' ? 3 : 0 }))],
            mailboxes: [{ id: `${user}-inbox`, name: 'Inbox', role: 'inbox', unreadEmails: 0 }, { id: `${user}-sent`, name: 'Sent', role: 'sent', unreadEmails: 0 }],
            selectedMailboxId: url.searchParams.get('mailboxId') || `${user}-inbox`, messages: [], selectedMessage: null,
        } })
    })
    await page.route('**/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('**/mail', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.goto('/mail')
    await expect(page.getByRole('navigation', { name: 'Mailboxes', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Support', exact: true })).toContainText('3')
    await page.getByTestId('mail-mailbox-sent').click()
    await expect(page.getByTestId('mail-mailbox-sent')).toHaveClass(/border-ui-primary/)
    await page.getByRole('button', { name: 'Open Support', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Support', exact: true })).toHaveAttribute('aria-current', 'true')
    const supportRequest = requests.find(url => url.searchParams.get('mailboxUser') === 'shared:support')!
    expect(supportRequest.searchParams.has('mailboxId')).toBe(false)
    expect(supportRequest.searchParams.has('messageId')).toBe(false)
    await expect(page.getByTestId('mail-mailbox-inbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open Inbox', exact: true })).toContainText('Inbox')
    await page.getByRole('button', { name: 'Open Noreply', exact: true }).click()
    await expect(page.getByTestId('mail-compose-button')).toBeDisabled()
    holdSupport = true
    await page.getByRole('button', { name: 'Open Support', exact: true }).click()
    await expect.poll(() => Boolean(releaseSupport)).toBe(true)
    await page.getByRole('button', { name: 'Open Sales', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Sales', exact: true })).toHaveAttribute('aria-current', 'true')
    const lateResponse = page.waitForResponse(response => response.url().includes('mailboxUser=shared%3Asupport'))
    releaseSupport!()
    await lateResponse
    await expect(page.getByRole('button', { name: 'Open Sales', exact: true })).toHaveAttribute('aria-current', 'true')
    await page.getByRole('button', { name: 'Open Inbox', exact: true }).click()
    await expect(page.getByTestId('mail-compose-button')).toBeEnabled()
    await expect(page.getByTestId('mail-mailbox-inbox')).toHaveCount(0)
    const personalRequest = requests.at(-1)!
    expect(personalRequest.searchParams.has('mailboxId')).toBe(false)
    await expect(page).toHaveURL(/\/mail$/)
})
