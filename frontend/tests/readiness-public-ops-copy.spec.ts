import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('public operations page keeps internal process language out of visible copy', async () => {
    const source = await readFile(path.join(root, 'src/app/readiness/page.tsx'), 'utf8')

    expect(source).toContain('Lane state')
    expect(source).toContain('Live lanes needing action')
    expect(source).toContain('Status links')
    expect(source).toContain('Update id')
    expect(source).toContain('UI state')
    expect(source).toContain('Operating holds')

    expect(source).not.toContain('Release gate')
    expect(source).not.toContain('Release gates')
    expect(source).not.toContain('Live gates holding release')
    expect(source).not.toContain('Run id')
    expect(source).not.toContain('UI signal')
    expect(source).not.toContain('<Fact label=\'Command\'')
    expect(source).not.toContain('<Fact label=\'Test\'')
})
