import { describeDevice, escapeHtml } from './securityMail.ts'

export function passwordChangedMail(input: {
    id: string
    changedAt: string | Date
    ip: string
    userAgent: string
}) {
    const changedAt = new Date(input.changedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    const details = [
        ['Changed', changedAt],
        ['Browser / device', describeDevice(input.userAgent)],
        ['IP address', input.ip || 'Unavailable'],
    ]
    const introduction = `The password for your Hanasand account (@${input.id}) was changed.`
    const recovery = 'If you made this change, no action is needed. If this wasn’t you, secure your account now by resetting your password from the login page. If you can’t access your account, contact Hanasand support.'
    const loginUrl = 'https://hanasand.com/login'

    return {
        subject: 'Your Hanasand password was changed',
        textBody: `${introduction}\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${recovery}\n\nSecure your account: ${loginUrl}`,
        htmlBody: `<h1>Password changed</h1><p>${escapeHtml(introduction)}</p><table>${details.map(([label, value]) => `<tr><th align="left" style="padding:4px 16px 4px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p>${escapeHtml(recovery)}</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#3151d5;color:#fff;border-radius:8px;text-decoration:none">Secure your account</a></p>`,
    }
}
