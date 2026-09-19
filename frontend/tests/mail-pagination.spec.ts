import { expect, test } from '@playwright/test'

test('mail scroll loads older messages, retries failures and contains long mailbox names', async ({ page, context, baseURL }) => {
    test.skip(!baseURL?.includes('127.0.0.1'), 'Uses loopback-only render proof auth')
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: baseURL! },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: baseURL! },
        { name: 'roles', value: '["administrator"]', url: baseURL! },
    ])
    let failNext = true
    await page.route('**/api/backend/mail/overview?*', async route => {
        const after = new URL(route.request().url()).searchParams.get('after')
        if (after && failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Temporary outage' } }) }
        const messages = Array.from({ length: after ? 25 : 50 }, (_, i) => ({ id: String(i + (after ? 50 : 0)), subject: `Message ${i + (after ? 50 : 0)}`, from: [], to: [], cc: [], receivedAt: '2026-09-19T10:00:00Z', mailboxIds: ['inbox'], preview: 'preview', isRead: false }))
        await route.fulfill({ json: {
            actor: { id: 'dashboard-render-proof-user', canAccessAnyMailbox: true }, mailboxUser: 'dashboard-render-proof-user', mailboxAddress: 'test@example.com',
            accessibleAccounts: [{ id: 'dashboard-render-proof-user', name: 'Test', address: 'test@example.com' }, { id: 'long', name: 'VeryLongMailboxName'.repeat(20), address: 'long@example.com' }],
            mailboxes: [{ id: 'inbox', name: 'Inbox', role: 'inbox', totalEmails: 75 }], selectedMailboxId: 'inbox', messages, nextCursor: after ? null : '49',
        } })
    })
    await page.goto('/mail')
    await expect(page.getByTestId('mail-message-49')).toBeAttached()
    await page.getByRole('button', { name: 'Load older messages' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load older messages' })).toBeVisible()
    await page.getByRole('button', { name: 'Load older messages' }).click()
    await expect(page.getByTestId('mail-message-74')).toBeAttached()
    await expect(page.locator('button[data-testid^="mail-message-"]')).toHaveCount(75)
    await expect(page.getByRole('button', { name: 'Load older messages' })).toHaveCount(0)
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.getByLabel('Other mailboxes', { exact: true }).evaluate(el => { (el.parentElement as HTMLDetailsElement).open = true })
        const mailbox = page.getByRole('button', { name: /^Open VeryLongMailboxName/ })
        expect(await mailbox.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= el.closest('aside')!.getBoundingClientRect().right)).toBe(true)
    }
})
