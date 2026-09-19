import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Page } from '@playwright/test'

let bundle: string
export async function openLogs(page: Page, pathname = '/logs/realtime') {
    if (!bundle) {
        const output = mkdtempSync(path.join(tmpdir(), 'logs-browser-'))
        try {
            execFileSync('bun', ['build', 'tests/fixtures/realtime-logs.tsx', '--target=browser', '--define', 'process.env={"NODE_ENV":"production"}', '--outfile', path.join(output, 'fixture.js')])
            bundle = readFileSync(path.join(output, 'fixture.js'), 'utf8')
        } finally { rmSync(output, { recursive: true, force: true }) }
    }
    await page.route('http://logs.test/fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }))
    await page.route(/^http:\/\/logs\.test\/logs(?:[/?].*)?$/, route => route.fulfill({ contentType: 'text/html', body: '<style>body{user-select:none}.select-text{user-select:text}[data-logs-scroll]{height:300px;overflow:auto}article{min-height:90px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><div id="root"></div><script type="module" src="/fixture.js"></script>' }))
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { sessionStorage.setItem('copied-event', value) } }, configurable: true })
    })
    await page.goto(`http://logs.test${pathname}`)
}

export const event = (id = 'whoami-event') => ({
    id,
    event_timestamp: '2026-09-19T12:00:00Z',
    normalized: {
        timestamp: '2026-09-19T12:00:00Z', service: 'audit', host: 'inspur',
        severity: 'high', level: 'info', log_type: 'ProcessLogs', message: 'Process executed',
        process: { executable: '/usr/bin/whoami', command_line: 'whoami' },
        detections: [{ rule_id: 'recon.whoami', summary: 'Identity reconnaissance', severity: 'high' }],
        rules_checked: 105,
    },
})
export const result = (rows: unknown[] = [event()]) => ({ rows, counts: [{ severity: 'high', count: rows.length }], services: [{ service: 'audit', count: rows.length }], processing: { updated_at: '2026-09-19T12:01:00Z' }, limit: 200 })
