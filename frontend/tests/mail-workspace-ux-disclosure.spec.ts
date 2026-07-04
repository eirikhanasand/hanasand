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

test('mail workspace uses shared dashboard chrome and compact operational geometry', async () => {
    const files = await Promise.all([
        readFile(path.join(root, 'src/components/mail/mailWorkspace.tsx'), 'utf8'),
        readFile(path.join(root, 'src/components/mail/mailWorkspaceParts.tsx'), 'utf8'),
        readFile(path.join(root, 'src/components/mail/utils.tsx'), 'utf8'),
    ])
    const workspace = files[0]
    const combined = files.join('\n')

    expect(workspace).toContain('DashboardHeader')
    expect(workspace).toContain('eyebrow=\'Communications\'')
    expect(workspace).toContain('id=\'mail-toolbar\'')
    expect(workspace).toContain('Read, triage, and send operational mail from one workspace.')
    expect(combined).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})
