type Findings = {
    captures?: Array<{ evidence?: { verdict?: string } }>
    analystReport?: {
        providerReports?: Array<{ verdict?: string; vendorFlagged?: number; alertCount?: number }>
        scriptArtifacts?: Array<{ assessment?: string }>
        networkEvidence?: { downloads?: Array<{ virusTotal?: { flagged?: number } }> }
    }
}

export function hasSuspiciousFindings(report: Findings) {
    const suspicious = (value?: string) => value === 'suspicious' || value === 'malicious'
    return Boolean(report.captures?.some(capture => suspicious(capture.evidence?.verdict))
        || report.analystReport?.providerReports?.some(provider => (provider.vendorFlagged || 0) > 0 || (provider.alertCount || 0) > 0 || suspicious(provider.verdict))
        || report.analystReport?.scriptArtifacts?.some(script => suspicious(script.assessment))
        || report.analystReport?.networkEvidence?.downloads?.some(file => (file.virusTotal?.flagged || 0) > 0))
}

// Older saved reports keep their evidence, but no longer show retired review sections.
export function reportMarkdown(markdown: string, suspicious: boolean) {
    return markdown
        .replace(/^## (?:Analyst review|Review list)\s*\r?\n[\s\S]*?(?=^#{1,2} |$(?![\s\S]))/gm, '')
        .replace(/^## Recommended actions\s*\r?\n[\s\S]*?(?=^#{1,2} |$(?![\s\S]))/gm, section => suspicious ? section : '')
        .replace(/^## Resource URLs\s*$/gm, '## URLs')
        .replace(/^Verdict: Review required[^\r\n]*/gm, `Verdict: ${suspicious ? 'Suspicious activity observed' : 'No signs of suspicious activity.'}`)
        .trim()
}
