import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('subscription page is a compact direct-purchase catalog', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/subscription/page.tsx'), 'utf8')

    expect(page).toContain('title=\'Choose what you need\'')
    expect(page).toContain('Available plans')
    expect(page).toContain('Buy now')
    expect(page).toContain(`What's included`)
    expect(page).not.toContain('Enterprise review')
    expect(page).not.toContain('Workspace entitlements')
    expect(page).not.toContain('Sales scoped')
    expect(page).not.toContain('order form')
})
