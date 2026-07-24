import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti source inventory keeps source health primary while summary and coverage are disclosed', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/sources/page.tsx'), 'utf8')

    expect(source).toContain('data-ti-source-inventory-summary-disclosure')
    expect(source).toContain('data-ti-source-inventory-metrics')
    expect(source).toContain('data-ti-source-capture-coverage-disclosure')
    expect(source).toContain('data-ti-source-capture-coverage')
    expect(source).toContain('ChevronDown')
    expect(source).toContain('group-open:rotate-180')
    expect(source).toContain('Global sources')
    expect(source).toContain('Default tenant')
    expect(source).toContain('configured ·')
    expect(source).toContain('?scope=${scope}')

    expect(source.indexOf('data-ti-source-inventory-summary-disclosure')).toBeLessThan(source.indexOf('Source health'))
    expect(source.indexOf('Source health')).toBeLessThan(source.indexOf('Sources to review'))
    expect(source.indexOf('Sources to review')).toBeLessThan(source.indexOf('data-ti-source-capture-coverage-disclosure'))
    expect(source.indexOf('data-ti-source-capture-coverage-disclosure')).toBeLessThan(source.indexOf(' data-ti-source-capture-coverage>'))

    expect(source).toContain('<ManualRunButton sourceId={row.source.id} label=\'Run\'')
    expect(source).toContain('href={`/dashboard/ti/sources/${row.source.id}?scope=${scope}`}')
    expect(source).toContain('sourceRows.filter(row => row.health.state !== \'healthy\'')
    expect(source).toContain('Bounded recent sample · {overview.sourceTotals.executable} executable sources')
    expect(source).toContain('% AI confidence')
})

test('ti source detail centers run status pills', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/sources/[id]/page.tsx'), 'utf8')

    expect(source).toContain('inline-flex min-h-8 w-fit items-center justify-center rounded-full')
})
