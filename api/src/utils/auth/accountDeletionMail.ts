import { sessionNetwork } from './sessionNetwork.ts'
import { describeDevice, escapeHtml } from './securityMail.ts'

export async function deletionRequestLocation(ip: string) {
    return sessionNetwork(ip).catch(() => ({ ip, network: null }))
}

export function accountDeletionMail(input: {
    id: string
    deletionScheduledAt: string | Date
    requestedAt: string | Date
    restoreToken: string
    ip: string
    userAgent: string
    country?: string | null
    city?: string | null
}) {
    const url = new URL('https://hanasand.com/account-pending-deletion')
    url.searchParams.set('id', input.id)
    url.searchParams.set('deletionScheduledAt', new Date(input.deletionScheduledAt).toISOString())
    // Fragments stay in the browser, outside request logs and referrer headers.
    url.hash = new URLSearchParams({ restoreToken: input.restoreToken }).toString()
    const date = (value: string | Date) => new Date(value).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    const details = [
        ['Requested', date(input.requestedAt)],
        ['Browser / device', describeDevice(input.userAgent)],
        ['IP address', input.ip || 'Unavailable'],
        ['Country', input.country || 'Unavailable'],
        ['City', input.city || 'Unavailable'],
    ]
    const introduction = `Your Hanasand account (@${input.id}) is scheduled for deletion on ${date(input.deletionScheduledAt)}.`
    const recovery = 'Changed your mind? Restore your account before this date to cancel deletion. If this wasn’t you, restore your account and change your password.'
    return {
        subject: 'Your Hanasand account is scheduled for deletion',
        textBody: `${introduction}\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\nLocation is approximate.\n\n${recovery}\n\nRestore account: ${url.href}`,
        htmlBody: `<h1>Account scheduled for deletion</h1><p>${escapeHtml(introduction)}</p><table>${details.map(([label, value]) => `<tr><th align="left" style="padding:4px 16px 4px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p>Location is approximate.</p><p>${escapeHtml(recovery)}</p><p><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:12px 20px;background:#3151d5;color:#fff;border-radius:8px;text-decoration:none">Restore account</a></p>`,
    }
}
