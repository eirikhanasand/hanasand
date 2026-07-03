import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('helpdesk audit keeps advanced controls behind explicit disclosures', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/page.tsx'), 'utf8')
    const supportForm = await readFile(path.join(root, 'src/app/dashboard/system/impersonation/accessRecoveryForm.tsx'), 'utf8')

    expect(page).toContain('<details className=\'group rounded-md border border-[#26344d] bg-[#0b121e]\'>')
    expect(page).toContain('Show advanced')
    expect(page).toContain('aria-label=\'Active audit filters\'')
    expect(page).toContain('href=\'#support-actions\'')
    expect(page).toContain('placeholder=\'Search audit events\'')
    expect(page).toContain('Start or manage support action')
    expect(page).toContain('Show controls')

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
