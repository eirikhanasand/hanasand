import run from '../src/utils/db.ts'
import ensureSharedMailSchema from '../src/utils/db/sharedMailSchema.ts'
import { ensureMailAccountForUser } from '../src/utils/mail/accounts.ts'
import { mailConfig } from '../src/utils/mail/config.ts'
import { ensureMailbox, getMailboxList } from '../src/utils/mail/jmap.ts'
import { provisionSharedMailboxes, sharedMailAccess, sharedMailboxes } from '../src/utils/mail/shared.ts'

await ensureSharedMailSchema()
const owner = (await run('SELECT id, name FROM users WHERE id = $1', [mailConfig.systemMailboxOwner])).rows[0]
if (owner) await ensureMailAccountForUser(owner.id, owner.name)
await provisionSharedMailboxes()
for (const mailbox of sharedMailboxes) {
    const access = await sharedMailAccess(mailbox.id)
    await ensureMailbox(access.username, access.password, 'Inbox', 'inbox')
    await ensureMailbox(access.username, access.password, 'Sent', 'sent')
    const { mailboxes } = await getMailboxList(access.username, access.password)
    if (!mailboxes.some(folder => folder.role === 'inbox')) throw new Error(`${mailbox.name} inbox is missing.`)
    console.info(`${mailbox.name} mailbox ready.`)
}
process.exit(0)
