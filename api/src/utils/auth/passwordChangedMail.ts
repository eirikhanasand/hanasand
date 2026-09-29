import { describeDevice, escapeHtml } from './securityMail.ts'

export function passwordChangedMail(input: {
    id: string
    changedAt: string | Date
    ip: string
    userAgent: string
    lockToken: string
    resetToken: string
}) {
    const changedAt = new Date(input.changedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    const details = [
        ['Changed', changedAt],
        ['Browser / device', describeDevice(input.userAgent)],
        ['IP address', input.ip || 'Unavailable'],
    ]
    const introduction = `The password for your Hanasand account (@${input.id}) was changed.`
    const recovery = 'If you made this change, no action is needed. If this wasn’t you, lock your account or choose a new password using one of the links below. They expire in 24 hours.'
    const lockUrl = `https://hanasand.com/secure-account#token=${encodeURIComponent(input.lockToken)}`
    const resetUrl = `https://hanasand.com/reset-password-again#token=${encodeURIComponent(input.resetToken)}`

    return {
        subject: 'Your Hanasand password was changed',
        textBody: `${introduction}\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${recovery}\n\nWasn’t you? Lock your account: ${lockUrl}\nReset your password again: ${resetUrl}`,
        htmlBody: `<h1>Password changed</h1><p>${escapeHtml(introduction)}</p><table>${details.map(([label, value]) => `<tr><th align="left" style="padding:4px 16px 4px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p>${escapeHtml(recovery)}</p><p><a href="${lockUrl}" style="display:inline-block;padding:12px 20px;background:#b42318;color:#fff;border-radius:8px;text-decoration:none">Wasn’t you? Lock your account</a></p><p><a href="${resetUrl}">Reset your password again</a></p>`,
    }
}
