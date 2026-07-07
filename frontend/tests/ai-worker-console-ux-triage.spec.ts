import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('ai worker console focuses operator triage while preserving live telemetry paths', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/ai/pageClient.tsx'), 'utf8')
    const popup = await readFile(path.join(root, 'src/components/gpt/testClientPopup.tsx'), 'utf8')

    expect(page).toContain('aiClientRequest(\'/ai/economics?days=30\')')
    expect(page).toContain('fetch(`${config.url.api}/docker`')
    expect(page).toContain('normalizeDockerTelemetry(await response.json())')
    expect(page).toContain('useGptPageState()')
    expect(page).toContain('TestClientPopup')

    expect(page).toContain('data-ai-primary-triage')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryHref')
    expect(page).toContain('href={primaryHref}')
    expect(page).toContain('data-ai-primary-action')

    expect(page).toContain('id=\'ai-reliability\'')
    expect(page).toContain('data-ai-reliability')
    expect(page).toContain('data-ai-container-health')
    expect(page).toContain('data-ai-container-row')
    expect(page).toContain('/dashboard/system#system-containers')
    expect(page).toContain('/dashboard/logs?service=')
    expect(page).toContain('id=\'ai-operations\'')
    expect(page).toContain('data-ai-operations')
    expect(page).toContain('data-ai-lane-table')
    expect(page).toContain('Lane control table')
    expect(page).not.toContain('Action queued')
    expect(page).toContain('id=\'ai-clients\'')
    expect(page).toContain('data-ai-clients')

    expect(page).toContain('data-ai-economics-disclosure')
    expect(page).toContain('data-ai-economics-metrics')
    expect(page).toContain('data-ai-history-disclosure')
    expect(page).toContain('data-ai-history-panels')
    expect(page.indexOf('data-ai-economics-disclosure')).toBeLessThan(page.indexOf('data-ai-economics-metrics'))
    expect(page.indexOf('data-ai-history-disclosure')).toBeLessThan(page.indexOf('data-ai-history-panels'))

    expect(popup).toContain('Test client')
    expect(popup).toContain('Current tokens')
    expect(popup).toContain('Generated tokens')
    expect(popup).toContain('ErrorNotice')
    expect(popup).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})
