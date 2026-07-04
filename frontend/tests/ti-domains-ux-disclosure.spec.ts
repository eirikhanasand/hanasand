import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti monitored entities keeps review triage primary while totals and coverage are disclosed', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/domains/page.tsx'), 'utf8')

    expect(source).toContain('data-ti-domains-summary-disclosure')
    expect(source).toContain('data-ti-domains-summary-metrics')
    expect(source).toContain('data-ti-domains-source-coverage-disclosure')
    expect(source).toContain('data-ti-domains-source-coverage')
    expect(source).toContain('ChevronDown')
    expect(source).toContain('group-open:rotate-180')
    expect(source).toContain('[&::-webkit-details-marker]:hidden')

    expect(source.indexOf('data-ti-domains-summary-disclosure')).toBeLessThan(source.indexOf('Review active matches, source coverage, and customer-ready evidence.'))
    expect(source.indexOf('Review active matches, source coverage, and customer-ready evidence.')).toBeLessThan(source.indexOf('Matches to review'))
    expect(source.indexOf('Matches to review')).toBeLessThan(source.indexOf('data-ti-domains-source-coverage-disclosure'))
    expect(source.indexOf('data-ti-domains-source-coverage-disclosure')).toBeLessThan(source.indexOf(' data-ti-domains-source-coverage>'))

    expect(source).toContain('href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`}')
    expect(source).toContain('rows.filter(row => row.domain.status === \'review\')')
    expect(source).toContain('row.domain.matchedTerms.join(\', \')')
    expect(source).toContain('{rows.reduce((sum, row) => sum + row.sources.length, 0)} source links')
})
