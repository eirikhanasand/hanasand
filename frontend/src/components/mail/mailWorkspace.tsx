'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Archive,
    ArrowLeft,
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
import { DashboardPage, DashboardPanel, dashboardPanelClass } from '@/components/dashboard/ui'
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

type MailListFilter = 'all' | 'unread' | 'starred' | 'attachments'

const POLL_INTERVAL_MS = 10_000
const STALE_AFTER_MS = 5 * 60_000

export default function MailWorkspace({ mailboxUser }: Props) {
    const [overview, setOverview] = useState<MailOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [backgroundIssue, setBackgroundIssue] = useState('')
    const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
    const [readingMessage, setReadingMessage] = useState(false)
    const reader = useRef<HTMLElement>(null)
    useEffect(() => {
        if (readingMessage) reader.current?.scrollIntoView({ block: 'start' })
    }, [readingMessage])
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
    const selection = useRef<{ user: string | null, mailbox: string | null, message: string | null }>({ user: mailboxUser || null, mailbox: null, message: null })
    const requestVersion = useRef(0)
    const requestPending = useRef(false)
    const paginationPending = useRef(false)
    const nextPageTrigger = useRef<HTMLDivElement>(null)
    const [loadingMore, setLoadingMore] = useState(false)
    const [pageError, setPageError] = useState('')
    const [mailFilter, setMailFilter] = useState<MailListFilter>('all')

    const load = useCallback(async (params: {
        mailboxId?: string | null
        messageId?: string | null
        mailboxUser?: string | null
        silent?: boolean
    } = {}) => {
        if (params.messageId === null) setReadingMessage(false)
        const silent = Boolean(params.silent)
        if (silent && (requestPending.current || paginationPending.current)) return
        const version = ++requestVersion.current
        requestPending.current = true

        try {
            if (!silent) {
                setLoading(true)
                setError('')
            }

            const next = await fetchMailOverview({
                mailboxUser: params.mailboxUser ?? selection.current.user ?? mailboxUser ?? undefined,
                mailboxId: params.mailboxId === undefined ? selection.current.mailbox : params.mailboxId,
                messageId: params.messageId === undefined ? selection.current.message : params.messageId,
            })

            if (version !== requestVersion.current) return
            const switched = next.mailboxUser !== selection.current.user || next.selectedMailboxId !== selection.current.mailbox
            setOverview(current => {
                if (switched || params.messageId === null || !current || current.messages.length <= 50) return next
                const ids = new Set(next.messages.map(message => message.id))
                const boundary = current.messages.findIndex(message => message.id === next.messages.at(-1)?.id)
                const tail = current.messages.slice(boundary >= 0 ? boundary + 1 : 50)
                return { ...next, messages: [...next.messages, ...tail.filter(message => !ids.has(message.id))], nextCursor: current.nextCursor }
            })
            if (switched) setPageError('')
            setSelectedMailboxId(next.selectedMailboxId)
            const nextSelectedMessageId = params.messageId
                || next.selectedMessage?.id
                || next.messages.find(message => message.id === selection.current.message)?.id
                || next.messages[0]?.id
                || null
            selection.current = { user: next.mailboxUser, mailbox: next.selectedMailboxId, message: nextSelectedMessageId }
            setSelectedMessageId(nextSelectedMessageId)
            setMoveTargetMailboxId('')
            setBackgroundIssue('')
            setLastSuccessAt(Date.now())
        } catch (cause) {
            if (version !== requestVersion.current) return
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
            if (version === requestVersion.current) requestPending.current = false
            if (!silent && version === requestVersion.current) {
                setLoading(false)
            }
        }
    }, [mailboxUser])

    const loadMore = useCallback(async () => {
        if (!overview?.nextCursor || paginationPending.current || requestPending.current) return
        const version = requestVersion.current
        paginationPending.current = true
        setLoadingMore(true)
        setPageError('')
        try {
            const page = await fetchMailOverview({ mailboxUser: overview.mailboxUser, mailboxId: overview.selectedMailboxId, after: overview.nextCursor })
            if (version !== requestVersion.current) return
            setOverview(current => {
                if (!current) return current
                const ids = new Set(current.messages.map(message => message.id))
                return { ...current, messages: [...current.messages, ...page.messages.filter(message => !ids.has(message.id))], nextCursor: page.nextCursor }
            })
        } catch {
            if (version === requestVersion.current) setPageError('Could not load older messages. Try again.')
        } finally {
            paginationPending.current = false
            setLoadingMore(false)
        }
    }, [overview])

    useEffect(() => {
        const target = nextPageTrigger.current
        if (!target || !overview?.nextCursor || loadingMore || pageError) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void loadMore()
        }, { rootMargin: '300px' })
        observer.observe(target)
        return () => observer.disconnect()
    }, [loadMore, overview?.nextCursor, loadingMore, pageError])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load({ mailboxUser, mailboxId: null, messageId: null })
        }, 0)

        return () => { window.clearTimeout(timer); requestVersion.current++; requestPending.current = false }
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

    const selectedMessage = overview?.selectedMessage?.id === selectedMessageId ? overview.selectedMessage : null

    const renderedHtml = useMemo(
        () => selectedMessage ? buildMailFrameHtml(withInlineAttachments(selectedMessage, overview?.mailboxUser || '')) : '',
        [selectedMessage, overview?.mailboxUser]
    )

    const unreadCount = overview?.mailboxes.reduce((sum, mailbox) => sum + (mailbox.unreadEmails || 0), 0) ?? 0
    const showStaleWarning = Boolean(lastSuccessAt && now - lastSuccessAt > STALE_AFTER_MS)

    return (
        <DashboardPage className='xl:flex xl:h-full xl:min-h-0 xl:flex-col'>
            <DashboardPanel className='flex shrink-0 flex-wrap items-center gap-2 p-2.5 sm:p-3' id='mail-toolbar'>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                    <div className='mr-auto min-w-0'>
                        <p className='text-[10px] uppercase tracking-[0.24em] text-ui-muted'>Workspace</p>
                        <p className='truncate text-[11px] text-ui-muted'>{overview?.mailboxAddress || 'Communication'}</p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted' data-mail-counts>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{unreadCount} unread</span>
                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>{filteredMessages.length} visible</span>
                        {showStaleWarning && <span className='rounded-md border border-ui-danger/35 bg-ui-danger/10 px-2 py-1 text-ui-danger'>stale</span>}
                    </div>
                    <MailSyncStatus lastSuccessAt={lastSuccessAt} now={now} issue={backgroundIssue || error} />

                    <div className='flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1 sm:min-w-64 sm:max-w-md'>
                        <div className='relative min-w-0 flex-1'>
                            <Search className='pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-ui-muted' />
                            <input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder='Search this mailbox'
                                aria-label='Search this mailbox'
                                className={`${subtleInput} w-full pl-8`}
                            />
                        </div>
                        <button
                            type='button'
                            data-testid='mail-compose-button'
                            disabled={!overview || loading || overview.actor.canSend === false}
                            className={`${toolbarButton} shrink-0`}
                            onClick={() => setComposer({ ...emptyComposer, open: true })}
                        >
                            <MailPlus className='h-3.5 w-3.5' />
                            Create
                        </button>
                    </div>
                </div>
            </DashboardPanel>

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

            <div className={`grid min-w-0 grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 ${sidebarCompact ? 'xl:grid-cols-[80px_minmax(0,1fr)]' : 'xl:grid-cols-[220px_minmax(0,1fr)]'}`}>
                <aside
                    className={`${dashboardPanelClass} relative overflow-hidden p-3 xl:min-h-0 xl:overflow-y-auto`}
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

                        <nav aria-label='Mailboxes' className='mb-3 grid min-w-0 grid-cols-1 gap-1 border-b border-ui-border pb-3'>
                            {overview && [
                                overview.accessibleAccounts.filter(account => account.id === overview.actor.id || account.shared).sort((a, b) => Number(b.id === overview.actor.id) - Number(a.id === overview.actor.id)),
                                overview.accessibleAccounts.filter(account => account.id !== overview.actor.id && !account.shared),
                            ].map((accounts, index) => {
                                const buttons = accounts.map(account => (
                                    <button key={account.id} type='button' disabled={composer.open}
                                        aria-label={`Open ${account.shared ? account.name : account.id === overview.actor.id ? 'Inbox' : account.name}`}
                                        aria-current={overview.mailboxUser === account.id ? 'true' : undefined}
                                        title={composer.open ? 'Close the draft before opening another mailbox' : account.address}
                                        onClick={() => {
                                            setQuery('')
                                            setMailFilter('all')
                                            void load({ mailboxUser: account.id, mailboxId: null, messageId: null })
                                        }}
                                        className={`flex min-w-0 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs disabled:opacity-50 ${overview.mailboxUser === account.id ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-muted hover:bg-ui-raised'}`}>
                                        <span className='flex min-w-0 flex-1 items-center gap-2'><Inbox className='h-4 w-4 shrink-0' />
                                            {!sidebarCompact && <span className='truncate'>{account.shared ? account.name : account.id === overview.actor.id ? 'Inbox' : account.name}</span>}
                                        </span>
                                        {!sidebarCompact && <span className='shrink-0' aria-label={account.unreadCount == null ? 'Unread count unavailable' : `${account.unreadCount} unread`}>{account.unreadCount ?? '—'}</span>}
                                    </button>
                                ))
                                return index === 0 ? <div key='inboxes' className='grid min-w-0 grid-cols-1 gap-1'>{buttons}</div> : accounts.length > 0 && (
                                    <details key='other' className='min-w-0 text-xs text-ui-muted'>
                                        <summary className='cursor-pointer px-2.5 py-2' aria-label='Other mailboxes'>{sidebarCompact ? '…' : 'Other mailboxes'}</summary>
                                        <div className='grid min-w-0 grid-cols-1 max-h-64 gap-1 overflow-y-auto'>{buttons}</div>
                                    </details>
                                )
                            })}
                        </nav>
                        <div className='grid gap-1.5'>
                            {overview?.mailboxes.filter(mailbox => mailbox.role !== 'inbox').map(mailbox => (
                                <button
                                    key={mailbox.id}
                                    data-testid={`mail-mailbox-${mailbox.role || mailbox.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                    onClick={() => {
                                        setSelectedMailboxId(mailbox.id)
                                        void load({ mailboxId: mailbox.id, messageId: null })
                                    }}
                                    className={`flex min-w-0 w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition ${
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

                {!readingMessage && <section data-mail-message-list className={`${dashboardPanelClass} min-w-0 p-2.5 xl:min-h-0 xl:overflow-y-auto`}>
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

                    <div className='grid min-w-0 grid-cols-1 gap-1.5'>
                        {filteredMessages.map(message => (
                            <MessageRow
                                key={message.id}
                                message={message}
                                active={selectedMessageId === message.id}
                                onClick={() => {
                                    setReadingMessage(true)
                                    setSelectedMessageId(message.id)
                                    void load({ messageId: message.id })
                                }}
                            />
                        ))}
                        <div ref={nextPageTrigger}>
                            {overview?.nextCursor && <button type='button' className={toolbarButton} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading older messages…' : 'Load older messages'}</button>}
                            {pageError && <p role='alert' className='mt-2 text-xs text-ui-danger'>{pageError}</p>}
                        </div>
                        {!filteredMessages.length && !loading && (
                            <div className='rounded-lg border border-dashed border-ui-border px-3 py-4 text-xs text-ui-muted'>
                                {query || mailFilter !== 'all' ? 'No messages match the current view.' : 'No recent messages.'}
                            </div>
                        )}
                    </div>
                </section>}

                {readingMessage && <section ref={reader} data-mail-message-reader className={`${dashboardPanelClass} min-w-0 p-3 xl:flex xl:min-h-0 xl:flex-col xl:overflow-y-auto`}>
                    <button type='button' className={`${toolbarButton} mb-2 shrink-0 self-start`} onClick={() => setReadingMessage(false)}><ArrowLeft className='h-4 w-4' />Back to {overview?.mailboxes.find(mailbox => mailbox.id === selectedMailboxId)?.name || 'inbox'}</button>
                    {loading && <div role='status' className='px-2 py-6 text-xs text-ui-muted'>Loading message…</div>}
                    {!loading && !selectedMessage && <div className='rounded-lg border border-dashed border-ui-border px-4 py-8 text-xs text-ui-muted'>This message is unavailable. Return to the list or try opening it again.</div>}
                    {selectedMessage && overview && (
                        <div className='flex min-h-0 flex-1 flex-col gap-2'>
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
                                    <ActionIconButton label='Reply' disabled={loading || overview?.actor.canSend === false} icon={<Reply className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('reply', selectedMessage))} />
                                    <ActionIconButton label='Reply all' disabled={loading || overview?.actor.canSend === false} icon={<CornerUpLeft className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('replyAll', selectedMessage, overview.mailboxAddress))} />
                                    <ActionIconButton label='Forward' disabled={loading || overview?.actor.canSend === false} icon={<Forward className='h-3.5 w-3.5' />} onClick={() => setComposer(composeFromReply('forward', selectedMessage))} />
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
                                    className='h-72 w-full shrink-0 rounded-lg border border-ui-border xl:min-h-40 xl:flex-1'
                                    sandbox='allow-popups allow-popups-to-escape-sandbox'
                                    srcDoc={renderedHtml}
                                />
                            ) : (
                                <article className='min-w-0 wrap-anywhere rounded-lg border border-ui-border px-4 py-3 xl:min-h-40 xl:flex-1 xl:overflow-y-auto text-[13px] leading-6 whitespace-pre-wrap text-ui-text'>
                                    {selectedMessage.textBody}
                                </article>
                            )}
                        </div>
                    )}
                </section>}
            </div>

            {composer.open && overview && (
                <Composer
                    state={composer}
                    now={now}
                    mailboxAddress={overview.mailboxAddress}
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
    const intervalSeconds = POLL_INTERVAL_MS / 1000
    const label = lastSuccessAt ? `updated ${formatRelativeTime(lastSuccessAt, now)} ago` : 'waiting for first sync'
    const tone = issue ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : 'border-ui-border bg-ui-raised text-ui-muted'
    return (
        <div className={`${full ? 'mb-3 flex' : 'hidden sm:flex'} min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${tone}`} data-mail-sync-status>
            <Clock3 className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{issue ? `Reconnecting; syncs every ${intervalSeconds}s, ${label}` : `Syncs every ${intervalSeconds}s · ${label}`}</span>
        </div>
    )
}

function buildMailListFilters(messages: MailMessageSummary[]): Array<{ id: MailListFilter, label: string, count: number }> {
    return [
        { id: 'all', label: 'All', count: messages.length },
        { id: 'unread', label: 'Unread', count: messages.filter(message => !message.isRead).length },
        { id: 'starred', label: 'Starred', count: messages.filter(message => message.isFlagged).length },
        { id: 'attachments', label: 'Attachments', count: messages.filter(message => message.hasAttachment).length },
    ]
}

function messageMatchesMailFilter(message: MailMessageSummary, filter: MailListFilter) {
    if (filter === 'unread') return !message.isRead
    if (filter === 'starred') return message.isFlagged
    if (filter === 'attachments') return message.hasAttachment
    return true
}
