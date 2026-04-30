import { getMailAccess } from './accounts.ts'
import { mailConfig } from './config.ts'
import { sendMailViaSmtp } from './smtp.ts'

export async function sendSystemMail(params: {
    to: string
    subject: string
    textBody: string
    htmlBody?: string
}) {
    const access = await getMailAccess(mailConfig.systemMailboxOwner)
    const from = `noreply@${mailConfig.domain}`

    await sendMailViaSmtp({
        username: access.username,
        password: access.password,
        from: { email: from, name: 'Hanasand' },
        to: [{ email: params.to }],
        subject: params.subject,
        textBody: params.textBody,
        htmlBody: params.htmlBody,
    })
}
