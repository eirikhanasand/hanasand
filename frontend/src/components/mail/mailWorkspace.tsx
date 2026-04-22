'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    Archive,
    Clock3,
    CornerUpLeft,
    FolderInput,
    Forward,
    Inbox,
    Mail,
    MailPlus,
    PanelLeftClose,
    PanelLeftOpen,
    Radar,
    Paperclip,
    Reply,
    Search,
    Send,
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
    mailBlobUrl,
    messageAction,
    sendMail,
    type DraftAttachment,
} from '@/utils/mail/client'
import type { MailAddress, MailAttachment, MailMessage, MailMessageSummary, MailOverview, RecentMailRecipient } from '@/utils/mail/types'
import { DashboardPage, dashboardPanelClass } from '@/components/dashboard/ui'

type Props = {
    mailboxUser?: string | null
}

type ComposerMode = 'new' | 'reply' | 'replyAll' | 'forward'

type ComposerState = {
    open: boolean
    mode: ComposerMode
    to: string
    cc: string
    bcc: string
    subject: string
    body: string
    attachments: DraftAttachment[]
}

const emptyComposer: ComposerState = {
    open: false,
    mode: 'new',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    attachments: [],
}

const POLL_INTERVAL_MS = 10_000
const STALE_AFTER_MS = 5 * 60_000

const toolbarButton = 'inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[11px] font-medium text-bright/78 transition hover:border-white/18 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45'
const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-bright/72 transition hover:border-white/18 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45'
const subtleInput = 'h-8 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[12px] text-bright outline-none transition placeholder:text-bright/28 focus:border-orange-300/45 focus:bg-white/[0.05]'

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

    async function load(params: {
        mailboxId?: string | null
        messageId?: string | null
        mailboxUser?: string | null
        silent?: boolean
    } = {}) {
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
            const message = cause instanceof Error ? cause.message : 'Unable to load the mailbox.'
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
    }

    useEffect(() => {
        setActiveMailboxUser(mailboxUser || null)
        void load({ mailboxUser })
    }, [mailboxUser])

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
    }, [activeMailboxUser, mailboxUser, selectedMailboxId, selectedMessageId])

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
            <div className='flex flex-wrap items-center justify-between gap-2 rounded-[1.4rem] border border-white/8 bg-white/[0.025] px-3 py-2.5 sm:px-4'>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                    <div className='mr-1 hidden min-w-0 sm:block'>
                        <p className='text-[10px] uppercase tracking-[0.28em] text-bright/30'>Mail</p>
                        <p className='truncate text-[11px] text-bright/46'>{overview?.mailboxAddress || 'Communication'}</p>
                    </div>
                    <button
                        data-testid='mail-compose-button'
                        className='inline-flex h-8 items-center gap-1.5 rounded-xl bg-orange-400/14 px-3 text-[11px] font-medium text-orange-100 transition hover:bg-orange-400/20'
                        onClick={() => setComposer({ ...emptyComposer, open: true })}
                    >
                        <MailPlus className='h-3.5 w-3.5' />
                        Compose
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
                        <Search className='pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-bright/30' />
                        <input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder='Search this mailbox'
                            className={`${subtleInput} w-full pl-8`}
                        />
                    </div>
                </div>

                {showStaleWarning && (
                    <div className='inline-flex items-center gap-1.5 text-[11px] text-red-200/85'>
                        <Clock3 className='h-3.5 w-3.5' />
                        Updated {formatRelativeTime(lastSuccessAt!)} ago
                    </div>
                )}
            </div>

            {error && (
                <div className='rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100'>
                    {error}
                </div>
            )}

            {showStaleWarning && backgroundIssue && (
                <div className='rounded-2xl border border-red-400/20 bg-red-500/8 px-3 py-2 text-[11px] text-red-100/90'>
                    Background sync paused. Last successful update was {formatRelativeTime(lastSuccessAt!)} ago.
                </div>
            )}

            <div className={`grid gap-3 ${sidebarCompact ? '2xl:grid-cols-[80px_320px_minmax(0,1fr)]' : '2xl:grid-cols-[220px_320px_minmax(0,1fr)]'} xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]`}>
                <aside
                    className={`${dashboardPanelClass} relative overflow-hidden p-3`}
                >
                    <MailSketch />
                    <div className='relative z-10'>
                        <div className='flex items-center justify-between pb-2'>
                            <div className='min-w-0'>
                                <p className='text-[10px] uppercase tracking-[0.28em] text-bright/35'>Folders</p>
                                {!sidebarCompact && <p className='mt-1 truncate text-[11px] text-bright/50'>{overview?.mailboxAddress || 'Mailbox'}</p>}
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
                                    className={`flex w-full items-center justify-between rounded-2xl border px-2.5 py-2 text-left text-[12px] transition ${
                                        selectedMailboxId === mailbox.id
                                            ? 'border-orange-300/30 bg-orange-300/10 text-bright'
                                            : 'border-transparent text-bright/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-bright'
                                    }`}
                                    title={mailbox.name}
                                >
                                    <span className='inline-flex items-center gap-2 truncate'>
                                        {iconForMailbox(mailbox.role)}
                                        {!sidebarCompact && <span className='truncate'>{mailbox.name}</span>}
                                    </span>
                                    {!sidebarCompact && <span className='text-[10px] text-bright/35'>{mailbox.unreadEmails || 0}</span>}
                                </button>
                            ))}
                        </div>

                        <details className={`mt-3 rounded-2xl border border-white/8 bg-white/[0.025] ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-bright/68'>
                                <span className='inline-flex items-center gap-1.5'><FolderInput className='h-3.5 w-3.5' /> Rules</span>
                                <span className='text-bright/28'>{overview?.filters.length || 0}</span>
                            </summary>
                            <div className='border-t border-white/8 px-3 py-3'>
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
                                    <label className='inline-flex items-center gap-2 text-[11px] text-bright/52'>
                                        <input type='checkbox' name='markRead' className='h-3.5 w-3.5 rounded border-white/15 bg-transparent' />
                                        mark read after moving
                                    </label>
                                    <button className={`${toolbarButton} justify-center`} disabled={creatingFilter}>
                                        Save rule
                                    </button>
                                </form>

                                {!!overview?.filters.length && (
                                    <div className='mt-2 grid gap-1.5'>
                                        {overview.filters.map(rule => (
                                            <div key={rule.id} className='rounded-2xl border border-white/8 bg-black/10 px-2.5 py-2'>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <div className='min-w-0'>
                                                        <p className='truncate text-[11px] font-medium text-bright/85'>{rule.name}</p>
                                                        <p className='mt-1 text-[10px] leading-4 text-bright/42'>
                                                            {rule.criteria.field} contains {rule.criteria.contains} → {rule.action.mailboxName}
                                                        </p>
                                                    </div>
                                                    <button
                                                        className='text-[10px] text-red-200/75 hover:text-red-100'
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

                        <details className={`mt-2 rounded-2xl border border-white/8 bg-white/[0.025] ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-bright/68'>
                                <span className='inline-flex items-center gap-1.5'><ShieldCheck className='h-3.5 w-3.5' /> Mail health</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                    overview?.health?.status === 'healthy'
                                        ? 'bg-emerald-500/12 text-emerald-100'
                                        : overview?.health?.status === 'warning'
                                            ? 'bg-amber-500/12 text-amber-100'
                                            : 'bg-red-500/12 text-red-100'
                                }`}
                                >
                                    {overview?.health?.status || 'unknown'}
                                </span>
                            </summary>
                            {overview?.health && (
                                <div className='border-t border-white/8 px-3 py-3'>
                                    <div className='flex items-center justify-between gap-2 text-[10px] text-bright/42'>
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
                                                className='min-w-0 rounded-2xl border border-white/8 bg-black/10 px-2.5 py-2'
                                            >
                                                <div className='flex items-center justify-between gap-2'>
                                                    <p className='min-w-0 text-[11px] font-medium text-bright/84 break-words'>{check.label}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                                                        check.status === 'healthy'
                                                            ? 'bg-emerald-500/12 text-emerald-100'
                                                            : check.status === 'warning'
                                                                ? 'bg-amber-500/12 text-amber-100'
                                                                : 'bg-red-500/12 text-red-100'
                                                    }`}
                                                    >
                                                        {check.status}
                                                    </span>
                                                </div>
                                                <p className='mt-1 break-words text-[10px] leading-4 text-bright/42'>{check.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </details>

                        <details className={`mt-2 rounded-2xl border border-white/8 bg-white/[0.025] ${sidebarCompact ? 'hidden' : ''}`}>
                            <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-medium text-bright/68'>
                                <span className='inline-flex items-center gap-1.5'><Settings2 className='h-3.5 w-3.5' /> Client access</span>
                                <span className='text-bright/28'>IMAP</span>
                            </summary>
                            {overview && (
                                <div className='border-t border-white/8 px-3 py-3 text-[11px] leading-5 text-bright/56'>
                                    <p>IMAP `{overview.settings.imapHost}:{overview.settings.imapPort}`</p>
                                    <p>SMTP `{overview.settings.smtpHost}:{overview.settings.smtpPort}`</p>
                                    <p>ManageSieve `{overview.settings.host}:{overview.settings.managesievePort}`</p>
                                    <p className='mt-1'>Username `{overview.settings.username}`</p>
                                    <p>Address `{overview.settings.address}`</p>
                                    <p>Password `{overview.mailPassword}`</p>
                                </div>
                            )}
                        </details>
                    </div>
                </aside>

                <section className={`${dashboardPanelClass} order-3 p-2.5 xl:order-2`}>
                    <div className='flex items-center gap-2 px-1 pb-2 text-[10px] uppercase tracking-[0.24em] text-bright/30'>
                        <span>{overview?.mailboxes.find(mailbox => mailbox.id === selectedMailboxId)?.name || 'Mailbox'}</span>
                        <span className='text-bright/15'>•</span>
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
                            <div className='rounded-2xl border border-dashed border-white/10 px-3 py-4 text-[12px] text-bright/42'>
                                {query ? 'Nothing in this mailbox matches the current search.' : 'This mailbox is quiet right now.'}
                            </div>
                        )}
                    </div>
                </section>

                <section className={`${dashboardPanelClass} order-2 p-3 xl:order-3`}>
                    {loading && !overview && <div className='px-2 py-6 text-[12px] text-bright/42'>Loading mailbox…</div>}
                    {!loading && !selectedMessage && <div className='rounded-2xl border border-dashed border-white/10 px-4 py-8 text-[12px] text-bright/42'>Choose a message to read it here.</div>}
                    {selectedMessage && overview && (
                        <div className='grid gap-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3'>
                                <div className='min-w-0'>
                                    <h2 className='truncate text-[18px] font-semibold tracking-[-0.03em] text-bright'>{selectedMessage.subject}</h2>
                                    <div className='mt-1 grid gap-0.5 text-[11px] text-bright/52'>
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
                                <div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
                                    <div className='mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-bright/34'>Attachments</div>
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
                                    className='min-h-[32rem] w-full rounded-2xl border border-white/10 bg-[#0d100d]'
                                    sandbox='allow-popups allow-popups-to-escape-sandbox'
                                    srcDoc={renderedHtml}
                                />
                            ) : (
                                <article className='min-h-[32rem] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap text-bright/82'>
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
                <div className='fixed inset-0 z-[1300] grid place-items-center bg-black/50 p-4 backdrop-blur-sm'>
                    <div className='w-full max-w-md rounded-[24px] border border-white/10 bg-[#0f120f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)]'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <p className='text-[10px] uppercase tracking-[0.28em] text-bright/35'>Mailbox</p>
                                <h3 className='mt-1 text-lg font-semibold text-bright'>Create folder</h3>
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
                                className='rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bright outline-none placeholder:text-bright/28'
                            />
                            <div className='flex justify-end gap-2'>
                                <button className={toolbarButton} onClick={() => { setMailboxModalOpen(false); setMailboxDraft('') }}>
                                    Cancel
                                </button>
                                <button
                                    className='inline-flex items-center justify-center rounded-xl bg-orange-400/90 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
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

function MessageRow({ message, active, onClick }: {
    message: MailMessageSummary
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            data-testid={`mail-message-${message.id}`}
            onClick={onClick}
            className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                active
                    ? 'border-orange-300/30 bg-orange-300/10'
                    : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
            }`}
        >
            <div className='flex items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    {!message.isRead && <span className='h-1.5 w-1.5 rounded-full bg-orange-300' />}
                    <p className='truncate text-[12px] font-medium text-bright'>{message.subject}</p>
                </div>
                <span className='shrink-0 text-[10px] text-bright/32'>{formatDate(message.receivedAt)}</span>
            </div>
            <p className='mt-1 truncate text-[11px] text-bright/44'>{message.from.map(from => from.name || from.email).join(', ')}</p>
            <div className='mt-1 flex items-center justify-between gap-2'>
                <p className='line-clamp-2 text-[11px] leading-5 text-bright/54'>{message.preview}</p>
                {message.hasAttachment && <Paperclip className='h-3.5 w-3.5 shrink-0 text-bright/34' />}
            </div>
        </button>
    )
}

function Composer({ state, mailboxUser, recentRecipients, onChange, onClose, onSubmit }: {
    state: ComposerState
    mailboxUser: string
    recentRecipients: RecentMailRecipient[]
    onChange: (state: ComposerState) => void
    onClose: () => void
    onSubmit: (state: ComposerState) => Promise<void>
}) {
    const [submitting, setSubmitting] = useState(false)
    const [activeRecipientField, setActiveRecipientField] = useState<'to' | 'cc' | 'bcc' | null>('to')

    function patch(values: Partial<ComposerState>) {
        onChange({ ...state, ...values })
    }

    return (
        <div className='fixed inset-0 z-[1400] grid place-items-center bg-black/50 p-4 backdrop-blur-sm'>
            <form
                data-testid='mail-compose-form'
                className='w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#0f120f]/92 p-3 sm:p-4
                    shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur-2xl'
                onSubmit={async event => {
                    event.preventDefault()
                    setSubmitting(true)
                    try {
                        await onSubmit(state)
                    } finally {
                        setSubmitting(false)
                    }
                }}
            >
                <div className='flex items-center justify-between gap-3 border-b border-white/8 pb-3'>
                    <div>
                        <p className='text-[10px] uppercase tracking-[0.28em] text-bright/34'>{state.mode}</p>
                        <h3 className='mt-1 text-[16px] font-semibold text-bright'>Compose</h3>
                    </div>
                    <button type='button' className={toolbarButton} onClick={onClose}>Close</button>
                </div>

                <div className='mt-3 grid gap-2'>
                        <RecipientField
                            testId='mail-compose-to'
                            placeholder='To'
                            value={state.to}
                            onChange={(value) => patch({ to: value })}
                            onFocus={() => setActiveRecipientField('to')}
                            onBlur={() => window.setTimeout(() => setActiveRecipientField(current => current === 'to' ? null : current), 120)}
                            suggestions={activeRecipientField === 'to' ? recentRecipients : []}
                        />
                    <div className='grid gap-2 md:grid-cols-2'>
                        <RecipientField
                            placeholder='CC'
                            value={state.cc}
                            onChange={(value) => patch({ cc: value })}
                            onFocus={() => setActiveRecipientField('cc')}
                            onBlur={() => window.setTimeout(() => setActiveRecipientField(current => current === 'cc' ? null : current), 120)}
                            suggestions={activeRecipientField === 'cc' ? recentRecipients : []}
                        />
                        <RecipientField
                            placeholder='BCC'
                            value={state.bcc}
                            onChange={(value) => patch({ bcc: value })}
                            onFocus={() => setActiveRecipientField('bcc')}
                            onBlur={() => window.setTimeout(() => setActiveRecipientField(current => current === 'bcc' ? null : current), 120)}
                            suggestions={activeRecipientField === 'bcc' ? recentRecipients : []}
                        />
                    </div>
                    <input data-testid='mail-compose-subject' className={`${subtleInput} w-full`} placeholder='Subject' value={state.subject} onChange={event => patch({ subject: event.target.value })} />
                    <textarea
                        data-testid='mail-compose-body'
                        className='min-h-[14rem] w-full rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-3 text-[13px] leading-6 text-bright outline-none transition placeholder:text-bright/28 focus:border-orange-300/45 focus:bg-white/[0.05] sm:min-h-[16rem]'
                        placeholder='Write your message...'
                        value={state.body}
                        onChange={event => patch({ body: event.target.value })}
                    />

                    <label className='inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-[11px] text-bright/56 hover:bg-white/[0.04]'>
                        <Paperclip className='h-3.5 w-3.5' />
                        Add attachments
                        <input
                            type='file'
                            multiple
                            className='hidden'
                            onChange={async event => {
                                const files = Array.from(event.target.files || [])
                                const attachments = await Promise.all(files.map(fileToDraftAttachment))
                                patch({ attachments: [...state.attachments, ...attachments] })
                                event.target.value = ''
                            }}
                        />
                    </label>

                    {!!state.attachments.length && (
                        <div className='grid gap-2 md:grid-cols-2'>
                            {state.attachments.map((attachment, index) => (
                                <div key={`${attachment.name}-${index}`} className='rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-[12px] font-medium text-bright'>{attachment.name}</p>
                                            <p className='text-[10px] text-bright/34'>{prettyBytes(attachment.size)}</p>
                                        </div>
                                        <button
                                            type='button'
                                            className='text-[10px] text-red-200/75 hover:text-red-100'
                                            onClick={() => patch({ attachments: state.attachments.filter((_, current) => current !== index) })}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className='mt-4 flex items-center justify-between gap-3'>
                    <p className='text-[11px] text-bright/36'>Sending as `{mailboxUser}`</p>
                    <div className='flex items-center gap-2'>
                        <button type='button' className={toolbarButton} onClick={onClose}>Cancel</button>
                        <button data-testid='mail-compose-send' type='submit' className='inline-flex h-8 items-center gap-1.5 rounded-xl bg-orange-400/14 px-3 text-[11px] font-medium text-orange-100 transition hover:bg-orange-400/20 disabled:cursor-not-allowed disabled:opacity-45' disabled={submitting}>
                            <Send className='h-3.5 w-3.5' />
                            {submitting ? 'Sending…' : 'Send'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

function RecipientField({
    value,
    onChange,
    onFocus,
    onBlur,
    suggestions,
    placeholder,
    testId,
}: {
    value: string
    onChange: (value: string) => void
    onFocus: () => void
    onBlur: () => void
    suggestions: RecentMailRecipient[]
    placeholder: string
    testId?: string
}) {
    const currentToken = value.split(',').at(-1)?.trim().toLowerCase() || ''
    const visibleSuggestions = suggestions
        .filter(recipient => {
            if (!currentToken) {
                return true
            }

            const label = `${recipient.name || ''} ${recipient.email}`.toLowerCase()
            return label.includes(currentToken)
        })
        .slice(0, 6)

    function applySuggestion(recipient: RecentMailRecipient) {
        const parts = value.split(',').map(part => part.trim()).filter(Boolean)
        const label = recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email

        if (value.includes(',')) {
            parts[parts.length - 1] = label
            onChange(`${parts.join(', ')}${parts.length ? ', ' : ''}`)
            return
        }

        onChange(label)
    }

    return (
        <div className='relative'>
            <input
                data-testid={testId}
                className={`${subtleInput} w-full`}
                placeholder={placeholder}
                value={value}
                onFocus={onFocus}
                onBlur={onBlur}
                onChange={event => onChange(event.target.value)}
            />
            {!!visibleSuggestions.length && (
                <div className='absolute left-0 right-0 top-[calc(100%+0.35rem)] z-10 rounded-2xl border border-white/10 bg-[#101310]/96 p-1 shadow-[0_22px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl'>
                    {visibleSuggestions.map(recipient => (
                        <button
                            key={recipient.email}
                            type='button'
                            data-testid={`mail-recipient-suggestion-${recipient.email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            className='flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]'
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => applySuggestion(recipient)}
                        >
                            <div className='min-w-0'>
                                <p className='truncate text-[12px] text-bright'>{recipient.name || recipient.email}</p>
                                {recipient.name && <p className='truncate text-[10px] text-bright/40'>{recipient.email}</p>}
                            </div>
                            <span className='shrink-0 text-[10px] text-bright/28'>{formatRelativeTime(new Date(recipient.lastUsedAt).getTime())}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function composeFromReply(mode: ComposerMode, message: MailMessage, ownAddress?: string): ComposerState {
    const subject = mode === 'forward'
        ? prefixSubject(message.subject, 'Fwd:')
        : prefixSubject(message.subject, 'Re:')

    const recipients = mode === 'reply'
        ? message.replyTo.length ? message.replyTo : message.from
        : mode === 'replyAll'
            ? dedupeAddresses(
                [...(message.replyTo.length ? message.replyTo : message.from), ...message.to, ...message.cc]
                    .filter(address => address.email.toLowerCase() !== (ownAddress || '').toLowerCase())
            )
            : []

    const quoted = `\n\nOn ${formatDate(message.receivedAt, true)}, ${message.from.map(from => from.email).join(', ')} wrote:\n${message.textBody.split('\n').map(line => `> ${line}`).join('\n')}`

    return {
        open: true,
        mode,
        to: recipients.map(address => address.email).join(', '),
        cc: '',
        bcc: '',
        subject,
        body: mode === 'forward' ? `\n\n---------- Forwarded message ----------\n${message.textBody}` : quoted,
        attachments: [],
    }
}

function prefixSubject(subject: string, prefix: string) {
    return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject}`
}

function dedupeAddresses(addresses: MailAddress[]) {
    const seen = new Set<string>()
    return addresses.filter(address => {
        const key = address.email.toLowerCase()
        if (seen.has(key)) {
            return false
        }
        seen.add(key)
        return true
    })
}

async function runAction(
    messageId: string,
    overview: MailOverview,
    setError: (value: string) => void,
    load: (params?: { mailboxId?: string | null, messageId?: string | null, mailboxUser?: string | null, silent?: boolean }) => Promise<void>,
    action: 'read' | 'unread' | 'flag' | 'unflag' | 'archive' | 'junk' | 'ham' | 'trash' | 'restore'
) {
    try {
        await messageAction(messageId, { mailboxUser: overview.mailboxUser, action })
        await load({ silent: true })
    } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update message.')
    }
}

function iconForMailbox(role?: string) {
    if (role === 'inbox') return <Inbox className='h-3.5 w-3.5 text-orange-300' />
    if (role === 'archive') return <Archive className='h-3.5 w-3.5 text-emerald-300' />
    if (role === 'junk') return <ShieldAlert className='h-3.5 w-3.5 text-red-300' />
    if (role === 'trash') return <Trash2 className='h-3.5 w-3.5 text-red-200' />
    return <Mail className='h-3.5 w-3.5 text-bright/40' />
}

function formatDate(value: string, verbose = false) {
    if (!value) {
        return 'Unknown time'
    }

    return new Intl.DateTimeFormat('en', {
        dateStyle: verbose ? 'full' : 'medium',
        timeStyle: 'short',
    }).format(new Date(value))
}

function formatRelativeTime(value: number) {
    const diffMinutes = Math.max(1, Math.floor((Date.now() - value) / 60_000))
    if (diffMinutes < 60) {
        return `${diffMinutes}m`
    }

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) {
        return `${diffHours}h`
    }

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d`
}

function formatMailboxAddress(address: MailAddress) {
    return address.name ? `${address.name} <${address.email}>` : address.email
}

function prettyBytes(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function buildMailFrameHtml(html: string) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: dark; }
    html, body {
      margin: 0;
      padding: 0;
      background: #0d100d;
      color: #edf2e7;
      font-family: Manrope, Aptos, sans-serif;
    }
    body {
      padding: 24px;
      line-height: 1.65;
    }
    img, iframe, video {
      max-width: 100%;
      height: auto;
      border-radius: 14px;
    }
    a { color: #f4a261; }
    table { max-width: 100%; }
    pre, code {
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>${html}</body>
</html>`
}

async function fileToDraftAttachment(file: File): Promise<DraftAttachment> {
    const buffer = await file.arrayBuffer()
    return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        contentBase64: arrayBufferToBase64(buffer),
    }
}

function AttachmentPreview({ attachment, mailboxUser }: { attachment: MailAttachment, mailboxUser: string }) {
    const url = mailBlobUrl(mailboxUser, attachment.blobId, attachment.name)
    if (attachment.type.startsWith('image/')) {
        return (
            <a href={url} target='_blank' rel='noreferrer' className='rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.05]'>
                <img src={url} alt={attachment.name} className='h-36 w-full rounded-xl object-cover' />
                <p className='mt-2 truncate text-[11px] font-medium text-bright'>{attachment.name}</p>
            </a>
        )
    }

    if (attachment.type === 'application/pdf') {
        return (
            <div className='rounded-2xl border border-white/10 bg-white/[0.03] p-2.5'>
                <iframe title={attachment.name} src={url} className='h-48 w-full rounded-xl bg-[#0d100d]' />
                <a href={url} target='_blank' rel='noreferrer' className='mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-bright'>
                    {attachment.name}
                    <Forward className='h-3.5 w-3.5' />
                </a>
            </div>
        )
    }

    return (
        <a href={url} target='_blank' rel='noreferrer' className='rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-bright/62 transition hover:bg-white/[0.05]'>
            <p className='truncate font-medium text-bright'>{attachment.name}</p>
            <p className='mt-1 text-[10px] text-bright/36'>{attachment.type} • {prettyBytes(attachment.size)}</p>
        </a>
    )
}

function withInlineAttachments(message: MailMessage, mailboxUser: string) {
    let html = message.htmlBody
    for (const attachment of message.attachments) {
        if (attachment.cid) {
            const url = mailBlobUrl(mailboxUser, attachment.blobId, attachment.name)
            html = html.replaceAll(`cid:${attachment.cid}`, url)
            html = html.replaceAll(`cid:<${attachment.cid}>`, url)
        }
    }

    return html
}

function ActionIconButton({ label, icon, onClick }: { label: string, icon: ReactNode, onClick: () => void }) {
    return (
        <button title={label} aria-label={label} className={iconButton} onClick={onClick}>
            {icon}
        </button>
    )
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }
    return btoa(binary)
}

function MailSketch() {
    return (
        <svg className='pointer-events-none absolute -right-6 bottom-2 h-auto w-44 rotate-[1.5deg] text-bright/8' viewBox='0 0 430 190' aria-hidden='true'>
            <path fill='none' stroke='currentColor' strokeWidth='1.15' strokeLinecap='round' strokeLinejoin='round' d='M31 154 L31 90 L112 63 L197 93 L197 154' />
            <path fill='none' stroke='currentColor' strokeWidth='1.15' strokeLinecap='round' strokeLinejoin='round' d='M31 90 L112 44 L197 93' />
            <path fill='none' stroke='currentColor' strokeWidth='1.15' strokeLinecap='round' strokeLinejoin='round' d='M112 44 L112 154' />
            <path fill='none' stroke='currentColor' strokeWidth='1.15' strokeLinecap='round' strokeLinejoin='round' d='M62 154 V101 H92 V154' />
            <path fill='none' stroke='currentColor' strokeWidth='1.15' strokeLinecap='round' strokeLinejoin='round' d='M128 154 V111 H180 V154' />
            <path fill='none' stroke='currentColor' strokeWidth='0.95' strokeLinecap='round' strokeLinejoin='round' d='M225 147 L225 88 L282 62 L340 88 L340 147' />
            <path fill='none' stroke='currentColor' strokeWidth='0.95' strokeLinecap='round' strokeLinejoin='round' d='M225 88 L282 36 L340 88' />
            <path fill='none' stroke='currentColor' strokeWidth='0.95' strokeLinecap='round' strokeLinejoin='round' d='M250 147 V101 H316 V147' />
            <path fill='none' stroke='currentColor' strokeWidth='0.95' strokeLinecap='round' strokeLinejoin='round' d='M351 151 V100 L382 81 L414 100 V151' />
            <path fill='none' stroke='currentColor' strokeOpacity='0.55' strokeWidth='0.85' strokeLinecap='round' strokeLinejoin='round' d='M16 171 C67 162 102 178 153 167 C204 156 238 174 291 164 C331 156 366 168 419 160' />
        </svg>
    )
}
