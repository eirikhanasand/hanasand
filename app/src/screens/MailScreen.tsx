import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import type { AppSettings, MailOverview, SavedMailboxConnection } from '../types'
import { createMailbox, fetchMailOverview, postMailAction } from '../lib/api'
import { GlassCard, LabeledInput, PillButton, Screen, SectionTitle } from '../components/ui'
import { spacing } from '../theme/tokens'

const demoOverview: MailOverview = {
    mailboxUser: 'demo',
    mailboxAddress: 'you@hanasand.com',
    accessibleAccounts: [{ id: 'demo', name: 'Primary', address: 'you@hanasand.com' }],
    mailboxes: [
        { id: 'inbox', name: 'Inbox', role: 'inbox', unreadEmails: 4 },
        { id: 'archive', name: 'Archive', role: 'archive', unreadEmails: 0 },
    ],
    selectedMailboxId: 'inbox',
    messages: [
        {
            id: '1',
            subject: 'Scanner export is ready',
            preview: 'Your multi-page PDF finished successfully.',
            receivedAt: new Date().toISOString(),
            from: [{ email: 'assistant@hanasand.com', name: 'Hanasand Assistant' }],
            to: [{ email: 'you@hanasand.com' }],
            hasAttachment: true,
            isRead: false,
            isFlagged: true,
        },
        {
            id: '2',
            subject: 'Server action completed',
            preview: 'The remote management plane reported a clean startup.',
            receivedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
            from: [{ email: 'infra@hanasand.com', name: 'Infra' }],
            to: [{ email: 'you@hanasand.com' }],
            hasAttachment: false,
            isRead: true,
            isFlagged: false,
        },
    ],
    selectedMessage: {
        id: '1',
        subject: 'Scanner export is ready',
        preview: 'Your multi-page PDF finished successfully.',
        receivedAt: new Date().toISOString(),
        from: [{ email: 'assistant@hanasand.com', name: 'Hanasand Assistant' }],
        to: [{ email: 'you@hanasand.com' }],
        hasAttachment: true,
        isRead: false,
        isFlagged: true,
        textBody: 'The latest batch scan is complete. Review the pages, then export or share the PDF when you are ready.',
        htmlBody: '',
    },
}

export function MailScreen({ settings, mailboxConnections, onSaveMailboxConnections }: { settings: AppSettings; mailboxConnections: SavedMailboxConnection[]; onSaveMailboxConnections: (items: SavedMailboxConnection[]) => void }) {
    const [overview, setOverview] = useState<MailOverview>(demoOverview)
    const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>('inbox')
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>('1')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [mailboxName, setMailboxName] = useState('')
    const [connectionLabel, setConnectionLabel] = useState('')
    const [connectionEmail, setConnectionEmail] = useState('')
    const [imapHost, setImapHost] = useState('imap.gmail.com')
    const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')

    useEffect(() => {
        void load()
    }, [selectedMailboxId, selectedMessageId])

    async function load() {
        if (!settings.authToken || !settings.userId) return
        setLoading(true)
        setError('')
        try {
            const next = await fetchMailOverview(settings, selectedMailboxId, selectedMessageId)
            setOverview(next)
            setSelectedMailboxId(next.selectedMailboxId)
            setSelectedMessageId(next.selectedMessage?.id || next.messages[0]?.id || null)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to load mailbox. Showing demo data instead.')
        } finally {
            setLoading(false)
        }
    }

    const selectedMessage = useMemo(() => overview.selectedMessage || overview.messages.find(item => item.id === selectedMessageId), [overview, selectedMessageId])

    async function action(type: 'archive' | 'trash' | 'read' | 'flag') {
        if (!selectedMessageId || !settings.authToken) return
        try {
            await postMailAction(settings, selectedMessageId, type)
            await load()
        } catch (cause) {
            Alert.alert('Mail action failed', cause instanceof Error ? cause.message : 'Unable to update the message.')
        }
    }

    async function addMailbox() {
        if (!mailboxName.trim() || !settings.authToken) return
        try {
            await createMailbox(settings, mailboxName.trim())
            setMailboxName('')
            await load()
        } catch (cause) {
            Alert.alert('Unable to create mailbox', cause instanceof Error ? cause.message : 'Request failed.')
        }
    }

    function saveConnection() {
        if (!connectionLabel.trim() || !connectionEmail.trim()) return
        onSaveMailboxConnections([
            {
                id: `${Date.now()}`,
                label: connectionLabel.trim(),
                email: connectionEmail.trim(),
                imapHost: imapHost.trim(),
                smtpHost: smtpHost.trim(),
            },
            ...mailboxConnections,
        ])
        setConnectionLabel('')
        setConnectionEmail('')
    }

    return (
        <Screen title='Mail' subtitle='A Gmail-like mobile inbox tuned for quick review, triage, and mailbox switching.'>
            <GlassCard>
                <SectionTitle eyebrow='Mailbox health' title={loading ? 'Refreshing…' : overview.mailboxAddress} body={error || 'The native view uses the Hanasand mail APIs when configured, and falls back to realistic demo content when offline.'} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                    {overview.mailboxes.map(box => (
                        <Pressable key={box.id} onPress={() => setSelectedMailboxId(box.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: box.id === selectedMailboxId ? 'rgba(113,231,209,0.36)' : 'rgba(255,255,255,0.12)', backgroundColor: box.id === selectedMailboxId ? 'rgba(113,231,209,0.12)' : 'rgba(255,255,255,0.04)' }}>
                            <Text style={{ color: '#f3f7fb', fontWeight: '600' }}>{box.name}{box.unreadEmails ? ` · ${box.unreadEmails}` : ''}</Text>
                        </Pressable>
                    ))}
                </View>
            </GlassCard>

            <GlassCard>
                <SectionTitle eyebrow='Inbox' title='Message list' body='Tap a message to preview it below. Keep the depth shallow, like mobile Gmail, but preserve the admin capabilities when needed.' />
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {overview.messages.map(message => (
                        <Pressable key={message.id} onPress={() => setSelectedMessageId(message.id)} style={{ borderRadius: 20, padding: 14, borderWidth: 1, borderColor: message.id === selectedMessageId ? 'rgba(138,167,255,0.35)' : 'rgba(255,255,255,0.1)', backgroundColor: message.id === selectedMessageId ? 'rgba(138,167,255,0.12)' : 'rgba(255,255,255,0.03)' }}>
                            <Text style={{ color: '#f3f7fb', fontWeight: message.isRead ? '600' : '800', marginBottom: 4 }}>{message.subject}</Text>
                            <Text style={{ color: 'rgba(243,247,251,0.7)', marginBottom: 6 }}>{message.preview}</Text>
                            <Text style={{ color: 'rgba(243,247,251,0.45)', fontSize: 12 }}>{message.from.map(item => item.name || item.email).join(', ')}</Text>
                        </Pressable>
                    ))}
                </View>
            </GlassCard>

            {selectedMessage && (
                <GlassCard>
                    <SectionTitle eyebrow='Reading pane' title={selectedMessage.subject} body={selectedMessage.from.map(item => item.name || item.email).join(', ')} />
                    <Text style={{ color: 'rgba(243,247,251,0.88)', lineHeight: 22, marginTop: spacing.md }}>{String('textBody' in selectedMessage ? selectedMessage.textBody : selectedMessage.preview)}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
                        <PillButton label='Mark read' onPress={() => action('read')} small />
                        <PillButton label='Flag' onPress={() => action('flag')} small />
                        <PillButton label='Archive' onPress={() => action('archive')} small />
                        <PillButton label='Trash' onPress={() => action('trash')} tone='danger' small />
                    </View>
                </GlassCard>
            )}

            <GlassCard>
                <SectionTitle eyebrow='Mailbox setup' title='Add folders and saved mailbox connections' body='Folder creation is live against the Hanasand API when auth is configured. External mailbox connectors are saved locally as quick profiles until backend sync is added.' />
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <LabeledInput label='New mailbox folder' value={mailboxName} onChangeText={setMailboxName} placeholder='Receipts, Travel, Clients…' />
                    <PillButton label='Create folder' onPress={addMailbox} />
                    <LabeledInput label='Connection label' value={connectionLabel} onChangeText={setConnectionLabel} placeholder='Work Gmail' />
                    <LabeledInput label='Mailbox email' value={connectionEmail} onChangeText={setConnectionEmail} placeholder='me@example.com' />
                    <LabeledInput label='IMAP host' value={imapHost} onChangeText={setImapHost} />
                    <LabeledInput label='SMTP host' value={smtpHost} onChangeText={setSmtpHost} />
                    <PillButton label='Save mailbox connector' onPress={saveConnection} tone='accent' />
                    {mailboxConnections.map(connection => (
                        <View key={connection.id} style={{ borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', gap: 4 }}>
                            <Text style={{ color: '#f3f7fb', fontWeight: '700' }}>{connection.label}</Text>
                            <Text style={{ color: 'rgba(243,247,251,0.66)' }}>{connection.email}</Text>
                            <Text style={{ color: 'rgba(243,247,251,0.46)', fontSize: 12 }}>{connection.imapHost} · {connection.smtpHost}</Text>
                        </View>
                    ))}
                </View>
            </GlassCard>
        </Screen>
    )
}
