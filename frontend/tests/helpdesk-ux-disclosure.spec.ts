import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('helpdesk audit keeps advanced controls behind explicit disclosures', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/page.tsx'), 'utf8')
    const supportForm = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/accessRecoveryForm.tsx'), 'utf8')

    expect(page).toContain('<details className=\'group rounded-lg border border-ui-border bg-ui-raised\'>')
    expect(page).toContain('Show advanced')
    expect(page).toContain('aria-label=\'Active audit filters\'')
    expect(page).toContain('href=\'#support-actions\'')
    expect(page).toContain('placeholder=\'Search audit events\'')
    expect(page).toContain('Audit snapshot')
    expect(page).toContain('auditSnapshotHeadline')
    expect(page).toContain('SnapshotFact')
    expect(page).toContain('Audit service reported')
    expect(page).not.toContain('Audit API returned')
    expect(page).toContain('Start or manage support action')
    expect(page).toContain('Show controls')
    expect(page).toContain('{ action: \'support.organization.access_recovery\', label: \'Access recovery\' }')
    expect(page).toContain('key={action}>{label}</Link>')

    expect(supportForm).toContain('type SupportOperation = \'inspect\' | \'impersonation\' | \'recovery\' | \'decision\' | \'queue\'')
    expect(supportForm).toContain('const [operation, setOperation] = useState<SupportOperation>(\'inspect\')')
    expect(supportForm).toContain('role=\'group\' aria-label=\'Support operation\'')
    expect(supportForm).toContain('operation === \'inspect\'')
    expect(supportForm).toContain('operation === \'impersonation\'')
    expect(supportForm).toContain('operation === \'recovery\'')
    expect(supportForm).toContain('operation === \'decision\'')
    expect(supportForm).toContain('operation === \'queue\'')
    expect(supportForm).toContain('End current session</summary>')
})

test('helpdesk keeps search primary and collapses filters and support actions by default', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/page.tsx'), 'utf8')
    const supportForm = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/accessRecoveryForm.tsx'), 'utf8')

    expect(page.indexOf('placeholder=\'Search audit events\'')).toBeLessThan(page.indexOf('<span>Filters'))
    expect(page.indexOf('<span>Filters')).toBeLessThan(page.indexOf('placeholder=\'Organization\''))
    expect(page.indexOf('Start or manage support action')).toBeLessThan(page.indexOf('<AccessRecoveryForm />'))
    expect(page).toContain('group-open:hidden\'>Show controls</span>')
    expect(page).toContain('group-open:inline\'>Hide controls</span>')
    expect(page).not.toContain('support.organization.access_recovery</Link>')

    expect(supportForm.indexOf('operation === \'inspect\'')).toBeLessThan(supportForm.indexOf('operation === \'impersonation\''))
    expect(supportForm.indexOf('operation === \'impersonation\'')).toBeLessThan(supportForm.indexOf('operation === \'recovery\''))
    expect(supportForm).toContain('aria-pressed={active}')
    expect(supportForm).toContain('onClick={() => setOperation(tab.id)}')
})
