import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('mail reader keeps message actions primary and files messages through a disclosure', async () => {
    const source = await readFile(path.join(root, 'src/components/mail/mailWorkspace.tsx'), 'utf8')

    expect(source).toContain('data-mail-message-filing-disclosure')
    expect(source).toContain('Filing and read state')
    expect(source).toContain('Move, mark read, or mark unread')

    expect(source.indexOf('label=\'Reply\'')).toBeLessThan(source.indexOf('data-mail-message-filing-disclosure'))
    expect(source.indexOf('label=\'Archive\'')).toBeLessThan(source.indexOf('data-mail-message-filing-disclosure'))
    expect(source.indexOf('data-mail-message-filing-disclosure')).toBeLessThan(source.indexOf('<option value=\'\'>Move to…</option>'))
    expect(source.indexOf('data-mail-message-filing-disclosure')).toBeLessThan(source.indexOf('action: \'move\''))
    expect(source.indexOf('data-mail-message-filing-disclosure')).toBeLessThan(source.indexOf('selectedMessage.isRead ? \'unread\' : \'read\''))

    expect(source).toContain('await messageAction(selectedMessage.id, {')
    expect(source).toContain('await load({ mailboxId: moveTargetMailboxId, messageId: null, silent: true })')
    expect(source).toContain('void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isRead ? \'unread\' : \'read\')')
})
