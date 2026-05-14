import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { getMailAccess } from '#utils/mail/accounts.ts'
import { isMailAdminConfigError, isMailServiceConnectionError, mailAdminUnavailablePayload, mailServiceUnavailablePayload } from '#utils/mail/config.ts'
import { downloadBlob } from '#utils/mail/jmap.ts'

export default async function getMailBlob(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const params = req.params as { mailboxUser: string, blobId: string, name: string }

    try {
        const access = await getMailAccess(id, params.mailboxUser)
        const response = await downloadBlob(access.username, access.password, params.blobId, params.name)
        const arrayBuffer = await response.arrayBuffer()
        const contentType = response.headers.get('content-type') || 'application/octet-stream'
        res.header('Content-Type', contentType)
        res.header('Cache-Control', 'private, max-age=60')
        return res.send(Buffer.from(arrayBuffer))
    } catch (error) {
        if (isMailAdminConfigError(error)) {
            return res.status(503).send(mailAdminUnavailablePayload())
        }

        if (isMailServiceConnectionError(error)) {
            return res.status(502).send(mailServiceUnavailablePayload('fetching the attachment'))
        }

        req.log.error(error)
        return res.status(500).send({ error: error instanceof Error ? error.message : 'Unable to fetch attachment.' })
    }
}
