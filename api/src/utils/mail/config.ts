import crypto from 'node:crypto'

const mailHost = process.env.MAIL_HOST || 'mail.hanasand.com'
const mailInternalUrl = process.env.MAIL_INTERNAL_URL || process.env.MAIL_JMAP_INTERNAL_URL || 'http://127.0.0.1:8081'
const mailAdminUser = process.env.MAIL_ADMIN_USERNAME || 'admin'
const mailAdminPassword = process.env.MAIL_ADMIN_PASSWORD || ''
const mailDomain = process.env.MAIL_DOMAIN || 'hanasand.com'
const serviceKeySource = process.env.MAIL_SERVICE_KEY || process.env.VM_API_TOKEN || process.env.DB_PASSWORD || ''
const mailUserAliases = new Map(
    (process.env.MAIL_USER_ALIASES || 'eirikhanasand:eirik')
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean)
        .map(entry => {
            const [userId, mailboxUser] = entry.split(':').map(value => value.trim())
            return [userId, mailboxUser || userId]
        })
)

export const mailConfig = {
    host: mailHost,
    domain: mailDomain,
    internalUrl: mailInternalUrl,
    adminUser: mailAdminUser,
    adminPassword: mailAdminPassword,
    imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
    smtpPort: Number(process.env.MAIL_SMTP_PORT || 587),
    managesievePort: Number(process.env.MAIL_MANAGESIEVE_PORT || 4190),
    encryptionKey: crypto.createHash('sha256').update(serviceKeySource).digest(),
    userAliases: mailUserAliases,
    privilegedMailboxUsers: new Set(
        (process.env.MAIL_PRIVILEGED_USERS || 'admin,administrator,eirik,eirikhanasand')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
    ),
}

export function requireMailAdminConfig() {
    if (!mailConfig.adminPassword) {
        throw new Error('MAIL_ADMIN_PASSWORD is required for mail administration.')
    }

    return mailConfig
}
