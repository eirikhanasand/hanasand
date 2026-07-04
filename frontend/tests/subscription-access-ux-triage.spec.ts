import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('subscription page makes access upgrade and enterprise review paths explicit', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/subscription/page.tsx'), 'utf8')

    expect(page).toContain('title=\'Enable product access\'')
    expect(page).toContain('data-subscription-primary-flow')
    expect(page).toContain('Recommended next')
    expect(page).toContain('Move from trial checks to routed response')
    expect(page).toContain('data-subscription-primary-action')
    expect(page).toContain('href=\'/contact?intent=subscribe-response\'')
    expect(page).toContain('href=\'/trust\'')

    expect(page).toContain('Workspace entitlements')
    expect(page).toContain('href: \'/dashboard/automations\'')
    expect(page).toContain('href: \'/dashboard/load-testing\'')
    expect(page).toContain('href: \'/dashboard/system/rate-limits\'')

    expect(page).toContain('data-subscription-enterprise-review')
    expect(page).toContain('Enterprise review packet')
    expect(page).toContain('data-subscription-enterprise-review-items')
    expect(page).toContain('label: \'Security review\', value: \'Trust artifacts\', href: \'/trust\'')
    expect(page).toContain('label: \'Commercial path\', value: \'Talk to sales\', href: \'/contact?intent=enterprise-procurement\'')
    expect(page).toContain('label: \'Admin controls\', value: \'Organizations\', href: \'/organizations\'')
    expect(page).toContain('label: \'Delivery proof\', value: \'Webhook history\', href: \'/dashboard/automations\'')

    expect(page.indexOf('data-subscription-primary-flow')).toBeLessThan(page.indexOf('<section className=\'grid gap-3 xl:grid-cols-3\'>'))
    expect(page.indexOf('data-subscription-enterprise-review')).toBeGreaterThan(page.indexOf('Workspace entitlements'))
})
