import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ti runs keeps collector activity primary while totals and evidence are disclosed', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/ti/runs/page.tsx'), 'utf8')

    expect(source).toContain('data-ti-runs-summary-disclosure')
    expect(source).toContain('data-ti-runs-evidence-disclosure')
    expect(source).toContain('ChevronDown')
    expect(source).toContain('group-open:rotate-180')
    expect(source).toContain('[&::-webkit-details-marker]:hidden')
    expect(source).toContain('focus-visible:ring-ui-primary/25')

    expect(source.indexOf('<LiveRunCard')).toBeLessThan(source.indexOf('data-ti-runs-summary-disclosure'))
    expect(source.indexOf('data-ti-runs-summary-disclosure')).toBeLessThan(source.indexOf('Collector activity'))
    expect(source.indexOf('Collector activity')).toBeLessThan(source.indexOf('Runs needing attention'))
    expect(source.indexOf('Runs needing attention')).toBeLessThan(source.indexOf('data-ti-runs-evidence-disclosure'))
    expect(source.indexOf('data-ti-runs-evidence-disclosure')).toBeLessThan(source.indexOf('sources.map(source =>'))

    expect(source).toContain('actions={<ManualRunButton label=\'Start manual run\' queries={runQueries} />}')
    expect(source).toContain('orderedRuns.map(run =>')
    expect(source).toContain('href={`/dashboard/ti/sources/${run.sourceId}`}')
    expect(source).toContain('{captureTotal} captures · {screenshotTotal} screenshots')
    expect(source).toContain('sourceRuns.reduce((sum, run) => sum + run.captures, 0)')
})
