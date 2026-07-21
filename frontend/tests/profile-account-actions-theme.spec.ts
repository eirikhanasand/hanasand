import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('profile account actions use shared theme tokens for destructive controls', async () => {
    const source = await readFile(path.join(root, 'src/components/profile/accountActions.tsx'), 'utf8')
    const backendProxy = await readFile(path.join(root, 'src/app/api/backend/[...path]/route.ts'), 'utf8')

    expect(source).toContain('Delete account')
    expect(source).toContain('Delete account?')
    expect(source).toContain('fetch(\'/api/backend/user/self\', { method: \'DELETE\' })')
    expect(source).toContain('bg-ui-danger px-4 text-sm font-bold text-ui-canvas')
    expect(source).toContain('border-ui-danger/40 bg-ui-danger/10')

    expect(source).not.toContain('text-white')
    expect(source).not.toContain('config.url.api}/user/self')
    expect(source).not.toContain('dark:text-ui-canvas')
    expect(source).not.toMatch(/\b(?:bg|text|border)-\[#/)
    expect(backendProxy).toContain('!req.headers.has(\'content-type\') ? undefined : req.body')
})
