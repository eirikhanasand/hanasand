import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('webhook delivery console keeps setup and ledgers behind disclosures', async () => {
    const source = await readFile(path.join(root, 'src/app/dashboard/WebhookDeliveryConsole.tsx'), 'utf8')

    expect(source).toContain('Delivery routes')
    expect(source).toContain('deliveryHeadline')
    expect(source).toContain('Add or edit destination')
    expect(source).toContain('Dry-run payload')
    expect(source).toContain('Delivery history')
    expect(source).toContain('<details className=')
    expect(source).toContain('submitDestination')
    expect(source).toContain('testDestination')
    expect(source).toContain('setDestinationStatus')
    expect(source).toContain('buildPreview')
    expect(source).toContain('requestJson<RequestResult>')
    expect(source).not.toContain('What returned')
})
