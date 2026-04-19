import run from '#db'
import { ensureMailbox, getMessage, listInboxMessagesForFiltering, moveMessage } from './jmap.ts'
import { type MailRule } from './types.ts'

export async function listMailRules(userId: string) {
    const response = await run('SELECT * FROM mail_filters WHERE user_id = $1 ORDER BY priority ASC, id ASC', [userId])
    return response.rows as MailRule[]
}

export async function createMailRule(userId: string, input: Omit<MailRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    const response = await run(`
        INSERT INTO mail_filters (user_id, name, enabled, criteria, action, priority)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE((SELECT MAX(priority) + 1 FROM mail_filters WHERE user_id = $1), 1))
        RETURNING *
    `, [userId, input.name, input.enabled, JSON.stringify(input.criteria), JSON.stringify(input.action)])

    return response.rows[0] as MailRule
}

export async function deleteMailRule(userId: string, ruleId: string) {
    await run('DELETE FROM mail_filters WHERE user_id = $1 AND id = $2', [userId, ruleId])
}

export async function applyMailRules(params: { userId: string, username: string, password: string, inboxMailboxId: string }) {
    const rules = await listMailRules(params.userId)
    const activeRules = rules.filter(rule => rule.enabled && rule.criteria.contains.trim())
    if (!activeRules.length) {
        return
    }

    const inboxMessages = await listInboxMessagesForFiltering(params.username, params.password, params.inboxMailboxId)
    for (const summary of inboxMessages) {
        const message = await getMessage(params.username, params.password, summary.id)
        if (!message) {
            continue
        }

        for (const rule of activeRules) {
            if (matchesRule(message, rule)) {
                const mailboxId = await ensureMailbox(params.username, params.password, rule.action.mailboxName)
                if (!mailboxId) {
                    continue
                }

                await moveMessage(
                    params.username,
                    params.password,
                    message.id,
                    mailboxId,
                    rule.action.markRead ? { '$seen': true } : {}
                )
                break
            }
        }
    }
}

function matchesRule(message: NonNullable<Awaited<ReturnType<typeof getMessage>>>, rule: MailRule) {
    const needle = rule.criteria.contains.toLowerCase().trim()
    if (!needle) {
        return false
    }

    if (rule.criteria.field === 'from') {
        return message.from.some(from => `${from.name || ''} ${from.email}`.toLowerCase().includes(needle))
    }

    if (rule.criteria.field === 'subject') {
        return message.subject.toLowerCase().includes(needle)
    }

    if (rule.criteria.field === 'body') {
        return message.textBody.toLowerCase().includes(needle) || message.preview.toLowerCase().includes(needle)
    }

    if (rule.criteria.field === 'senderDomain') {
        return message.from.some(from => from.email.toLowerCase().split('@')[1]?.includes(needle))
    }

    return false
}
