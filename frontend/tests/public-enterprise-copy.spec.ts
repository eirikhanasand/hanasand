import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const enterpriseFacingSources = [
    'src/app/trust/page.tsx',
    'src/app/pricing/page.tsx',
    'src/app/developers/page.tsx',
] as const

const bannedVisibleTone = [
    /fake badges/i,
    /mystery roadmap/i,
    /scraped volume/i,
    /should win/i,
] as const

test('public enterprise pages avoid casual competitive and procurement copy', async () => {
    for (const sourcePath of enterpriseFacingSources) {
        const source = await readFile(path.join(root, sourcePath), 'utf8')

        for (const pattern of bannedVisibleTone) {
            expect(source, `${sourcePath} should avoid ${pattern}`).not.toMatch(pattern)
        }
    }
})
