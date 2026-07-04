import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('dashboard threat intelligence tables use shared theme tokens', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/page.tsx'), 'utf8')

    expect(source).toContain('Latest activity')
    expect(source).toContain('divide-ui-border')
    expect(source).toContain('text-ui-text')

    expect(source).not.toContain('text-white')
    expect(source).not.toContain('divide-[#1f314a]')
    expect(source).not.toMatch(/\b(?:bg|text|border|divide)-\[#/)
})
