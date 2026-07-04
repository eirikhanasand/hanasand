import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('public workflow reliability contracts are not demo-only', async () => {
    const pwnedClient = await readFile(path.join(root, 'src/utils/pwned/checkPassword.ts'), 'utf8')
    const pwnedRoute = await readFile(path.join(root, 'src/app/api/pwned/route.ts'), 'utf8')
    const pwnedPage = await readFile(path.join(root, 'src/app/pwned/pageClient.tsx'), 'utf8')
    const contact = await readFile(path.join(root, 'src/components/contact/contact.tsx'), 'utf8')
    const contactRoute = await readFile(path.join(root, 'src/app/api/contact/route.ts'), 'utf8')
    const dwmPage = await readFile(path.join(root, 'src/app/solutions/dwm/pageClient.tsx'), 'utf8')

    expect(pwnedClient).toContain('window.crypto.subtle.digest(\'SHA-1\'')
    expect(pwnedClient).toContain('body: JSON.stringify({ prefix })')
    expect(pwnedClient).not.toContain('body: JSON.stringify({ password })')
    expect(pwnedRoute).toContain('A valid SHA-1 hash prefix is required.')
    expect(pwnedRoute).not.toContain('password =')
    expect(pwnedPage).toContain('setPassword(\'\')')
    expect(pwnedPage).toContain('without sending the password or full hash')

    expect(contact).toContain('fetch(\'/api/contact\'')
    expect(contact).toContain('Ticket <span')
    expect(contact).toContain('data-contact-intake-routing')
    expect(contact).toContain('data-contact-security-review')
    expect(contact).toContain('deliveryPreference: values.deliveryPreference')
    expect(contact).toContain('securityReview: values.securityReview')
    expect(contact).not.toContain('window.location.href = mailtoLink')
    expect(contactRoute).toContain('ticketId')
    expect(contactRoute).toContain('CONTACT_FORWARD_URL')
    expect(contactRoute).toContain('deliveryPreference')
    expect(contactRoute).toContain('securityReview')
    expect(contactRoute).toContain('security review material')

    expect(dwmPage).toContain('fetch(\'/api/dwm/webhook-sink\'')
    expect(dwmPage).toContain('Test sample delivery')
    expect(dwmPage).toContain('Save draft')
    expect(dwmPage).not.toContain('window.location.assign(\'/dashboard/automations?setup=dwm\')')
})
