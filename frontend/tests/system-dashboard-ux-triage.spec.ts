import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('system dashboard focuses operator triage while preserving live controls', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/clientPage.tsx'), 'utf8')

    expect(page).toContain('fetch(`${config.url.api}/metrics`')
    expect(page).toContain('fetch(`${config.url.api}/docker`')
    expect(page).toContain('/logs/realtime?${params.toString()}')
    expect(page).toContain('restartDocker(container.id)')
    expect(page).toContain('navigator.clipboard.writeText(container.name)')
    expect(page).not.toContain('navigator.clipboard.writeText(`${container.name} ${container.id}`)')
    expect(page).not.toContain('window.confirm(`Restart ${label}?')
    expect(page).toContain('stopAllVms(cookieToken, cookieId)')

    expect(page).toContain('data-system-primary-triage')
    expect(page).toContain('Recommended next')
    expect(page).toContain('const primaryHref')
    expect(page).toContain('href={primaryHref}')
    expect(page).toContain('data-system-primary-action')

    expect(page).toContain('id=\'system-telemetry\'')
    expect(page).toContain('id=\'system-containers\'')
    expect(page).toContain('id=\'system-container-details\'')
    expect(page).toContain('scrollIntoView({ behavior: \'smooth\', block: \'start\' })')
    expect(page).toContain('data-system-containers')
    expect(page).toContain('id=\'system-vms\'')
    expect(page).toContain('data-system-vms')

    expect(page).toContain('data-system-summary-disclosure')
    expect(page).toContain('data-system-summary-metrics')
    expect(page).toContain('data-system-related-disclosure')
    expect(page).toContain('data-system-related-links')
    expect(page).toContain('data-system-container-logs-disclosure')
    expect(page).toContain('data-system-container-log-tail')
    expect(page).toContain('data-system-vm-danger-actions')
    expect(page).toContain('data-system-stop-all-vms')
    expect(page).toContain('VM danger actions')
    expect(page).toContain('Open VM inventory')
    expect(page.indexOf('data-system-container-logs-disclosure')).toBeLessThan(page.indexOf('data-system-container-log-tail'))
    expect(page.indexOf('data-system-vm-danger-actions')).toBeLessThan(page.indexOf('data-system-stop-all-vms'))
    expect(page).toContain('href={`/dashboard/logs?service=${encodeURIComponent(container.name)}`')
    expect(page.indexOf('data-system-summary-disclosure')).toBeLessThan(page.indexOf('data-system-summary-metrics'))
    expect(page.indexOf('data-system-related-disclosure')).toBeLessThan(page.indexOf('data-system-related-links'))
    expect(page).not.toContain(' returned ${status}')
})
