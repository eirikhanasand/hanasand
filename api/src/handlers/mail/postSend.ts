import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { getMailAccess } from '#utils/mail/accounts.ts'
import { parseAddressInput } from '#utils/mail/helpers.ts'
import { listMessages, sendMessage, uploadAttachment } from '#utils/mail/jmap.ts'

type AttachmentBody = {
    name: string
    type: string
    contentBase64: string
}

type SendBody = {
    mailboxUser?: string
    to: string
    cc?: string
    bcc?: string
    replyTo?: string
    subject: string
    textBody: string
    htmlBody?: string
    attachments?: AttachmentBody[]
}

export default async function postSendMail(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = req.body as SendBody
    try {
        const access = await getMailAccess(id, body.mailboxUser)
        if (!body.to?.trim()) {
            return res.status(400).send({ error: 'A recipient is required.' })
        }
        if (!body.subject?.trim() && !body.textBody?.trim() && !(body.attachments || []).length) {
            return res.status(400).send({ error: 'Write a message, add a subject, or include an attachment before sending.' })
        }

        const attachments = await Promise.all((body.attachments || []).map(async (attachment) => {
            const uploaded = await uploadAttachment(access.username, access.password, attachment.name, attachment.type, attachment.contentBase64)
            return {
                blobId: uploaded.blobId,
                size: uploaded.size,
                type: uploaded.type || attachment.type,
                name: attachment.name,
            }
        }))

        const sendResult = await sendMessage({
            username: access.username,
            password: access.password,
            from: { email: access.address, name: access.targetUser },
            to: parseAddressInput(body.to),
            cc: parseAddressInput(body.cc || ''),
            bcc: parseAddressInput(body.bcc || ''),
            replyTo: parseAddressInput(body.replyTo || ''),
            subject: body.subject || '(No subject)',
            textBody: body.textBody,
            htmlBody: body.htmlBody,
            attachments,
        })

        const sentMessages = sendResult.sentMailboxId
            ? await listMessages(access.username, access.password, sendResult.sentMailboxId, 1).catch(() => [])
            : []

        return res
            .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
            .status(201)
            .send({
                ok: true,
                mailboxUser: access.targetUser,
                sentMailboxId: sendResult.sentMailboxId,
                sentMessageId: sentMessages[0]?.id || null,
            })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: error instanceof Error ? error.message : 'Unable to send mail.' })
    }
}
