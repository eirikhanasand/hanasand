import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('vulnerability scanner starts with triage and collapses telemetry', async () => {
    const summaryGrid = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/summaryGrid.tsx'), 'utf8')
    const header = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/header.tsx'), 'utf8')
    const imageDetails = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/imageDetails.tsx'), 'utf8')
    const imageFindings = await readFile(path.join(root, 'src/components/monitoring/vulnerabilities/imageFindings.tsx'), 'utf8')

    expect(summaryGrid).toContain('TriageFact')
    expect(summaryGrid).toContain('label=\'Targets\'')
    expect(summaryGrid).toContain('label=\'Last scan\'')
    expect(summaryGrid).toContain('label=\'Next scan\'')
    expect(summaryGrid).toContain('label=\'Failures\'')
    expect(summaryGrid).not.toContain('Scanner needs review')
    expect(summaryGrid).not.toContain('Review image findings by impact')
    expect(summaryGrid).not.toContain('Scan telemetry')
    expect(summaryGrid).not.toContain('SummaryCard')

    expect(header).toContain('Continuous scanner')
    expect(header).toContain('customerOperationalText')
    expect(header).toContain('operationalStateLabel')
    expect(header).not.toContain('What returned')

    expect(imageDetails).toContain('data-testid=\'vulnerability-image-breakdown-disclosure\'')
    expect(imageDetails).toContain('Package and severity breakdown')
    expect(imageDetails).toContain('data-testid=\'vulnerability-image-breakdown\'')
    expect(imageDetails.indexOf('vulnerability-image-breakdown-disclosure')).toBeLessThan(imageDetails.indexOf('<ImageFindings'))
    expect(imageDetails).toContain('<ImageFindings image={image} />')

    expect(imageFindings).toContain('data-testid=\'vulnerability-remediation-summary\'')
    expect(imageFindings).toContain('Recommended remediation')
    expect(imageFindings).toContain('const fixable = image.vulnerabilities.filter')
    expect(imageFindings).toContain('const unresolved = image.vulnerabilities.length - fixable.length')
    expect(imageFindings).toContain('fixable.find(isHighImpact) || fixable[0]')
    expect(imageFindings).toContain('data-testid=\'vulnerability-package-concentration\'')
    expect(imageFindings).toContain('packageConcentration(image.vulnerabilities)')
    expect(imageFindings).toContain('function remediationHeadline')
    expect(imageFindings).toContain('function remediationDetail')
    expect(imageFindings).toContain('function packageConcentration')
})
