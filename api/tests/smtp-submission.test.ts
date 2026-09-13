import { expect, test, mock } from 'bun:test'
let options: Record<string, unknown> = {}
let message: Record<string, unknown> = {}
mock.module('../src/utils/mail/config.ts', () => ({ mailConfig: { internalUrl: 'http://stalwart:8080', internalSmtpPort: 25, host: 'mail.hanasand.com' } }))
mock.module('nodemailer', () => ({ default: { createTransport: (config: Record<string, unknown>) => { options = config; return { sendMail: async (data: Record<string, unknown>) => { message = data; return { messageId: 'accepted', accepted: ['recipient@example.test'] } } } } } }))
const { sendMailViaSmtp } = await import('../src/utils/mail/smtp.ts')
test('legacy incoming port uses authenticated TLS submission for all system mail', async () => {
    const result = await sendMailViaSmtp({ username: 'sender', password: 'test-only', from: { email: 'sender@example.test' }, to: [{ email: 'recipient@example.test' }], subject: 'Account notification', textBody: 'Test' })
    expect(options).toMatchObject({ host: 'stalwart', port: 587, requireTLS: true, ignoreTLS: false, authMethod: 'LOGIN', tls: { servername: 'mail.hanasand.com' }, auth: { user: 'sender', pass: 'test-only' } })
    expect(message).toMatchObject({ subject: 'Account notification', text: 'Test' })
    expect(result.messageId).toBe('accepted')
})
