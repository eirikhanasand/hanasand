import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const liveSmokeSpecs = [
    'tests/live-admin-smoke.spec.ts',
    'tests/dashboard-resource-smoke.spec.ts',
] as const

test('live smoke specs require explicit admin credentials or token input', async () => {
    for (const sourcePath of liveSmokeSpecs) {
        const source = await readFile(path.join(root, sourcePath), 'utf8')

        expect(source, `${sourcePath} should not carry a default live admin id`).not.toMatch(/PLAYWRIGHT_ADMIN_ID\s*\|\|\s*['"][^'"]+['"]/)
        expect(source, `${sourcePath} should not carry a default live admin password`).not.toMatch(/PLAYWRIGHT_ADMIN_PASSWORD\s*\|\|\s*['"][^'"]+['"]/)
        expect(source, `${sourcePath} should require an admin id when token auth is used`).toContain('adminToken && adminId')
    }
})
