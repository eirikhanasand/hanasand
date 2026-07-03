import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('vulnerability scanner starts with triage and collapses telemetry', async () => {
    const summaryGrid = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/summaryGrid.tsx'), 'utf8')
    const header = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/header.tsx'), 'utf8')
    const imageDetails = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/imageDetails.tsx'), 'utf8')

    expect(summaryGrid).toContain('Scanner needs review')
    expect(summaryGrid).toContain('Review image findings by impact')
    expect(summaryGrid).toContain('data-testid=\'vulnerability-scan-telemetry\'')
    expect(summaryGrid).toContain('<summary className=')
    expect(summaryGrid).toContain('Scan telemetry')
    expect(summaryGrid).toContain('TriageFact')
    expect(summaryGrid).toContain('Healthy counters')
    expect(summaryGrid).toContain('SummaryCard')

    expect(header).toContain('Continuous scanner')
    expect(header).toContain('customerOperationalText')
    expect(header).toContain('operationalStateLabel')
    expect(header).not.toContain('What returned')

    expect(imageDetails).toContain('data-testid=\'vulnerability-image-breakdown-disclosure\'')
    expect(imageDetails).toContain('Package and severity breakdown')
    expect(imageDetails).toContain('data-testid=\'vulnerability-image-breakdown\'')
    expect(imageDetails.indexOf('vulnerability-image-breakdown-disclosure')).toBeLessThan(imageDetails.indexOf('<ImageFindings'))
    expect(imageDetails).toContain('<ImageFindings image={image} />')
})
