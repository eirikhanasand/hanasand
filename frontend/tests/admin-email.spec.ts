import { test, expect } from '@playwright/test'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
let output: string
let bundle: string
test.beforeAll(() => {
    output = mkdtempSync(path.join(tmpdir(), 'admin-email-test-'))
    execFileSync(process.env.BUN_BIN || 'bun', ['build', 'tests/fixtures/admin-email.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
    bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
})
test.afterAll(() => rmSync(output, { recursive: true, force: true }))
test('admins can see profile emails and filter users by email without losing name search', async ({ page }) => {
    await page.route('http://email.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route('http://email.test/', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.goto('http://email.test/')
    await expect(page.getByTestId('admin-profile')).toContainText('Email: support@example.com')
    await expect(page.getByTestId('public-profile')).not.toContainText('Email:')
    await page.getByRole('button', { name: 'Search users (Cmd J)' }).click()
    const search = page.getByRole('textbox', { name: 'Filter users' })
    await expect(search).toHaveAttribute('placeholder', 'Name, username or email')
    await search.fill('SUPPORT@EXAMPLE.COM')
    await expect(page.getByText('1 shown', { exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Member One', exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Other Member', exact: true })).toHaveCount(0)
    await search.fill('second')
    await expect(page.getByText('1 shown', { exact: true })).toBeVisible()
    await expect(page.getByTestId('user-list').getByRole('heading', { name: 'Other Member', exact: true })).toBeVisible()
    await search.fill('no-match@example.com')
    await expect(page.getByText('0 shown', { exact: true })).toBeVisible()
    await search.press('Escape')
    await expect(page.getByText('2 shown', { exact: true })).toBeVisible()
})
