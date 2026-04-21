import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { getMailAccess, listAccessibleMailAccounts } from '#utils/mail/accounts.ts'
import { applyMailRules, listMailRules } from '#utils/mail/filters.ts'
import { getMailHealth } from '#utils/mail/health.ts'
import { getMailboxList, getMessage, listMessages } from '#utils/mail/jmap.ts'
import { mailConfig } from '#utils/mail/config.ts'

export default async function getMailOverview(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const query = req.query as { mailboxUser?: string, mailboxId?: string, messageId?: string }
        const access = await getMailAccess(id, query.mailboxUser)
        const accessibleAccounts = await listAccessibleMailAccounts(id)
        const health = await getMailHealth().catch(error => {
            req.log.warn({ error }, 'Failed to collect mail health checks')
            return null
        })
        const mailboxData = await getMailboxList(access.username, access.password)
        const inboxMailbox = mailboxData.mailboxes.find(mailbox => mailbox.role === 'inbox') || mailboxData.mailboxes[0]
        if (!inboxMailbox) {
            return res
                .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
                .send({
                actor: { id, canAccessAnyMailbox: access.canAccessAnyMailbox },
                mailboxUser: access.targetUser,
                mailboxAddress: access.address,
                mailPassword: access.password,
                accessibleAccounts,
                mailboxes: [],
                selectedMailboxId: null,
                messages: [],
                selectedMessage: null,
                filters: [],
                health,
                settings: settingsFor(access),
            })
        }

        await applyMailRules({
            userId: access.targetUser,
            username: access.username,
            password: access.password,
            inboxMailboxId: inboxMailbox.id,
            junkMailboxId: mailboxData.mailboxes.find(mailbox => mailbox.role === 'junk')?.id || null,
            mailboxAddress: access.address,
        }).catch(error => req.log.warn({ error }, 'Failed to apply mail rules'))

        const refreshedMailboxData = await getMailboxList(access.username, access.password)
        const selectedMailboxId = query.mailboxId
            || refreshedMailboxData.mailboxes.find(mailbox => mailbox.role === 'inbox')?.id
            || refreshedMailboxData.mailboxes[0]?.id
            || null
        const messages = selectedMailboxId ? await listMessages(access.username, access.password, selectedMailboxId) : []
        const selectedMessageId = query.messageId || messages[0]?.id
        const selectedMessage = selectedMessageId ? await getMessage(access.username, access.password, selectedMessageId) : null
        const filters = await listMailRules(access.targetUser)

        return res
            .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
            .send({
            actor: { id, canAccessAnyMailbox: access.canAccessAnyMailbox },
            mailboxUser: access.targetUser,
            mailboxAddress: access.address,
            mailPassword: access.password,
            accessibleAccounts,
            mailboxes: refreshedMailboxData.mailboxes,
            selectedMailboxId,
            messages,
            selectedMessage,
            filters,
            health,
            settings: settingsFor(access),
        })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: error instanceof Error ? error.message : 'Unable to load mailbox.' })
    }
}

function settingsFor(access: { username: string, address: string }) {
    return {
        host: mailConfig.host,
        imapHost: mailConfig.host,
        imapPort: mailConfig.imapPort,
        smtpHost: mailConfig.host,
        smtpPort: mailConfig.smtpPort,
        managesievePort: mailConfig.managesievePort,
        username: access.username,
        address: access.address,
    }
}
