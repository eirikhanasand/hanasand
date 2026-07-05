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
    expect(page).toContain('href=\'/dashboard/system/impersonation?support=impersonation#support-actions\'')
    expect(page).toContain('const supportMode = resolveSupportMode(param(params, \'support\'))')
    expect(page).toContain('placeholder=\'Search audit events\'')
    expect(page).toContain('Audit snapshot')
    expect(page).toContain('auditSnapshotHeadline')
    expect(page).toContain('selectedAuditEvent(events, params)')
    expect(page).toContain('data-helpdesk-focused-event={focused ? \'true\' : undefined}')
    expect(page).toContain('data-helpdesk-selected-detail')
    expect(page).toContain('Use Focus to inspect a specific event without opening every control.')
    expect(page).toContain('Focused</span>')
    expect(page).toContain('auditDetailRows(selectedEvent).map')
    expect(page).toContain('SnapshotFact')
    expect(page).toContain('Audit service reported')
    expect(page).not.toContain('Audit API returned')
    expect(page).toContain('Secondary support actions')
    expect(page).toContain('Open when needed')
    expect(page).toContain('{ action: \'support.organization.access_recovery\', label: \'Access recovery\' }')
    expect(page).toContain('key={action}>{label}</Link>')

    expect(supportForm).toContain('type SupportOperation = \'inspect\' | \'impersonation\' | \'recovery\' | \'decision\' | \'queue\'')
    expect(supportForm).toContain('export default function AccessRecoveryForm({ initialOperation = \'inspect\' }')
    expect(supportForm).toContain('const [operation, setOperation] = useState<SupportOperation>(initialOperation)')
    expect(supportForm).toContain('minimumAuditReasonMessage')
    expect(supportForm).toContain('function supportReasonIsSpecific(reason: string)')
    expect(supportForm).toContain('if (!supportReasonIsSpecific(reason))')
    expect(supportForm).toContain('if (!supportReasonIsSpecific(payload.reason))')
    expect(supportForm).toContain('minLength={10}')
    expect(supportForm).toContain('Audit reason with support case or requester')
    expect(supportForm).toContain('data-testid=\'support-primary-operation\'')
    expect(supportForm).toContain('Inspect first')
    expect(supportForm).toContain('data-testid=\'support-secondary-operations\'')
    expect(supportForm).toContain('Privileged support actions')
    expect(supportForm).toContain('operationTabs.filter(tab => tab.id !== \'inspect\')')
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
    expect(page.indexOf('Use Focus to inspect a specific event')).toBeLessThan(page.indexOf('data-helpdesk-selected-detail'))
    expect(page.indexOf('Secondary support actions')).toBeLessThan(page.indexOf('<AccessRecoveryForm initialOperation={supportMode} />'))
    expect(page).toContain('group-open:hidden\'>Open when needed</span>')
    expect(page).toContain('group-open:inline\'>Hide secondary actions</span>')
    expect(page).not.toContain('support.organization.access_recovery</Link>')

    expect(supportForm.indexOf('data-testid=\'support-primary-operation\'')).toBeLessThan(supportForm.indexOf('data-testid=\'support-secondary-operations\''))
    expect(supportForm.indexOf('data-testid=\'support-primary-operation\'')).toBeLessThan(supportForm.indexOf('operation === \'inspect\''))
    expect(supportForm.indexOf('data-testid=\'support-secondary-operations\'')).toBeLessThan(supportForm.indexOf('operation === \'impersonation\''))
    expect(supportForm).toContain('aria-pressed={active}')
    expect(supportForm).toContain('onClick={() => setOperation(tab.id)}')
})

test('helpdesk renders search first with filters and support actions collapsed', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'name', value: 'Render Proof', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: origin },
        { name: 'name', value: 'Render Proof', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: 'localhost', path: '/' },
        { name: 'name', value: 'Render Proof', domain: '127.0.0.1', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: '127.0.0.1', path: '/' },
    ])

    await page.goto('/dashboard/system/impersonation', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Helpdesk operations' })).toBeVisible()
    await expect(page.getByPlaceholder('Search audit events')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByText('Filters', { exact: true })).toBeVisible()
    await expect(page.getByText('Secondary support actions')).toBeVisible()

    await expect(page.getByPlaceholder('Organization', { exact: true })).toBeHidden()
    await expect(page.getByRole('group', { name: 'Support operation' })).toBeHidden()
    await expect(page.getByText('Support inspection')).toBeHidden()
    await expect(page.getByText('support.organization.access_recovery')).toBeHidden()
    await expect(page.getByRole('link', { name: 'Access recovery' })).toBeVisible()

    await page.getByText('Filters', { exact: true }).click()
    await expect(page.getByPlaceholder('Organization', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Actor')).toBeVisible()

    await page.getByText('Secondary support actions').click()
    await expect(page.getByTestId('support-primary-operation')).toBeVisible()
    await expect(page.getByText('Support inspection')).toBeVisible()
    await expect(page.getByText('Privileged support actions')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Support operation' })).toBeHidden()
    await expect(page.getByRole('button', { name: /Session/ })).toBeHidden()

    await page.getByText('Privileged support actions').click()
    await expect(page.getByRole('group', { name: 'Support operation' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Session/ })).toBeVisible()
})

test('start session CTA opens the support panel on the scoped session flow', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'name', value: 'Render Proof', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), url: origin },
        { name: 'name', value: 'Render Proof', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: 'localhost', path: '/' },
        { name: 'name', value: 'Render Proof', domain: '127.0.0.1', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(['system_admin'])), domain: '127.0.0.1', path: '/' },
    ])

    await page.goto('/dashboard/system/impersonation?support=impersonation#support-actions', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Secondary support actions')).toBeVisible()
    await expect(page.getByTestId('support-primary-operation')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Support operation' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Session/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Scoped impersonation')).toBeVisible()
    await expect(page.getByPlaceholder('Target user id')).toBeVisible()
    await expect(page.getByText('Support inspection')).toBeHidden()
})
