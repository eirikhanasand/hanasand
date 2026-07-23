import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('pricing and subscription use one truthful commercial access contract', async () => {
    const contract = await readFile(path.join(root, 'src/utils/commercialAccess.ts'), 'utf8')
    const pricing = await readFile(path.join(root, 'src/app/pricing/page.tsx'), 'utf8')
    const subscription = await readFile(path.join(root, 'src/app/dashboard/subscription/page.tsx'), 'utf8')
    const solutions = await readFile(path.join(root, 'src/app/solutions/page.tsx'), 'utf8')
    const loadTesting = await readFile(path.join(root, 'src/app/dashboard/load-testing/page.tsx'), 'utf8')
    const homepage = await readFile(path.join(root, 'src/app/page.tsx'), 'utf8')
    const contact = await readFile(path.join(root, 'src/components/contact/contact.tsx'), 'utf8')
    const trust = await readFile(path.join(root, 'src/app/trust/trustArtifacts.ts'), 'utf8')

    expect(pricing).toContain('import { commercialAccessPlans } from \'@/utils/commercialAccess\'')
    expect(subscription).toContain('import { commercialAccessPlans } from \'@/utils/commercialAccess\'')
    expect(contract).toContain('priceLabel: \'No card required\'')
    expect(contract).toContain('priceLabel: \'Sales scoped\'')
    expect(contract).toContain('Coverage and limits recorded in the order form')
    expect(pricing).toContain('Console evaluation is self-serve.')
    expect(contract).toContain('Organization-scoped 90-day API key')
    expect(contract).toContain('/register?path=%2Fdevelopers%23api-access')
    expect(subscription).toContain('Not a paid subscription')

    for (const unsupported of ['$49', '$149', '$399', '$499', '5 evaluation watch terms', '250 watched names', '1,500 watched names', 'Priority analyst review']) {
        expect(pricing).not.toContain(unsupported)
        expect(subscription).not.toContain(unsupported)
        expect(contract).not.toContain(unsupported)
    }
    for (const unsupported of ['$19/mo', '$79/mo', '$249/mo', 'Starter and team tiers', 'Bundled with monitoring', 'Slack, webhooks, cases', 'email, webhook, Slack/Jira/SIEM']) {
        expect(solutions).not.toContain(unsupported)
        expect(loadTesting).not.toContain(unsupported)
        expect(homepage).not.toContain(unsupported)
    }
    expect(contact).not.toContain('[\'email\', \'Email\']')
    expect(contact).not.toContain('webhook / email / API')
    expect(trust).not.toContain('webhook/API/email delivery')
    expect(trust).not.toContain('Delivery route: email')
})

test('contact requests use the durable idempotent API intake', async () => {
    const helper = await readFile(path.join(root, 'src/utils/contact/submitContactRequest.ts'), 'utf8')
    const api = await readFile(path.join(root, '../api/src/handlers/commercialContactRequests.ts'), 'utf8')
    const schema = await readFile(path.join(root, '../api/src/utils/db/ensureSchema.ts'), 'utf8')

    expect(helper).toContain('`${config.url.api}/commercial/contact-requests`')
    expect(helper).toContain('\'Idempotency-Key\': crypto.randomUUID()')
    expect(api).toContain('ON CONFLICT (idempotency_key) DO NOTHING')
    expect(api).toContain('idempotency_conflict')
    expect(api).toContain('sendSystemMail')
    expect(api).toContain('delivery: notificationStatus === \'notified\' ? \'notified\' : \'stored\'')
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS commercial_contact_requests')
})
