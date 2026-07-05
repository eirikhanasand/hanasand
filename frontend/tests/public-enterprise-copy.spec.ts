import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const enterpriseFacingSources = [
    'src/app/trust/page.tsx',
    'src/app/pricing/page.tsx',
    'src/app/developers/page.tsx',
    'src/app/solutions/dwm/pageClient.tsx',
] as const

const bannedVisibleTone = [
    /fake badges/i,
    /mystery roadmap/i,
    /scraped volume/i,
    /should win/i,
    /vanity feed/i,
    /bulk scraped-row/i,
    /raw leaked-data bloat/i,
    /vague claims/i,
] as const

test('public enterprise pages avoid casual competitive and procurement copy', async () => {
    for (const sourcePath of enterpriseFacingSources) {
        const source = await readFile(path.join(root, sourcePath), 'utf8')

        for (const pattern of bannedVisibleTone) {
            expect(source, `${sourcePath} should avoid ${pattern}`).not.toMatch(pattern)
        }
    }
})

test('public buyer navigation keeps hash utility discoverable without raw-secret framing', async () => {
    const header = await readFile(path.join(root, 'src/components/header/header.tsx'), 'utf8')
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')
    const sitemap = await readFile(path.join(root, 'src/app/sitemap.ts'), 'utf8')
    const pwnedPage = await readFile(path.join(root, 'src/app/pwned/pageClient.tsx'), 'utf8')
    const pwnedClient = await readFile(path.join(root, 'src/utils/pwned/checkHash.ts'), 'utf8')

    expect(header).not.toContain('Password Exposure Utility')
    expect(header).not.toContain('Password exposure utility')
    expect(header).toContain('Hash Exposure Lookup')
    expect(header).toMatch(/href: '\/pwned'/)
    expect(footer).not.toContain('Password Utility')
    expect(footer).toContain('Hash Exposure Lookup')
    expect(footer).toMatch(/href: '\/pwned'/)
    expect(sitemap).toMatch(/'\/pwned'/)
    expect(pwnedPage).toContain('SHA-1 hash')
    expect(pwnedPage).toContain('This lookup does not ask for, derive, or transmit the underlying secret.')
    expect(pwnedPage).toContain('Only the first five characters leave this page.')
    expect(pwnedClient).toContain('Enter a complete 40-character SHA-1 hash.')
    expect(pwnedClient).not.toContain('window.crypto.subtle.digest')
})
