import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const enterpriseFacingSources = [
    'src/app/trust/page.tsx',
    'src/app/trust/trustArtifacts.ts',
    'src/app/pricing/page.tsx',
    'src/app/developers/page.tsx',
    'src/app/solutions/page.tsx',
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
    /launch-readiness/i,
    /readiness checks/i,
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

test('pricing keeps endpoint checks secondary to exposure monitoring', async () => {
    const pricing = await readFile(path.join(root, 'src/app/pricing/page.tsx'), 'utf8')

    expect(pricing).toContain('Threat monitoring priced around review-ready alerts.')
    expect(pricing).toContain('Utility tool')
    expect(pricing).toContain('Open service checks')
    expect(pricing).toContain('Service checks remain available for URLs you control')
    expect(pricing).not.toContain('const loadTestingPlans')
    expect(pricing).not.toContain('Starter checks')
    expect(pricing).not.toContain('Team checks')
    expect(pricing).toContain('href: \'/register?path=/organizations\'')
    expect(pricing).toContain('href=\'/register?path=/organizations\'')
    expect(pricing.indexOf('Common buying scenarios')).toBeLessThan(pricing.indexOf('Utility tool'))
})

test('global footer keeps enterprise diligence ahead of personal notebook links', async () => {
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')
    const companyGroup = footer.slice(footer.indexOf('title: \'Company\''), footer.indexOf('title: \'Legal\''))

    expect(companyGroup).toContain('label: \'About\'')
    expect(companyGroup).toContain('label: \'Trust Center\'')
    expect(companyGroup).toContain('label: \'Contact\'')
    expect(companyGroup).toContain('label: \'Pricing\'')
    expect(companyGroup).not.toContain('label: \'Eirik\'')
    expect(companyGroup).not.toContain('label: \'Articles\'')
    expect(companyGroup).not.toContain('label: \'Readiness\'')
})
