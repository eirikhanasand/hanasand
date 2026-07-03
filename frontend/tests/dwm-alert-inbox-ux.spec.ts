import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('DWM alert inbox keeps triage actions primary and collapses evidence noise', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/dwm/dwm-alert-inbox.tsx'), 'utf8')

    expect(page).toContain('data-dwm-alert-row')
    expect(page).toContain('data-dwm-alert-primary-actions')
    expect(page).toContain('data-dwm-alert-evidence-disclosure')
    expect(page).toContain('data-dwm-alert-secondary-actions')
    expect(page.indexOf('data-dwm-alert-primary-actions')).toBeLessThan(page.indexOf('data-dwm-alert-evidence-disclosure'))
    expect(page.indexOf('data-dwm-alert-evidence-disclosure')).toBeLessThan(page.indexOf('data-dwm-alert-secondary-actions'))

    expect(page).toContain('updateAlert(alert.id, \'reviewing\', \'pending_review\'')
    expect(page).toContain('updateAlert(alert.id, \'route_to_customer\', \'ready_to_send\'')
    expect(page).toContain('sendAlert(alert.id)')
    expect(page).toContain('replayAlert(alert.id)')
    expect(page).toContain('updateAlert(alert.id, \'false_positive\', \'muted\'')
    expect(page).toContain('safeEvidenceExcerpt(item.excerpt)')
    expect(page).not.toContain('What returned')
})
