import { expect, test } from 'bun:test'
import { passwordChangedMail } from '../src/utils/auth/passwordChangedMail.ts'

test('password change notification explains the change and provides a safe recovery link', () => {
    const message = passwordChangedMail({
        id: '<script>alert(1)</script>',
        changedAt: '2026-09-29T12:34:00.000Z',
        ip: '198.51.100.24',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/17.0 Safari/605.1.15',
        lockToken: 'lock-token',
        resetToken: 'reset-token',
    })

    expect(message.subject).toBe('Your Hanasand password was changed')
    expect(message.textBody).toContain('If this wasn’t you, lock your account')
    expect(message.textBody).toContain('Browser / device: Safari on Mac')
    expect(message.textBody).toContain('IP address: 198.51.100.24')
    expect(message.textBody).toContain('https://hanasand.com/secure-account#token=lock-token')
    expect(message.textBody).toContain('https://hanasand.com/reset-password-again#token=reset-token')
    expect(message.htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(message.htmlBody).not.toContain('<script>')
    expect(message.htmlBody).toContain('>Wasn’t you? Lock your account</a>')
    expect(message.htmlBody).toContain('>Reset your password again</a>')
})
