import { describe, expect, test } from 'bun:test'
import { applyContactSender } from '../src/utils/mail/contactSender.ts'

const contact = { ticket_id: 'HS-20260820-0D198785', name: 'Christopher Hughes', email: 'christopher@example.com', subject: 'Monitoring reports' }
function message() {
    return {
        subject: `[${contact.ticket_id}] ${contact.subject}`,
        from: [{ email: 'noreply@hanasand.com', name: 'Hanasand' }],
        replyTo: [{ email: 'attacker@example.net' }],
        textBody: [{ partId: '1' }],
        bodyValues: { '1': { value: `Ticket: ${contact.ticket_id}\r\nName: ${contact.name}\r\nEmail: ${contact.email}\r\nCompany: Example` } },
    }
}
describe('contact notification attribution', () => {
    test('shows the persisted external submitter and replies to them without changing stored mail', () => {
        const mail = message()
        applyContactSender(mail, contact)
        expect(mail.from).toEqual([{ email: contact.email, name: `${contact.name} (via contact form; unverified)` }])
        expect(mail.replyTo).toEqual([{ email: contact.email, name: contact.name }])
    })
    test('does not trust a Reply-To, a ticket subject alone, or a claimed local address', () => {
        for (const altered of [
            { ...message(), from: [{ email: 'attacker@example.com' }] },
            { ...message(), subject: `[${contact.ticket_id}] Other subject` },
            { ...message(), bodyValues: { '1': { value: 'Unrelated content' } } },
        ]) {
            const before = structuredClone(altered)
            applyContactSender(altered, contact)
            expect(altered).toEqual(before)
        }
        const mail = message()
        applyContactSender(mail, { ...contact, email: 'eirik@hanasand.com' })
        expect(mail.from[0].email).toBe('noreply@hanasand.com')
    })
})
