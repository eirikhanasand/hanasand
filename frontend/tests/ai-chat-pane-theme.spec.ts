import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ai chat product shell uses shared dashboard theme tokens', async () => {
    const source = await readFile(path.join(root, 'src/components/ai/chatPane.tsx'), 'utf8')
    const artifactSectionStart = source.indexOf('function ArtifactList')
    const artifactTextStart = source.indexOf('function ArtifactTextContent')
    const verificationCardStart = source.indexOf('function BrowserVerificationCard')
    const verificationSummaryStart = source.indexOf('function getBrowserVerificationSummary')

    expect(artifactSectionStart).toBeGreaterThan(0)
    expect(artifactTextStart).toBeGreaterThan(artifactSectionStart)
    expect(verificationCardStart).toBeGreaterThan(0)
    expect(verificationSummaryStart).toBeGreaterThan(verificationCardStart)

    const shellSource = source.slice(0, artifactSectionStart)
    const artifactChromeSource = source.slice(artifactSectionStart, artifactTextStart)
    const verificationCardSource = source.slice(verificationCardStart, verificationSummaryStart)

    expect(shellSource).toContain('border-ui-border bg-ui-panel')
    expect(shellSource).toContain('hover:bg-ui-raised hover:text-ui-text')
    expect(shellSource).toContain('focus-within:border-ui-primary')
    expect(shellSource).toContain('bg-ui-primary/10 text-ui-primary')
    expect(shellSource).toContain('text-ui-danger')

    expect(shellSource).not.toContain('bg-white')
    expect(shellSource).not.toContain('text-white')
    expect(shellSource).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    expect(artifactChromeSource).toContain('border border-ui-border bg-ui-panel')
    expect(artifactChromeSource).toContain('outline outline-ui-border')
    expect(artifactChromeSource).not.toMatch(/#[0-9a-fA-F]{3,8}/)

    expect(verificationCardSource).toContain('border-ui-success/30 bg-ui-success/10 text-ui-success')
    expect(verificationCardSource).toContain('border-ui-warning/30 bg-ui-warning/10 text-ui-warning')
    expect(verificationCardSource).not.toMatch(/#[0-9a-fA-F]{3,8}/)
})
