import { expect, test } from 'bun:test'
import { hasSuspiciousFindings, reportMarkdown } from '../src/app/browser/report/presentation'

test('clean reports omit actions and legacy review entries without removing evidence', () => {
    const clean = { analystReport: { providerReports: [{ vendorFlagged: 0, alertCount: 0 }], scriptArtifacts: [{ assessment: 'obfuscated' }] } }
    expect(hasSuspiciousFindings(clean)).toBe(false)
    const markdown = '# Report\nVerdict: Review required\n## Analyst review\n- Redirect observed\n## Resource URLs\n- https://example.com\n## Recommended actions\n- Keep the indicator list open\n## Network\n- requests: 4'
    const result = reportMarkdown(markdown, false)
    expect(result).not.toContain('review')
    expect(result).not.toContain('Recommended actions')
    expect(result).not.toContain('Keep the indicator')
    expect(result).toContain('## URLs\n- https://example.com')
    expect(result).toContain('## Network\n- requests: 4')
    expect(reportMarkdown('## Recommended actions\n- Filler', false)).toBe('')
})

test('actual detections keep relevant actions, never a review category', () => {
    for (const report of [
        { analystReport: { providerReports: [{ vendorFlagged: 1 }] } },
        { analystReport: { providerReports: [{ alertCount: 1 }] } },
        { captures: [{ evidence: { verdict: 'suspicious' } }] },
        { analystReport: { scriptArtifacts: [{ assessment: 'suspicious' }] } },
        { analystReport: { networkEvidence: { downloads: [{ virusTotal: { flagged: 1 } }] } } },
    ]) expect(hasSuspiciousFindings(report)).toBe(true)
    const result = reportMarkdown('## Review list\n- Flagged\n## Recommended actions\n- Inspect detected script', true)
    expect(result).not.toContain('Review list')
    expect(result).toContain('## Recommended actions\n- Inspect detected script')
})
