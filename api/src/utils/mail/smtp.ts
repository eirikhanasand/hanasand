import nodemailer from 'nodemailer'
import { mailConfig } from './config.ts'
import type { MailAddress } from './types.ts'

type SmtpAttachment = {
    name: string
    type: string
    contentBase64: string
}

export async function sendMailViaSmtp(params: {
    username: string
    password: string
    from: MailAddress
    to: MailAddress[]
    cc?: MailAddress[]
    bcc?: MailAddress[]
    replyTo?: MailAddress[]
    subject: string
    textBody: string
    htmlBody?: string
    attachments?: SmtpAttachment[]
}) {
    const smtpHost = getInternalSmtpHost()
    const transport = nodemailer.createTransport({
        host: smtpHost,
        port: mailConfig.smtpPort,
        secure: false,
        requireTLS: true,
        auth: {
            user: params.username,
            pass: params.password,
        },
        tls: {
            servername: mailConfig.host,
        },
    })

    await transport.sendMail({
        from: formatAddress(params.from),
        to: params.to.map(formatAddress),
        cc: (params.cc || []).map(formatAddress),
        bcc: (params.bcc || []).map(formatAddress),
        replyTo: (params.replyTo || []).map(formatAddress),
        subject: params.subject,
        text: params.textBody,
        html: params.htmlBody,
        attachments: (params.attachments || []).map(attachment => ({
            filename: attachment.name,
            contentType: attachment.type,
            content: Buffer.from(attachment.contentBase64, 'base64'),
        })),
    })
}

function formatAddress(address: MailAddress) {
    return address.name ? `${address.name} <${address.email}>` : address.email
}

function getInternalSmtpHost() {
    try {
        return new URL(mailConfig.internalUrl).hostname || mailConfig.host
    } catch {
        return mailConfig.host
    }
}
