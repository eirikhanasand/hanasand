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
import type { MailOverview } from '@/utils/mail/types'
import { DashboardPage, dashboardPanelClass } from '@/components/dashboard/ui'
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
    const [query, setQuery] = useState('')
    const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const [activeMailboxUser, setActiveMailboxUser] = useState<string | null>(mailboxUser || null)

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
        if (!needle) {
            return overview?.messages || []
        }

        return (overview?.messages || []).filter(message => {
            const haystack = [
                message.subject,
                message.preview,
                message.from.map(from => from.name || from.email).join(' '),
            ].join(' ').toLowerCase()
            return haystack.includes(needle)
        })
    }, [overview?.messages, query])

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
            <div className='flex flex-wrap items-center justify-between gap-2 rounded-[1.4rem] border border-ui-border bg-ui-panel px-3 py-2.5 sm:px-4'>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                    <div className='mr-1 hidden min-w-0 sm:block'>
                        <p className='text-[10px] uppercase tracking-[0.28em] text-ui-muted'>Mail</p>
                        <p className='truncate text-[11px] text-ui-muted'>{overview?.mailboxAddress || 'Communication'}</p>
                    </div>
                    <button
                        data-testid='mail-compose-button'
                        disabled={!overview}
                        className='inline-flex h-8 items-center gap-1.5 rounded-xl bg-ui-primary px-3 text-[11px] font-medium text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted'
                        onClick={() => setComposer({ ...emptyComposer, open: true })}
                    >
                        <MailPlus className='h-3.5 w-3.5' />
                        Create
                    </button>

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

                {showStaleWarning && (
                    <div className='inline-flex items-center gap-1.5 text-[11px] text-ui-danger'>
                        <Clock3 className='h-3.5 w-3.5' />
                        Updated {formatRelativeTime(lastSuccessAt!, now)} ago
                    </div>
                )}
            </div>

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
                                    className={`flex w-full items-center justify-between rounded-2xl border px-2.5 py-2 text-left text-xs transition ${
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

                        <details className={`mt-3 rounded-2xl border border-ui-border bg-ui-raised ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-ui-muted'>
                                <span className='inline-flex items-center gap-1.5'><FolderInput className='h-3.5 w-3.5' /> Rules</span>
                                <span className='text-ui-muted'>{overview?.filters.length || 0}</span>
                            </summary>
                            <div className='border-t border-ui-border px-3 py-3'>
                                <form
                                    className='grid gap-2'
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        if (!overview) {
                                            return
                                        }

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
                                    <label className='inline-flex items-center gap-2 text-[11px] text-ui-muted'>
                                        <input type='checkbox' name='markRead' className='h-3.5 w-3.5 rounded border-ui-border bg-ui-raised' />
                                        mark read after moving
                                    </label>
                                    <button className={`${toolbarButton} justify-center`} disabled={creatingFilter}>
                                        Save rule
                                    </button>
                                </form>

                                {!!overview?.filters.length && (
                                    <div className='mt-2 grid gap-1.5'>
                                        {overview.filters.map(rule => (
                                            <div key={rule.id} className='rounded-2xl border border-ui-border bg-ui-panel px-2.5 py-2'>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <div className='min-w-0'>
                                                        <p className='truncate text-[11px] font-medium text-ui-text'>{rule.name}</p>
                                                        <p className='mt-1 text-[10px] leading-4 text-ui-muted'>
                                                            {rule.criteria.field} contains {rule.criteria.contains} → {rule.action.mailboxName}
                                                        </p>
                                                    </div>
                                                    <button
                                                        className='text-[10px] text-ui-danger hover:underline'
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
                            </div>
                        </details>

                        <details className={`mt-2 rounded-2xl border border-ui-border bg-ui-raised ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-ui-muted'>
                                <span className='inline-flex items-center gap-1.5'><ShieldCheck className='h-3.5 w-3.5' /> Mail health</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                    overview?.health?.status === 'healthy'
                                        ? 'bg-ui-success/15 text-ui-success'
                                        : overview?.health?.status === 'warning'
                                            ? 'bg-ui-warning/15 text-ui-warning'
                                            : 'bg-ui-danger/15 text-ui-danger'
                                }`}
                                >
                                    {overview?.health?.status || 'unknown'}
                                </span>
                            </summary>
                            {overview?.health && (
                                <div className='border-t border-ui-border px-3 py-3'>
                                    <div className='flex items-center justify-between gap-2 text-[10px] text-ui-muted'>
                                        <span className='inline-flex items-center gap-1.5'>
                                            <Radar className='h-3.5 w-3.5' />
                                            checked {formatDate(overview.health.checkedAt)}
                                        </span>
                                        <span>
                                            queue {overview.health.queueDepth} · banner {overview.health.smtpBannerLatencyMs ?? '—'}ms
                                        </span>
                                    </div>
                                    <div className='mt-2 grid gap-1.5 min-w-0'>
                                        {overview.health.checks.map(check => (
                                            <div
                                                key={check.id}
                                                className='min-w-0 rounded-2xl border border-ui-border bg-ui-panel px-2.5 py-2'
                                            >
                                                <div className='flex items-center justify-between gap-2'>
                                                    <p className='min-w-0 wrap-break-word text-[11px] font-medium text-ui-text'>{check.label}</p>
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
                                                <p className='mt-1 wrap-break-word text-[10px] leading-4 text-ui-muted'>{check.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </details>

                        <details className={`mt-2 rounded-2xl border border-ui-border bg-ui-raised ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-ui-muted'>
                                <span className='inline-flex items-center gap-1.5'><Settings2 className='h-3.5 w-3.5' /> Client access</span>
                                <span className='text-ui-muted'>IMAP</span>
                            </summary>
                            {overview && (
                                <div className='border-t border-ui-border px-3 py-3 text-[11px] leading-5 text-ui-muted'>
                                    <p>IMAP {overview.settings.imapHost}:{overview.settings.imapPort}</p>
                                    <p>SMTP {overview.settings.smtpHost}:{overview.settings.smtpPort}</p>
                                    <p>ManageSieve {overview.settings.host}:{overview.settings.managesievePort}</p>
                                    <p className='mt-1'>Username {overview.settings.username}</p>
                                    <p>Address {overview.settings.address}</p>
                                    <p>Password is hidden. Use account settings to rotate client credentials.</p>
                                </div>
                            )}
                        </details>
                    </div>
                </aside>

                <section className={`${dashboardPanelClass} order-3 p-2.5 xl:order-2`}>
                    <div className='flex items-center gap-2 px-1 pb-2 text-[10px] uppercase tracking-[0.24em] text-ui-muted'>
                        <span>{overview?.mailboxes.find(mailbox => mailbox.id === selectedMailboxId)?.name || 'Mailbox'}</span>
                        <span className='text-ui-muted'>•</span>
                        <span>{filteredMessages.length}</span>
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
                            <div className='rounded-2xl border border-dashed border-ui-border px-3 py-4 text-xs text-ui-muted'>
                                {query ? 'Nothing in this mailbox matches the current search.' : 'Mailbox stream is live; no recent messages.'}
                            </div>
                        )}
                    </div>
                </section>

                <section className={`${dashboardPanelClass} order-2 p-3 xl:order-3`}>
                    {loading && !overview && <div className='px-2 py-6 text-xs text-ui-muted'>Loading mailbox…</div>}
                    {!loading && !selectedMessage && <div className='rounded-2xl border border-dashed border-ui-border px-4 py-8 text-xs text-ui-muted'>Choose a message to read it here.</div>}
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

                            <div className='flex flex-wrap items-center gap-2'>
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

                            {!!selectedMessage.attachments.length && (
                                <div className='rounded-2xl border border-ui-border bg-ui-raised p-3'>
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
                                    className='min-h-128 w-full rounded-2xl border border-ui-border bg-ui-canvas'
                                    sandbox='allow-popups allow-popups-to-escape-sandbox'
                                    srcDoc={renderedHtml}
                                />
                            ) : (
                                <article className='min-h-128 rounded-2xl border border-ui-border bg-ui-raised px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap text-ui-text'>
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
            {mailboxModalOpen && overview && (
                <div className='fixed inset-0 z-1300 grid place-items-center bg-ui-canvas/75 p-4 backdrop-blur-sm'>
                    <div className='w-full max-w-md rounded-3xl border border-ui-border bg-ui-panel p-5 shadow-xl'>
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
                                className='rounded-xl border border-ui-border bg-ui-raised px-3 py-2.5 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary'
                            />
                            <div className='flex justify-end gap-2'>
                                <button className={toolbarButton} onClick={() => { setMailboxModalOpen(false); setMailboxDraft('') }}>
                                    Cancel
                                </button>
                                <button
                                    className='inline-flex items-center justify-center rounded-xl bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
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
