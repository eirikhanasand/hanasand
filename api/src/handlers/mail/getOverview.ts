import { MailAccessDenied } from '#utils/mail/shared.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { getMailAccess, listAccessibleMailAccounts, rotateMailPasswordForUser } from '#utils/mail/accounts.ts'
import { applyMailRules, listMailRules } from '#utils/mail/filters.ts'
import { getMailHealth } from '#utils/mail/health.ts'
import { getMailboxList, getMessage, listMessages } from '#utils/mail/jmap.ts'
import { mailConfig } from '#utils/mail/config.ts'
import { listRecentRecipients } from '#utils/mail/recentRecipients.ts'
import { addressForUser } from '#utils/mail/helpers.ts'

const MAIL_OVERVIEW_TIMEOUT_MS = Number(process.env.MAIL_OVERVIEW_TIMEOUT_MS || 6500)

export default async function getMailOverview(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const query = req.query as { mailboxUser?: string, mailboxId?: string, messageId?: string }
        const access = await getMailAccess(id, query.mailboxUser)
        const accessibleAccounts = await listAccessibleMailAccounts(id)
        const accountCounts = loadAccountCounts(id, accessibleAccounts, access.targetUser)
        const recentRecipients = await listRecentRecipients(id, access.targetUser)
        const health = await withDeadline(getMailHealth(), 3500, null).catch(error => {
            req.log.warn({ error }, 'Failed to collect mail health checks')
            return null
        })
        const overviewData = await withDeadline(loadMailboxOverviewData({
            actorId: id,
            access,
            query,
            health,
            accessibleAccounts,
            recentRecipients,
            onRepair: error => req.log.warn({ error, userId: access.targetUser }, 'Stored mail credentials failed; rotating mailbox secret'),
            onRulesError: error => req.log.warn({ error }, 'Failed to apply mail rules'),
        }), MAIL_OVERVIEW_TIMEOUT_MS, null)

        if (!overviewData) {
            req.log.warn({ userId: access.targetUser, timeoutMs: MAIL_OVERVIEW_TIMEOUT_MS }, 'Mail overview timed out; returning degraded payload')
            return res
                .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
                .send(degradedMailOverview({
                    id,
                    targetUser: access.targetUser,
                    address: access.address,
                    canAccessAnyMailbox: access.canAccessAnyMailbox,
                    accessibleAccounts,
                    recentRecipients,
                    health,
                    detail: `Mailbox service did not respond within ${MAIL_OVERVIEW_TIMEOUT_MS}ms. Message and folder actions are temporarily paused.`,
                }))
        }

        overviewData.accessibleAccounts = await accountCounts
        return res
            .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
            .send(overviewData)
    } catch (error) {
        if (error instanceof MailAccessDenied) return res.status(403).send({ error: error.message })
        const query = req.query as { mailboxUser?: string }
        if (isMailSetupUnavailable(error)) {
            const targetUser = query.mailboxUser || id
            const address = addressForUser(targetUser)
            return res
                .header('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
                .send(degradedMailOverview({
                    id,
                    targetUser,
                    address,
                    canAccessAnyMailbox: false,
                    accessibleAccounts: [{ id: targetUser, name: targetUser, address }],
                    recentRecipients: [],
                    health: null,
                    detail: 'Mail administration is not configured on this environment.',
                    healthId: 'mail-admin',
                    healthLabel: 'Mail setup',
                }))
        }
        req.log.error(error)
        return res.status(500).send({ error: error instanceof Error ? error.message : 'Unable to load mailbox.' })
    }
}

type MailAccess = Awaited<ReturnType<typeof getMailAccess>>

async function loadMailboxOverviewData({
    actorId,
    access,
    query,
    health,
    accessibleAccounts,
    recentRecipients,
    onRepair,
    onRulesError,
}: {
    actorId: string
    access: MailAccess
    query: { mailboxUser?: string, mailboxId?: string, messageId?: string }
    health: Awaited<ReturnType<typeof getMailHealth>> | null
    accessibleAccounts: Awaited<ReturnType<typeof listAccessibleMailAccounts>>
    recentRecipients: Awaited<ReturnType<typeof listRecentRecipients>>
    onRepair: (error: Error) => void
    onRulesError: (error: Error) => void
}) {
    const { access: repairedAccess, mailboxData } = await repairMailAccessIfNeeded(access, onRepair)
    const inboxMailbox = mailboxData.mailboxes.find(mailbox => mailbox.role === 'inbox') || mailboxData.mailboxes[0]
    if (!inboxMailbox) {
        return {
            actor: { id: actorId, canAccessAnyMailbox: access.canAccessAnyMailbox, canSend: access.canSend },
            mailboxUser: repairedAccess.targetUser,
            mailboxAddress: repairedAccess.address,
            accessibleAccounts,
            mailboxes: [],
            selectedMailboxId: null,
            messages: [],
            selectedMessage: null,
            filters: [],
            recentRecipients,
            health,
            settings: settingsFor(repairedAccess),
        }
    }

    await applyMailRules({
        userId: repairedAccess.targetUser,
        username: repairedAccess.username,
        password: repairedAccess.password,
        inboxMailboxId: inboxMailbox.id,
        junkMailboxId: mailboxData.mailboxes.find(mailbox => mailbox.role === 'junk')?.id || null,
        mailboxAddress: repairedAccess.address,
    }).catch(onRulesError)

    const refreshedMailboxData = await getMailboxList(repairedAccess.username, repairedAccess.password)
    const selectedMailboxId = query.mailboxId
        || refreshedMailboxData.mailboxes.find(mailbox => mailbox.role === (access.targetUser === 'shared:noreply' ? 'sent' : 'inbox'))?.id
        || refreshedMailboxData.mailboxes[0]?.id
        || null
    const messages = selectedMailboxId ? await listMessages(repairedAccess.username, repairedAccess.password, selectedMailboxId) : []
    const selectedMessageId = query.messageId || messages[0]?.id
    const selectedMessage = selectedMessageId ? await getMessage(repairedAccess.username, repairedAccess.password, selectedMessageId) : null
    const filters = await listMailRules(repairedAccess.targetUser)

    return {
        actor: { id: actorId, canAccessAnyMailbox: repairedAccess.canAccessAnyMailbox, canSend: repairedAccess.canSend },
        mailboxUser: repairedAccess.targetUser,
        mailboxAddress: repairedAccess.address,
        accessibleAccounts,
        mailboxes: refreshedMailboxData.mailboxes,
        selectedMailboxId,
        messages,
        selectedMessage,
        filters,
        recentRecipients,
        health,
        settings: settingsFor(repairedAccess),
    }
}

export function withDeadline<T>(work: Promise<T>, timeoutMs: number, fallback: T) {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => resolve(fallback), timeoutMs)
        work.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
    })
}

async function repairMailAccessIfNeeded(access: MailAccess, onRepair: (error: Error) => void) {
    try {
        const mailboxData = await getMailboxList(access.username, access.password)
        return { access, mailboxData }
    } catch (error) {
        if (!isMailAuthError(error)) {
            throw error
        }
        onRepair(error as Error)
        if (access.targetUser.startsWith('shared:')) throw error
        const repaired = await rotateMailPasswordForUser(access.targetUser, access.targetUser)
        const repairedAccess = { ...access, username: repaired.username, address: repaired.address, password: repaired.password }
        return { access: repairedAccess, mailboxData: await getMailboxList(repairedAccess.username, repairedAccess.password) }
    }
}

export function degradedMailOverview({
    id,
    targetUser,
    address,
    canAccessAnyMailbox,
    accessibleAccounts,
    recentRecipients,
    health,
    detail,
    healthId = 'mail-overview-timeout',
    healthLabel = 'Mailbox service',
}: {
    id: string
    targetUser: string
    address: string
    canAccessAnyMailbox: boolean
    accessibleAccounts: Awaited<ReturnType<typeof listAccessibleMailAccounts>>
    recentRecipients: Awaited<ReturnType<typeof listRecentRecipients>>
    health: Awaited<ReturnType<typeof getMailHealth>> | null
    detail: string
    healthId?: string
    healthLabel?: string
}) {
    return {
        actor: { id, canAccessAnyMailbox, canSend: false },
        mailboxUser: targetUser,
        mailboxAddress: address,
        accessibleAccounts,
        mailboxes: [],
        selectedMailboxId: null,
        messages: [],
        selectedMessage: null,
        filters: [],
        recentRecipients,
        health: {
            status: 'warning' as const,
            checkedAt: new Date().toISOString(),
            queueDepth: health?.queueDepth || 0,
            smtpBannerLatencyMs: health?.smtpBannerLatencyMs ?? null,
            checks: [
                {
                    id: healthId,
                    label: healthLabel,
                    status: 'warning' as const,
                    detail,
                },
                ...(health?.checks || []),
            ],
        },
        settings: settingsFor({ username: address, address }),
    }
}

function isMailAuthError(error: unknown) {
    return error instanceof Error && /\b401\b/.test(error.message)
}

function isMailSetupUnavailable(error: unknown) {
    return error instanceof Error && error.message.includes('MAIL_ADMIN_PASSWORD is required')
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

const unreadCache = new Map<string, { at: number, count: number }>()
async function loadAccountCounts(actorId: string, accounts: Awaited<ReturnType<typeof listAccessibleMailAccounts>>, selected: string) {
    return Promise.all(accounts.map(async account => {
        if (!account.shared && account.id !== actorId && account.id !== selected) return { ...account, unreadCount: null }
        const cached = unreadCache.get(account.id)
        if (cached && Date.now() - cached.at < 10_000) return { ...account, unreadCount: cached.count }
        const unreadCount = await withDeadline((async () => {
            const access = await getMailAccess(actorId, account.id)
            const { mailboxes } = await getMailboxList(access.username, access.password)
            const count = mailboxes.filter(mailbox => mailbox.role === 'inbox').reduce((sum, mailbox) => sum + (mailbox.unreadEmails || 0), 0)
            if (unreadCache.size > 500) unreadCache.clear()
            unreadCache.set(account.id, { at: Date.now(), count })
            return count
        })().catch(() => null), 3000, null)
        return { ...account, unreadCount }
    }))
}
