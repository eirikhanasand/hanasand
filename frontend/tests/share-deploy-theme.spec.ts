import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('share deploy control uses compact themed operator chrome', async () => {
    const source = await readFile(path.join(root, 'src/components/share/deploy.tsx'), 'utf8')

    expect(source).toContain('Deployment unavailable')
    expect(source).toContain('Open deployment path with logs and rollback')
    expect(source).toContain('rounded-lg border p-3')
    expect(source).toContain('shadow-lg')
    expect(source).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
    expect(source).not.toMatch(/\bshadow-\[/)
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[#/)
})
