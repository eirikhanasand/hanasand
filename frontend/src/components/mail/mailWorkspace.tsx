'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Archive,
    Clock3,
    CornerUpLeft,
    FolderInput,
    Forward,
    Inbox,
    MailPlus,
    PanelLeftClose,
    PanelLeftOpen,
    Radar,
    Reply,
    Search,
    Settings2,
    ShieldCheck,
    ShieldAlert,
    Star,
    Trash2,
} from 'lucide-react'
import {
    createFilter,
    createMailbox,
    deleteFilter,
    fetchMailOverview,
    messageAction,
    sendMail,
} from '@/utils/mail/client'
import type { MailMessageSummary, MailOverview } from '@/utils/mail/types'
import { DashboardHeader, DashboardPage, DashboardPanel, dashboardPanelClass } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import { Composer, MessageRow } from './mailWorkspaceParts'
import {
    ActionIconButton,
    AttachmentPreview,
    MailSketch,
    buildMailFrameHtml,
    composeFromReply,
    emptyComposer,
    formatDate,
    formatMailboxAddress,
    formatRelativeTime,
    iconButton,
    iconForMailbox,
    runAction,
    subtleInput,
    toolbarButton,
    withInlineAttachments,
    type ComposerState,
} from './utils'

type Props = {
    mailboxUser?: string | null
}

type MailListFilter = 'all' | 'unread' | 'starred' | 'attachments' | 'needsFiling'

const POLL_INTERVAL_MS = 10_000
const STALE_AFTER_MS = 5 * 60_000

export default function MailWorkspace({ mailboxUser }: Props) {
    const [overview, setOverview] = useState<MailOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [backgroundIssue, setBackgroundIssue] = useState('')
    const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
    const [moveTargetMailboxId, setMoveTargetMailboxId] = useState('')
    const [composer, setComposer] = useState<ComposerState>(emptyComposer)
    const [creatingMailbox, setCreatingMailbox] = useState(false)
    const [mailboxModalOpen, setMailboxModalOpen] = useState(false)
    const [mailboxDraft, setMailboxDraft] = useState('')
    const [creatingFilter, setCreatingFilter] = useState(false)
    const [movingMessage, setMovingMessage] = useState(false)
    const [sidebarCompact, setSidebarCompact] = useState(false)
    const [adminDrawerOpen, setAdminDrawerOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const [activeMailboxUser, setActiveMailboxUser] = useState<string | null>(mailboxUser || null)
    const [mailFilter, setMailFilter] = useState<MailListFilter>('all')

    const load = useCallback(async (params: {
        mailboxId?: string | null
        messageId?: string | null
        mailboxUser?: string | null
        silent?: boolean
    } = {}) => {
        const silent = Boolean(params.silent)

        try {
            if (!silent) {
                setLoading(true)
                setError('')
            }

            const next = await fetchMailOverview({
                mailboxUser: params.mailboxUser ?? activeMailboxUser ?? mailboxUser ?? undefined,
                mailboxId: params.mailboxId ?? selectedMailboxId,
                messageId: params.messageId ?? selectedMessageId,
            })

            setOverview(next)
            setActiveMailboxUser(next.mailboxUser)
            setSelectedMailboxId(next.selectedMailboxId)
            const nextSelectedMessageId = params.messageId
                || next.selectedMessage?.id
                || next.messages.find(message => message.id === selectedMessageId)?.id
                || next.messages[0]?.id
                || null
            setSelectedMessageId(nextSelectedMessageId)
            setMoveTargetMailboxId('')
            setBackgroundIssue('')
            setLastSuccessAt(Date.now())
        } catch (cause) {
            const rawMessage = cause instanceof Error ? cause.message : ''
            const message = /failed to fetch|networkerror|load failed/i.test(rawMessage)
                ? 'Mail is reconnecting. The rest of the console is still ready.'
                : rawMessage || 'Unable to load the mailbox.'
            if (silent) {
                setBackgroundIssue(message)
            } else {
                setError(message)
            }
        } finally {
            if (!silent) {
                setLoading(false)
            }
        }
    }, [activeMailboxUser, mailboxUser, selectedMailboxId, selectedMessageId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load({ mailboxUser, mailboxId: null, messageId: null })
        }, 0)

        return () => window.clearTimeout(timer)
    }, [load, mailboxUser])

    useEffect(() => {
        const poll = window.setInterval(() => {
            void load({ silent: true })
            setNow(Date.now())
        }, POLL_INTERVAL_MS)

        const onVisibilityChange = () => {
            setNow(Date.now())
            if (document.visibilityState === 'visible') {
                void load({ silent: true })
            }
        }

        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            window.clearInterval(poll)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [load])

    const filteredMessages = useMemo(() => {
        const needle = query.trim().toLowerCase()
        const messages = overview?.messages || []

        return messages.filter(message => {
            if (!messageMatchesMailFilter(message, mailFilter)) {
                return false
            }
            if (!needle) {
                return true
            }
            const haystack = [
                message.subject,
                message.preview,
                message.from.map(from => from.name || from.email).join(' '),
            ].join(' ').toLowerCase()
            return haystack.includes(needle)
        })
    }, [overview?.messages, query, mailFilter])

    const mailboxFilterOptions = useMemo(() => buildMailListFilters(overview?.messages || []), [overview?.messages])

    const selectedMessage = useMemo(() => {
        if (!overview) {
            return null
        }

        if (overview.selectedMessage?.id === selectedMessageId) {
            return overview.selectedMessage
        }

        return overview.selectedMessage
    }, [overview, selectedMessageId])

    const renderedHtml = useMemo(
        () => selectedMessage ? buildMailFrameHtml(withInlineAttachments(selectedMessage, overview?.mailboxUser || '')) : '',
        [selectedMessage, overview?.mailboxUser]
    )

    const showStaleWarning = Boolean(lastSuccessAt && now - lastSuccessAt > STALE_AFTER_MS)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Communications'
                title='Mail'
                description={overview?.mailboxAddress || 'Read, triage, and send operational mail from one workspace.'}
                actions={(
                    <div className='flex flex-wrap items-center justify-end gap-2'>
                        {showStaleWarning && (
                            <div className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-danger/30 bg-ui-danger/10 px-2.5 text-[11px] text-ui-danger'>
                                <Clock3 className='h-3.5 w-3.5' />
                                Updated {formatRelativeTime(lastSuccessAt!, now)} ago
                            </div>
                        )}
                        <button
                            data-testid='mail-compose-button'
                            disabled={!overview}
                            className='inline-flex h-8 items-center gap-1.5 rounded-lg bg-ui-primary px-3 text-[11px] font-medium text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted'
                            onClick={() => setComposer({ ...emptyComposer, open: true })}
                        >
                            <MailPlus className='h-3.5 w-3.5' />
                            Create
                        </button>
                    </div>
                )}
            />

            <DashboardPanel className='flex flex-wrap items-center gap-2 p-2.5 sm:p-3' id='mail-toolbar'>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                    <div className='mr-auto min-w-0'>
                        <p className='text-[10px] uppercase tracking-[0.24em] text-ui-muted'>Workspace</p>
                        <p className='truncate text-[11px] text-ui-muted'>{overview?.mailboxAddress || 'Communication'}</p>
                    </div>
                    <MailSyncStatus lastSuccessAt={lastSuccessAt} now={now} issue={backgroundIssue || error} />

                    {overview?.actor.canAccessAnyMailbox && (
                        <select
                            data-testid='mail-account-select'
                            className={`${subtleInput} min-w-36`}
                            value={overview.mailboxUser}
                            onChange={(event) => {
                                setActiveMailboxUser(event.target.value)
                                void load({ mailboxUser: event.target.value, mailboxId: null, messageId: null })
                            }}
                        >
                            {overview.accessibleAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.id}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className='relative min-w-0 flex-1 sm:min-w-52 sm:max-w-sm'>
                        <Search className='pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-ui-muted' />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder='Search this mailbox'
                            className={`${subtleInput} w-full pl-8`}
                        />
                    </div>
                </div>
            </DashboardPanel>

            <MailPrimaryFlow
                overview={overview}
                visibleCount={filteredMessages.length}
                selectedMessage={selectedMessage}
                stale={showStaleWarning}
                onCompose={() => setComposer({ ...emptyComposer, open: true })}
                onReply={() => selectedMessage && setComposer(composeFromReply('reply', selectedMessage))}
            />

            {error && (
                <ErrorNotice
                    compact
                    variant='info'
                    title='Mail reconnecting'
                    message={error}
                    actionLabel='Retry'
                    onAction={() => void load({ mailboxUser, mailboxId: null, messageId: null })}
                />
            )}

            {showStaleWarning && backgroundIssue && (
                <ErrorNotice compact message={`Background sync paused. Last successful update was ${formatRelativeTime(lastSuccessAt!, now)} ago.`} />
            )}

            <div className={`grid gap-3 ${sidebarCompact ? '2xl:grid-cols-[80px_320px_minmax(0,1fr)]' : '2xl:grid-cols-[220px_320px_minmax(0,1fr)]'} xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]`}>
                <aside
                    className={`${dashboardPanelClass} relative overflow-hidden p-3`}
                >
                    <MailSketch />
                    <div className='relative z-10'>
                        <div className='flex items-center justify-between pb-2'>
                            <div className='min-w-0'>
                                <p className='text-[10px] uppercase tracking-[0.28em] text-ui-muted'>Folders</p>
                                {!sidebarCompact && <p className='mt-1 truncate text-[11px] text-ui-muted'>{overview?.mailboxAddress || 'Mailbox'}</p>}
                            </div>
                            <div className='flex items-center gap-1'>
                                <button
                                    className={iconButton}
                                    title={sidebarCompact ? 'Expand folders' : 'Collapse folders'}
                                    onClick={() => setSidebarCompact(prev => !prev)}
                                >
                                    {sidebarCompact ? <PanelLeftOpen className='h-3.5 w-3.5' /> : <PanelLeftClose className='h-3.5 w-3.5' />}
                                </button>
                                <button
                                    className={iconButton}
                                    disabled={creatingMailbox}
                                    title='Create folder'
                                    onClick={() => setMailboxModalOpen(true)}
                                >
                                    <FolderInput className='h-3.5 w-3.5' />
                                </button>
                                <button
                                    className={iconButton}
                                    title='Mailbox admin'
                                    data-mail-admin-trigger
                                    onClick={() => setAdminDrawerOpen(true)}
                                >
                                    <Settings2 className='h-3.5 w-3.5' />
                                </button>
                            </div>
                        </div>

                        <div className='grid gap-1.5'>
                            {overview?.mailboxes.map(mailbox => (
                                <button
                                    key={mailbox.id}
                                    data-testid={`mail-mailbox-${mailbox.role || mailbox.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                    onClick={() => {
                                        setSelectedMailboxId(mailbox.id)
                                        void load({ mailboxId: mailbox.id, messageId: null })
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                                        selectedMailboxId === mailbox.id
                                            ? 'border-ui-primary bg-ui-primary/10 text-ui-text'
                                            : 'border-transparent text-ui-muted hover:border-ui-border hover:bg-ui-raised hover:text-ui-text'
                                    }`}
                                    title={mailbox.name}
                                >
                                    <span className='inline-flex items-center gap-2 truncate'>
                                        {iconForMailbox(mailbox.role)}
                                        {!sidebarCompact && <span className='truncate'>{mailbox.name}</span>}
                                    </span>
                                    {!sidebarCompact && <span className='text-[10px] text-ui-muted'>{mailbox.unreadEmails || 0}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <section className={`${dashboardPanelClass} order-3 p-2.5 xl:order-2`}>
                    <div className='flex items-center gap-2 px-1 pb-2 text-[10px] uppercase tracking-[0.24em] text-ui-muted'>
                        <span>{overview?.mailboxes.find(mailbox => mailbox.id === selectedMailboxId)?.name || 'Mailbox'}</span>
                        <span className='text-ui-muted'>•</span>
                        <span>{filteredMessages.length}</span>
                    </div>

                    <div className='mb-2 flex gap-1.5 overflow-x-auto pb-1' data-mail-filter-strip='true'>
                        {mailboxFilterOptions.map(option => (
                            <button
                                key={option.id}
                                type='button'
                                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition ${
                                    mailFilter === option.id
                                        ? 'border-ui-primary bg-ui-primary/10 text-ui-primary'
                                        : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-primary/35 hover:text-ui-text'
                                }`}
                                aria-pressed={mailFilter === option.id}
                                onClick={() => setMailFilter(option.id)}
                            >
                                <span>{option.label}</span>
                                <span className='rounded bg-ui-panel px-1.5 py-0.5 font-mono text-[10px]'>{option.count}</span>
                            </button>
                        ))}
                    </div>

                    <div className='grid gap-1.5'>
                        {filteredMessages.map(message => (
                            <MessageRow
                                key={message.id}
                                message={message}
                                active={selectedMessageId === message.id}
                                onClick={() => {
                                    setSelectedMessageId(message.id)
                                    void load({ messageId: message.id, silent: true })
                                }}
                            />
                        ))}
                        {!filteredMessages.length && !loading && (
                            <div className='rounded-lg border border-dashed border-ui-border px-3 py-4 text-xs text-ui-muted'>
                                {query || mailFilter !== 'all' ? 'No messages match the current view.' : 'Mailbox stream is live; no recent messages.'}
                            </div>
                        )}
                    </div>
                </section>

                <section className={`${dashboardPanelClass} order-2 p-3 xl:order-3`}>
                    {loading && !overview && <div className='px-2 py-6 text-xs text-ui-muted'>Loading mailbox…</div>}
                    {!loading && !selectedMessage && <div className='rounded-lg border border-dashed border-ui-border px-4 py-8 text-xs text-ui-muted'>Choose a message to read it here.</div>}
                    {selectedMessage && overview && (
                        <div className='grid gap-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border pb-3'>
                                <div className='min-w-0'>
                                    <h2 className='truncate text-lg font-semibold tracking-[-0.03em] text-ui-text'>{selectedMessage.subject}</h2>
                                    <div className='mt-1 grid gap-0.5 text-[11px] text-ui-muted'>
                                        <p>From {selectedMessage.from.map(formatMailboxAddress).join(', ')}</p>
                                        <p>To {selectedMessage.to.map(formatMailboxAddress).join(', ')}</p>
                                        {!!selectedMessage.cc.length && <p>CC {selectedMessage.cc.map(formatMailboxAddress).join(', ')}</p>}
                                        <p>{formatDate(selectedMessage.receivedAt, true)}</p>
                                    </div>
                                </div>

                                <div className='flex flex-wrap items-center gap-1.5'>
                                    <ActionIconButton label='Reply' icon={<Reply className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('reply', selectedMessage))} />
                                    <ActionIconButton label='Reply all' icon={<CornerUpLeft className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('replyAll', selectedMessage, overview.mailboxAddress))} />
                                    <ActionIconButton label='Forward' icon={<Forward className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('forward', selectedMessage))} />
                                    <ActionIconButton label={selectedMessage.isFlagged ? 'Unstar' : 'Star'} icon={<Star className='h-3.5 w-3.5' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isFlagged ? 'unflag' : 'flag')} />
                                    <ActionIconButton label='Archive' icon={<Archive className='h-3.5 w-3.5' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'archive')} />
                                    <ActionIconButton
                                        label={selectedMessage.isJunk ? 'Not spam' : 'Spam'}
                                        icon={selectedMessage.isJunk ? <Inbox className='h-3.5 w-3.5' /> : <ShieldAlert className='h-3.5 w-3.5' />}
                                        onClick={() => void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isJunk ? 'ham' : 'junk')}
                                    />
                                    <ActionIconButton label='Trash' icon={<Trash2 className='h-3.5 w-3.5' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'trash')} />
                                </div>
                            </div>

                            <details className='rounded-lg border border-ui-border bg-ui-raised' data-mail-message-filing-disclosure>
                                <summary className='flex cursor-pointer list-none flex-col gap-1 px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                    <span>Filing and read state</span>
                                    <span className='text-[11px] font-medium text-ui-muted'>Move, mark read, or mark unread</span>
                                </summary>
                                <div className='flex flex-wrap items-center gap-2 border-t border-ui-border p-3'>
                                    <select
                                        className={`${subtleInput} min-w-48 flex-1`}
                                        value={moveTargetMailboxId}
                                        onChange={event => setMoveTargetMailboxId(event.target.value)}
                                    >
                                        <option value=''>Move to…</option>
                                        {overview.mailboxes
                                            .filter(mailbox => mailbox.id !== selectedMailboxId)
                                            .map(mailbox => (
                                                <option key={mailbox.id} value={mailbox.id}>
                                                    {mailbox.name}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        className={toolbarButton}
                                        disabled={!moveTargetMailboxId || movingMessage}
                                        onClick={async () => {
                                            if (!moveTargetMailboxId) {
                                                return
                                            }

                                            setMovingMessage(true)
                                            try {
                                                await messageAction(selectedMessage.id, {
                                                    mailboxUser: overview.mailboxUser,
                                                    action: 'move',
                                                    targetMailboxId: moveTargetMailboxId,
                                                })
                                                await load({ mailboxId: moveTargetMailboxId, messageId: null, silent: true })
                                            } catch (cause) {
                                                setError(cause instanceof Error ? cause.message : 'Unable to move message.')
                                            } finally {
                                                setMovingMessage(false)
                                            }
                                        }}
                                    >
                                        Move
                                    </button>
                                    <button className={toolbarButton} onClick={() => void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isRead ? 'unread' : 'read')}>
                                        {selectedMessage.isRead ? 'Mark unread' : 'Mark read'}
                                    </button>
                                </div>
                            </details>

                            {!!selectedMessage.attachments.length && (
                                <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <div className='mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-ui-muted'>Attachments</div>
                                    <div className='grid gap-2 lg:grid-cols-2'>
                                        {selectedMessage.attachments.map(attachment => (
                                            <AttachmentPreview key={attachment.blobId} attachment={attachment} mailboxUser={overview.mailboxUser} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedMessage.htmlBody ? (
                                <iframe
                                    title='HTML mail'
                                    className='min-h-128 w-full rounded-lg border border-ui-border bg-ui-canvas'
                                    sandbox='allow-popups allow-popups-to-escape-sandbox'
                                    srcDoc={renderedHtml}
                                />
                            ) : (
                                <article className='min-h-128 rounded-lg border border-ui-border bg-ui-raised px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap text-ui-text'>
                                    {selectedMessage.textBody}
                                </article>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {composer.open && overview && (
                <Composer
                    state={composer}
                    now={now}
                    mailboxUser={overview.mailboxUser}
                    recentRecipients={overview.recentRecipients}
                    onChange={setComposer}
                    onClose={() => setComposer(emptyComposer)}
                    onSubmit={async next => {
                        try {
                            const sendResult = await sendMail({
                                mailboxUser: overview.mailboxUser,
                                to: next.to,
                                cc: next.cc,
                                bcc: next.bcc,
                                subject: next.subject,
                                textBody: next.body,
                                attachments: next.attachments,
                            })
                            setComposer(emptyComposer)
                            await load({
                                silent: true,
                                mailboxUser: sendResult?.mailboxUser || overview.mailboxUser,
                                mailboxId: sendResult?.sentMailboxId || selectedMailboxId,
                                messageId: sendResult?.sentMessageId || null,
                            })
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : 'Unable to send mail.')
                        }
                    }}
                />
            )}
            {adminDrawerOpen && overview && (
                <div className='fixed inset-0 z-1300 flex justify-end bg-ui-canvas/70 p-3 backdrop-blur-sm' data-mail-admin-drawer>
                    <aside className='flex h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-xl'>
                        <div className='flex items-start justify-between gap-3 border-b border-ui-border p-4'>
                            <div>
                                <p className='text-[10px] uppercase tracking-[0.28em] text-ui-muted'>Mailbox admin</p>
                                <h3 className='mt-1 text-lg font-semibold text-ui-text'>{overview.mailboxAddress}</h3>
                                <p className='mt-1 text-xs text-ui-muted'>Rules, delivery health, and client settings stay here so the mail stream stays focused.</p>
                            </div>
                            <button className={iconButton} onClick={() => setAdminDrawerOpen(false)} aria-label='Close mailbox admin'>
                                <Trash2 className='h-3.5 w-3.5 rotate-45' />
                            </button>
                        </div>

                        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
                            <div className='grid gap-3'>
                                <section className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div>
                                            <p className='text-sm font-semibold text-ui-text'>Filing rules</p>
                                            <p className='mt-1 text-xs text-ui-muted'>Create automatic moves without adding noise to daily triage.</p>
                                        </div>
                                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] text-ui-muted'>{overview.filters.length} active</span>
                                    </div>
                                    <form
                                        className='mt-3 grid gap-2 sm:grid-cols-2'
                                        onSubmit={async (event) => {
                                            event.preventDefault()
                                            const formData = new FormData(event.currentTarget)
                                            setCreatingFilter(true)
                                            try {
                                                await createFilter({
                                                    mailboxUser: overview.mailboxUser,
                                                    name: String(formData.get('name') || 'Rule'),
                                                    criteria: {
                                                        field: String(formData.get('field') || 'subject') as 'from' | 'subject' | 'body' | 'senderDomain',
                                                        contains: String(formData.get('contains') || ''),
                                                    },
                                                    action: {
                                                        type: 'move',
                                                        mailboxName: String(formData.get('mailboxName') || 'Archive'),
                                                        markRead: Boolean(formData.get('markRead')),
                                                    },
                                                })
                                                event.currentTarget.reset()
                                                await load()
                                            } catch (cause) {
                                                setError(cause instanceof Error ? cause.message : 'Unable to save filter.')
                                            } finally {
                                                setCreatingFilter(false)
                                            }
                                        }}
                                    >
                                        <input name='name' required placeholder='Invoice filing' className={`${subtleInput} w-full`} />
                                        <select name='field' className={`${subtleInput} w-full`}>
                                            <option value='subject'>Subject</option>
                                            <option value='from'>From</option>
                                            <option value='body'>Body</option>
                                            <option value='senderDomain'>Sender domain</option>
                                        </select>
                                        <input name='contains' required placeholder='contains...' className={`${subtleInput} w-full`} />
                                        <input name='mailboxName' required placeholder='target folder' className={`${subtleInput} w-full`} />
                                        <label className='inline-flex items-center gap-2 text-[11px] text-ui-muted sm:col-span-2'>
                                            <input type='checkbox' name='markRead' className='h-3.5 w-3.5 rounded border-ui-border bg-ui-raised' />
                                            Mark read after moving
                                        </label>
                                        <button className={`${toolbarButton} justify-center sm:col-span-2`} disabled={creatingFilter}>
                                            Save rule
                                        </button>
                                    </form>

                                    {!!overview.filters.length && (
                                        <div className='mt-3 grid gap-2'>
                                            {overview.filters.map(rule => (
                                                <div key={rule.id} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
                                                    <div className='flex items-start justify-between gap-2'>
                                                        <div className='min-w-0'>
                                                            <p className='truncate text-xs font-medium text-ui-text'>{rule.name}</p>
                                                            <p className='mt-1 text-[11px] leading-4 text-ui-muted'>
                                                                {rule.criteria.field} contains {rule.criteria.contains} to {rule.action.mailboxName}
                                                            </p>
                                                        </div>
                                                        <button
                                                            className='text-[11px] text-ui-danger hover:underline'
                                                            onClick={async () => {
                                                                try {
                                                                    await deleteFilter(rule.id, overview.mailboxUser)
                                                                    await load()
                                                                } catch (cause) {
                                                                    setError(cause instanceof Error ? cause.message : 'Unable to delete filter.')
                                                                }
                                                            }}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div>
                                            <p className='text-sm font-semibold text-ui-text'>Mail health</p>
                                            <p className='mt-1 text-xs text-ui-muted'>Delivery checks and queue state for this mailbox.</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                                            overview.health?.status === 'healthy'
                                                ? 'bg-ui-success/15 text-ui-success'
                                                : overview.health?.status === 'warning'
                                                    ? 'bg-ui-warning/15 text-ui-warning'
                                                    : 'bg-ui-danger/15 text-ui-danger'
                                        }`}
                                        >
                                            {overview.health?.status || 'unknown'}
                                        </span>
                                    </div>
                                    {overview.health && (
                                        <div className='mt-3'>
                                            <MailSyncStatus lastSuccessAt={lastSuccessAt} now={now} issue={backgroundIssue} full />
                                            <div className='flex flex-wrap items-center justify-between gap-2 text-[11px] text-ui-muted'>
                                                <span className='inline-flex items-center gap-1.5'>
                                                    <Radar className='h-3.5 w-3.5' />
                                                    Checked {formatDate(overview.health.checkedAt)}
                                                </span>
                                                <span>
                                                    Queue {overview.health.queueDepth} · banner {overview.health.smtpBannerLatencyMs ?? '-'}ms
                                                </span>
                                            </div>
                                            <div className='mt-2 grid gap-2'>
                                                {overview.health.checks.map(check => (
                                                    <div key={check.id} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
                                                        <div className='flex items-center justify-between gap-2'>
                                                            <p className='min-w-0 wrap-break-word text-xs font-medium text-ui-text'>{check.label}</p>
                                                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                                                check.status === 'healthy'
                                                                    ? 'bg-ui-success/15 text-ui-success'
                                                                    : check.status === 'warning'
                                                                        ? 'bg-ui-warning/15 text-ui-warning'
                                                                        : 'bg-ui-danger/15 text-ui-danger'
                                                            }`}
                                                            >
                                                                {check.status}
                                                            </span>
                                                        </div>
                                                        <p className='mt-1 wrap-break-word text-[11px] leading-4 text-ui-muted'>{check.detail}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <div className='flex items-start gap-2'>
                                        <ShieldCheck className='mt-0.5 h-4 w-4 text-ui-muted' />
                                        <div className='min-w-0 text-[11px] leading-5 text-ui-muted'>
                                            <p className='text-sm font-semibold text-ui-text'>Client access</p>
                                            <p className='mt-2'>IMAP {overview.settings.imapHost}:{overview.settings.imapPort}</p>
                                            <p>SMTP {overview.settings.smtpHost}:{overview.settings.smtpPort}</p>
                                            <p>ManageSieve {overview.settings.host}:{overview.settings.managesievePort}</p>
                                            <p className='mt-1'>Username {overview.settings.username}</p>
                                            <p>Address {overview.settings.address}</p>
                                            <p>Password is hidden. Rotate client credentials from account settings.</p>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
            {mailboxModalOpen && overview && (
                <div className='fixed inset-0 z-1300 grid place-items-center bg-ui-canvas/75 p-4 backdrop-blur-sm'>
                    <div className='w-full max-w-md rounded-lg border border-ui-border bg-ui-panel p-5 shadow-xl'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <p className='text-[10px] uppercase tracking-[0.28em] text-ui-muted'>Mailbox</p>
                                <h3 className='mt-1 text-lg font-semibold text-ui-text'>Create folder</h3>
                            </div>
                            <button className={iconButton} onClick={() => { setMailboxModalOpen(false); setMailboxDraft('') }}>
                                <Trash2 className='h-3.5 w-3.5 rotate-45' />
                            </button>
                        </div>
                        <div className='mt-4 grid gap-3'>
                            <input
                                value={mailboxDraft}
                                onChange={(event) => setMailboxDraft(event.target.value)}
                                placeholder='Projects, Receipts, Alerts...'
                                className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2.5 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary'
                            />
                            <div className='flex justify-end gap-2'>
                                <button className={toolbarButton} onClick={() => { setMailboxModalOpen(false); setMailboxDraft('') }}>
                                    Cancel
                                </button>
                                <button
                                    className='inline-flex items-center justify-center rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                                    disabled={!mailboxDraft.trim() || creatingMailbox}
                                    onClick={async () => {
                                        setCreatingMailbox(true)
                                        try {
                                            await createMailbox({ mailboxUser: overview.mailboxUser, name: mailboxDraft.trim() })
                                            setMailboxModalOpen(false)
                                            setMailboxDraft('')
                                            await load()
                                        } catch (cause) {
                                            setError(cause instanceof Error ? cause.message : 'Unable to create mailbox.')
                                        } finally {
                                            setCreatingMailbox(false)
                                        }
                                    }}
                                >
                                    {creatingMailbox ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardPage>
    )
}

function MailSyncStatus({
    lastSuccessAt,
    now,
    issue,
    full = false,
}: {
    lastSuccessAt: number | null
    now: number
    issue?: string
    full?: boolean
}) {
    const label = lastSuccessAt ? `Last sync ${formatRelativeTime(lastSuccessAt, now)} ago` : 'Waiting for first sync'
    const tone = issue ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : 'border-ui-border bg-ui-raised text-ui-muted'
    return (
        <div className={`${full ? 'mb-3 flex' : 'hidden sm:flex'} min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${tone}`} data-mail-sync-status>
            <Clock3 className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{issue ? `Reconnecting; ${label.toLowerCase()}` : label}</span>
        </div>
    )
}

function MailPrimaryFlow({ overview, visibleCount, selectedMessage, stale, onCompose, onReply }: {
    overview: MailOverview | null
    visibleCount: number
    selectedMessage: MailOverview['selectedMessage']
    stale: boolean
    onCompose: () => void
    onReply: () => void
}) {
    const unreadCount = overview?.mailboxes.reduce((sum, mailbox) => sum + (mailbox.unreadEmails || 0), 0) ?? 0
    const health = overview?.health?.status || 'unknown'
    const healthTone = health === 'healthy'
        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        : health === 'warning'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    const title = selectedMessage
        ? `Reply or triage "${selectedMessage.subject || 'selected message'}"`
        : unreadCount
            ? `Review ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
            : 'Mailbox is ready'
    const detail = selectedMessage
        ? `From ${selectedMessage.from.map(formatMailboxAddress).join(', ') || 'unknown sender'} · ${formatDate(selectedMessage.receivedAt, true)}`
        : overview
            ? `${visibleCount} visible message${visibleCount === 1 ? '' : 's'} in ${overview.mailboxAddress}.`
            : 'Mail is loading; compose unlocks when the mailbox connects.'

    return (
        <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto]' data-mail-primary-flow>
            <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>Recommended next</span>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{unreadCount} unread</span>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{visibleCount} visible</span>
                    <span className={`rounded-md border px-2 py-1 ${healthTone}`}>health {health}</span>
                    {stale ? <span className='rounded-md border border-ui-danger/35 bg-ui-danger/10 px-2 py-1 text-ui-danger'>stale</span> : null}
                </div>
                <h2 className='mt-3 wrap-break-word text-lg font-semibold text-ui-text'>{title}</h2>
                <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{detail}</p>
            </div>
            <div className='flex flex-wrap items-center gap-2 lg:justify-end'>
                {selectedMessage ? (
                    <button type='button' onClick={onReply} className='inline-flex min-h-10 items-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90' data-mail-primary-action>
                        <Reply className='h-4 w-4' />
                        Reply
                    </button>
                ) : null}
                <button type='button' onClick={onCompose} disabled={!overview} className='inline-flex min-h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-50' data-mail-compose-primary>
                    <MailPlus className='h-4 w-4' />
                    Compose
                </button>
            </div>
        </section>
    )
}

function buildMailListFilters(messages: MailMessageSummary[]): Array<{ id: MailListFilter, label: string, count: number }> {
    return [
        { id: 'all', label: 'All', count: messages.length },
        { id: 'unread', label: 'Unread', count: messages.filter(message => !message.isRead).length },
        { id: 'starred', label: 'Starred', count: messages.filter(message => message.isFlagged).length },
        { id: 'attachments', label: 'Attachments', count: messages.filter(message => message.hasAttachment).length },
        { id: 'needsFiling', label: 'Needs filing', count: messages.filter(message => !message.isRead || message.isFlagged || message.hasAttachment).length },
    ]
}

function messageMatchesMailFilter(message: MailMessageSummary, filter: MailListFilter) {
    if (filter === 'unread') return !message.isRead
    if (filter === 'starred') return message.isFlagged
    if (filter === 'attachments') return message.hasAttachment
    if (filter === 'needsFiling') return !message.isRead || message.isFlagged || message.hasAttachment
    return true
}
