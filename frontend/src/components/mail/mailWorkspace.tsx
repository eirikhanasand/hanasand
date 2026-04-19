'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    Archive,
    ArrowRight,
    CornerUpLeft,
    FolderInput,
    Forward,
    Inbox,
    Mail,
    MailPlus,
    Paperclip,
    RefreshCw,
    Reply,
    Send,
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
import type { MailAddress, MailAttachment, MailMessage, MailOverview } from '@/utils/mail/types'

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

export default function MailWorkspace({ mailboxUser }: Props) {
    const [overview, setOverview] = useState<MailOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null)
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
    const [moveTargetMailboxId, setMoveTargetMailboxId] = useState('')
    const [composer, setComposer] = useState<ComposerState>(emptyComposer)
    const [creatingMailbox, setCreatingMailbox] = useState(false)
    const [creatingFilter, setCreatingFilter] = useState(false)
    const [movingMessage, setMovingMessage] = useState(false)

    async function load(params: { mailboxId?: string | null, messageId?: string | null, mailboxUser?: string | null } = {}) {
        try {
            setLoading(true)
            setError('')
            const next = await fetchMailOverview({
                mailboxUser: params.mailboxUser ?? mailboxUser ?? undefined,
                mailboxId: params.mailboxId ?? selectedMailboxId,
                messageId: params.messageId ?? selectedMessageId,
            })
            setOverview(next)
            setSelectedMailboxId(next.selectedMailboxId)
            const nextSelectedMessageId = next.selectedMessage?.id || next.messages[0]?.id || null
            setSelectedMessageId(nextSelectedMessageId)
            setMoveTargetMailboxId('')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to load the mailbox.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load({ mailboxUser })
    }, [mailboxUser])

    const selectedMessage = overview?.selectedMessage || null
    const renderedHtml = useMemo(
        () => selectedMessage ? withInlineAttachments(selectedMessage, overview?.mailboxUser || '') : '',
        [selectedMessage, overview?.mailboxUser]
    )

    return (
        <div className='grid gap-4 px-6 py-4 md:px-16 lg:px-32'>
            <section className='mail-panel glass-panel relative overflow-hidden rounded-[2rem] p-6'>
                <MailSketch />
                <div className='relative z-10 flex flex-wrap items-start justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.3em] text-orange-200/70'>Private post office</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-[-0.05em] text-bright'>Mail</h1>
                        <p className='mt-2 max-w-2xl text-sm leading-7 text-bright/50'>
                            Letters, parcels, folders, rules, replies, forwarding, and outside client access in the same quiet room.
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        {overview?.actor.canAccessAnyMailbox && (
                            <select
                                className='mail-input min-w-[10rem]'
                                value={overview.mailboxUser}
                                onChange={(event) => void load({ mailboxUser: event.target.value, mailboxId: null, messageId: null })}
                            >
                                {overview.accessibleAccounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.id}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button className='mail-button' onClick={() => setComposer({ ...emptyComposer, open: true })}>
                            <MailPlus className='h-4 w-4' /> Compose
                        </button>
                        <button className='mail-button-secondary' onClick={() => void load()}>
                            <RefreshCw className='h-4 w-4' /> Refresh
                        </button>
                    </div>
                </div>
            </section>

            {error && <div className='glass-card rounded-3xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100'>{error}</div>}

            <div className='grid gap-4 xl:grid-cols-[280px_minmax(280px,360px)_minmax(0,1fr)]'>
                <aside className='glass-card rounded-3xl p-4'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-bright'>Folders</h2>
                        <button
                            className='rounded-full border border-white/10 px-3 py-1 text-xs text-bright/60 hover:bg-white/6'
                            onClick={async () => {
                                const name = window.prompt('New mailbox name')
                                if (!name?.trim()) {
                                    return
                                }

                                setCreatingMailbox(true)
                                try {
                                    await createMailbox({ mailboxUser: overview?.mailboxUser, name: name.trim() })
                                    await load()
                                } catch (cause) {
                                    setError(cause instanceof Error ? cause.message : 'Unable to create mailbox.')
                                } finally {
                                    setCreatingMailbox(false)
                                }
                            }}
                            disabled={creatingMailbox}
                        >
                            + Folder
                        </button>
                    </div>

                    <div className='mt-4 grid gap-2'>
                        {overview?.mailboxes.map(mailbox => (
                            <button
                                key={mailbox.id}
                                className={`mailbox-item ${selectedMailboxId === mailbox.id ? 'mailbox-item-active' : ''}`}
                                onClick={() => void load({ mailboxId: mailbox.id, messageId: null })}
                            >
                                <span className='flex items-center gap-2'>
                                    {iconForMailbox(mailbox.role)}
                                    {mailbox.name}
                                </span>
                                <span className='text-xs text-bright/40'>{mailbox.unreadEmails || 0}</span>
                            </button>
                        ))}
                        {!overview?.mailboxes.length && !loading && <div className='text-sm text-bright/45'>No mailboxes yet.</div>}
                    </div>

                    {overview && (
                        <div className='mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-bright/65'>
                            <p className='text-xs uppercase tracking-[0.24em] text-bright/35'>Client settings</p>
                            <p className='mt-3'>IMAP: `{overview.settings.imapHost}:{overview.settings.imapPort}`</p>
                            <p>SMTP: `{overview.settings.smtpHost}:{overview.settings.smtpPort}`</p>
                            <p>ManageSieve: `{overview.settings.host}:{overview.settings.managesievePort}`</p>
                            <p className='mt-2'>Username: `{overview.settings.username}`</p>
                            <p>Address: `{overview.settings.address}`</p>
                            <p>Password: `{overview.mailPassword}`</p>
                        </div>
                    )}

                    <div className='mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4'>
                        <div className='flex items-center gap-2'>
                            <FolderInput className='h-4 w-4 text-orange-300' />
                            <h3 className='font-semibold text-bright'>Rules</h3>
                        </div>
                        <form
                            className='mt-4 grid gap-2'
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
                            <input name='name' className='mail-input' placeholder='Archive invoices' required />
                            <select name='field' className='mail-input'>
                                <option value='subject'>Subject</option>
                                <option value='from'>From</option>
                                <option value='body'>Body</option>
                                <option value='senderDomain'>Sender domain</option>
                            </select>
                            <input name='contains' className='mail-input' placeholder='contains...' required />
                            <input name='mailboxName' className='mail-input' placeholder='target mailbox' required />
                            <label className='flex items-center gap-2 text-sm text-bright/55'>
                                <input type='checkbox' name='markRead' />
                                mark as read after move
                            </label>
                            <button className='mail-button justify-center' disabled={creatingFilter}>
                                <FolderInput className='h-4 w-4' /> Save filter
                            </button>
                        </form>

                        <div className='mt-4 grid gap-2'>
                            {(overview?.filters || []).map(rule => (
                                <div key={rule.id} className='rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-sm text-bright/65'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <div>
                                            <p className='font-semibold text-bright'>{rule.name}</p>
                                            <p className='mt-1 text-xs text-bright/45'>
                                                when `{rule.criteria.field}` contains `{rule.criteria.contains}` move to `{rule.action.mailboxName}`
                                            </p>
                                        </div>
                                        <button
                                            className='text-xs text-red-200/80 hover:text-red-100'
                                            onClick={async () => {
                                                try {
                                                    await deleteFilter(rule.id, overview?.mailboxUser)
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
                    </div>
                </aside>

                <section className='glass-card rounded-3xl p-4'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-bright'>Messages</h2>
                        {selectedMailboxId && <span className='text-xs text-bright/35'>{overview?.messages.length || 0} shown</span>}
                    </div>

                    <div className='mt-4 grid gap-2'>
                        {(overview?.messages || []).map(message => (
                            <button
                                key={message.id}
                                className={`message-row ${selectedMessageId === message.id ? 'message-row-active' : ''}`}
                                onClick={() => void load({ messageId: message.id })}
                            >
                                <div className='flex items-center justify-between gap-2'>
                                    <div className='flex items-center gap-2'>
                                        {!message.isRead && <span className='h-2 w-2 rounded-full bg-orange-300' />}
                                        <p className='line-clamp-1 font-semibold text-bright'>{message.subject}</p>
                                    </div>
                                    <span className='text-xs text-bright/35'>{formatDate(message.receivedAt)}</span>
                                </div>
                                <p className='mt-1 text-xs text-bright/45'>{message.from.map(from => from.name || from.email).join(', ')}</p>
                                <div className='mt-2 flex items-center justify-between gap-3'>
                                    <p className='line-clamp-2 text-sm text-bright/55'>{message.preview}</p>
                                    {message.hasAttachment && <Paperclip className='h-4 w-4 shrink-0 text-bright/40' />}
                                </div>
                            </button>
                        ))}
                        {!overview?.messages.length && !loading && <div className='rounded-2xl border border-dashed border-white/10 p-5 text-sm text-bright/45'>This mailbox is empty right now.</div>}
                    </div>
                </section>

                <section className='glass-card rounded-3xl p-5'>
                    {loading && <div className='text-sm text-bright/45'>Loading mailbox…</div>}
                    {!loading && !selectedMessage && <div className='rounded-2xl border border-dashed border-white/10 p-8 text-sm text-bright/45'>Choose a message to read it here.</div>}
                    {!loading && selectedMessage && overview && (
                        <>
                            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4'>
                                <div>
                                    <p className='text-xs uppercase tracking-[0.25em] text-orange-200/70'>Selected letter</p>
                                    <h2 className='mt-2 text-2xl font-semibold text-bright'>{selectedMessage.subject}</h2>
                                    <div className='mt-3 grid gap-1 text-sm text-bright/55'>
                                        <p>From: {selectedMessage.from.map(from => from.name ? `${from.name} <${from.email}>` : from.email).join(', ')}</p>
                                        <p>To: {selectedMessage.to.map(to => to.name ? `${to.name} <${to.email}>` : to.email).join(', ')}</p>
                                        {!!selectedMessage.cc.length && <p>CC: {selectedMessage.cc.map(to => to.name ? `${to.name} <${to.email}>` : to.email).join(', ')}</p>}
                                        <p>Received: {formatDate(selectedMessage.receivedAt, true)}</p>
                                    </div>
                                </div>

                                <div className='flex flex-wrap gap-2'>
                                    <ActionButton label='Reply' icon={<Reply className='h-4 w-4' />} onClick={() => setComposer(composeFromReply('reply', selectedMessage))} />
                                    <ActionButton label='Reply all' icon={<CornerUpLeft className='h-4 w-4' />} onClick={() => setComposer(composeFromReply('replyAll', selectedMessage, overview.mailboxAddress))} />
                                    <ActionButton label='Forward' icon={<Forward className='h-4 w-4' />} onClick={() => setComposer(composeFromReply('forward', selectedMessage))} />
                                    <ActionButton label={selectedMessage.isFlagged ? 'Unstar' : 'Star'} icon={<Star className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isFlagged ? 'unflag' : 'flag')} />
                                    <ActionButton label='Archive' icon={<Archive className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'archive')} />
                                    {selectedMessage.isJunk ? (
                                        <ActionButton label='Not spam' icon={<Inbox className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'ham')} />
                                    ) : (
                                        <ActionButton label='Junk' icon={<ShieldAlert className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'junk')} />
                                    )}
                                    <ActionButton label='Trash' icon={<Trash2 className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, 'trash')} />
                                    <ActionButton label={selectedMessage.isRead ? 'Unread' : 'Read'} icon={<Mail className='h-4 w-4' />} onClick={() => void runAction(selectedMessage.id, overview, setError, load, selectedMessage.isRead ? 'unread' : 'read')} />
                                </div>
                            </div>

                            <div className='mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <select
                                        className='mail-input min-w-[14rem] flex-1'
                                        value={moveTargetMailboxId}
                                        onChange={event => setMoveTargetMailboxId(event.target.value)}
                                    >
                                        <option value=''>Move to folder…</option>
                                        {overview.mailboxes
                                            .filter(mailbox => mailbox.id !== selectedMailboxId)
                                            .map(mailbox => (
                                                <option key={mailbox.id} value={mailbox.id}>
                                                    {mailbox.name}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        className='mail-button-secondary'
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
                                                await load({ mailboxId: moveTargetMailboxId, messageId: null })
                                            } catch (cause) {
                                                setError(cause instanceof Error ? cause.message : 'Unable to move message.')
                                            } finally {
                                                setMovingMessage(false)
                                            }
                                        }}
                                    >
                                        <FolderInput className='h-4 w-4' /> Move
                                    </button>
                                </div>
                            </div>

                            <div className='mt-5 grid gap-4'>
                                {!!selectedMessage.attachments.length && (
                                    <div className='rounded-3xl border border-white/10 bg-white/[0.03] p-4'>
                                        <div className='flex items-center gap-2 text-sm font-semibold text-bright'>
                                            <Paperclip className='h-4 w-4 text-orange-300' />
                                            Attachments
                                        </div>
                                        <div className='mt-3 grid gap-3 md:grid-cols-2'>
                                            {selectedMessage.attachments.map(attachment => <AttachmentPreview key={attachment.blobId} attachment={attachment} mailboxUser={overview.mailboxUser} />)}
                                        </div>
                                    </div>
                                )}

                                {selectedMessage.htmlBody ? (
                                    <iframe
                                        title='HTML mail'
                                        className='min-h-[28rem] w-full rounded-3xl border border-white/10 bg-white'
                                        sandbox='allow-popups allow-popups-to-escape-sandbox'
                                        srcDoc={renderedHtml}
                                    />
                                ) : (
                                    <article className='mail-body rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 whitespace-pre-wrap text-bright/82'>
                                        {selectedMessage.textBody}
                                    </article>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {composer.open && overview && (
                <Composer
                    state={composer}
                    mailboxUser={overview.mailboxUser}
                    onChange={setComposer}
                    onClose={() => setComposer(emptyComposer)}
                    onSubmit={async (next) => {
                        try {
                            await sendMail({
                                mailboxUser: overview.mailboxUser,
                                to: next.to,
                                cc: next.cc,
                                bcc: next.bcc,
                                subject: next.subject,
                                textBody: next.body,
                                attachments: next.attachments,
                            })
                            setComposer(emptyComposer)
                            await load()
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : 'Unable to send mail.')
                        }
                    }}
                />
            )}
        </div>
    )
}

function Composer({ state, mailboxUser, onChange, onClose, onSubmit }: {
    state: ComposerState
    mailboxUser: string
    onChange: (state: ComposerState) => void
    onClose: () => void
    onSubmit: (state: ComposerState) => Promise<void>
}) {
    const [submitting, setSubmitting] = useState(false)

    function patch(values: Partial<ComposerState>) {
        onChange({ ...state, ...values })
    }

    return (
        <div className='fixed inset-0 z-[1200] grid place-items-center bg-black/55 p-4 backdrop-blur-sm'>
            <form
                className='glass-panel w-full max-w-3xl rounded-[2rem] p-6'
                onSubmit={async (event) => {
                    event.preventDefault()
                    setSubmitting(true)
                    try {
                        await onSubmit(state)
                    } finally {
                        setSubmitting(false)
                    }
                }}
            >
                <div className='flex items-center justify-between gap-4'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.25em] text-orange-200/70'>{state.mode}</p>
                        <h3 className='mt-2 text-2xl font-semibold text-bright'>Compose mail</h3>
                    </div>
                    <button type='button' className='rounded-full border border-white/10 px-4 py-2 text-sm text-bright/65 hover:bg-white/5' onClick={onClose}>Close</button>
                </div>

                <div className='mt-5 grid gap-3'>
                    <input className='mail-input' placeholder='To' value={state.to} onChange={event => patch({ to: event.target.value })} />
                    <input className='mail-input' placeholder='CC' value={state.cc} onChange={event => patch({ cc: event.target.value })} />
                    <input className='mail-input' placeholder='BCC' value={state.bcc} onChange={event => patch({ bcc: event.target.value })} />
                    <input className='mail-input' placeholder='Subject' value={state.subject} onChange={event => patch({ subject: event.target.value })} />
                    <textarea className='mail-input min-h-[14rem] resize-y' placeholder='Write your message...' value={state.body} onChange={event => patch({ body: event.target.value })} />
                    <label className='rounded-2xl border border-dashed border-white/15 p-4 text-sm text-bright/55 hover:bg-white/[0.03]'>
                        <span className='inline-flex items-center gap-2'><Paperclip className='h-4 w-4' /> Add attachments</span>
                        <input
                            type='file'
                            multiple
                            className='hidden'
                            onChange={async (event) => {
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
                                <div key={`${attachment.name}-${index}`} className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-bright/65'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <div>
                                            <p className='font-semibold text-bright'>{attachment.name}</p>
                                            <p className='text-xs text-bright/40'>{prettyBytes(attachment.size)}</p>
                                        </div>
                                        <button
                                            type='button'
                                            className='text-xs text-red-200/80 hover:text-red-100'
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

                <div className='mt-5 flex justify-end gap-2'>
                    <button type='button' className='mail-button-secondary' onClick={onClose}>Cancel</button>
                    <button type='submit' className='mail-button' disabled={submitting}>
                        <Send className='h-4 w-4' /> {submitting ? 'Sending…' : `Send from ${mailboxUser}`}
                    </button>
                </div>
            </form>
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
    load: (params?: { mailboxId?: string | null, messageId?: string | null, mailboxUser?: string | null }) => Promise<void>,
    action: 'read' | 'unread' | 'flag' | 'unflag' | 'archive' | 'junk' | 'ham' | 'trash' | 'restore'
) {
    try {
        await messageAction(messageId, { mailboxUser: overview.mailboxUser, action })
        await load()
    } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update message.')
    }
}

function iconForMailbox(role?: string) {
    if (role === 'inbox') return <Inbox className='h-4 w-4 text-orange-300' />
    if (role === 'archive') return <Archive className='h-4 w-4 text-emerald-300' />
    if (role === 'junk') return <ShieldAlert className='h-4 w-4 text-red-300' />
    if (role === 'trash') return <Trash2 className='h-4 w-4 text-red-200' />
    return <Mail className='h-4 w-4 text-bright/45' />
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

function prettyBytes(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
            <a href={url} target='_blank' rel='noreferrer' className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
                <img src={url} alt={attachment.name} className='h-48 w-full rounded-xl object-cover' />
                <p className='mt-2 text-sm font-semibold text-bright'>{attachment.name}</p>
            </a>
        )
    }

    if (attachment.type === 'application/pdf') {
        return (
            <div className='rounded-2xl border border-white/10 bg-white/[0.03] p-3'>
                <iframe title={attachment.name} src={url} className='h-64 w-full rounded-xl bg-white' />
                <a href={url} target='_blank' rel='noreferrer' className='mt-2 inline-flex items-center gap-2 text-sm font-semibold text-bright'>
                    {attachment.name} <ArrowRight className='h-4 w-4' />
                </a>
            </div>
        )
    }

    return (
        <a href={url} target='_blank' rel='noreferrer' className='rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-bright/65'>
            <p className='font-semibold text-bright'>{attachment.name}</p>
            <p className='mt-1 text-xs text-bright/40'>{attachment.type} • {prettyBytes(attachment.size)}</p>
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

function ActionButton({ label, icon, onClick }: { label: string, icon: ReactNode, onClick: () => void }) {
    return (
        <button className='mail-button-secondary' onClick={onClick}>
            {icon}
            {label}
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
        <svg className='mail-sketch background-sketch' viewBox='0 0 430 190' aria-hidden='true'>
            <path d='M31 154 L31 90 L112 63 L197 93 L197 154' />
            <path d='M31 90 L112 44 L197 93' />
            <path d='M112 44 L112 154' />
            <path d='M62 154 V101 H92 V154' />
            <path d='M128 154 V111 H180 V154' />
            <path className='sketch-shade' d='M45 102 H108' />
            <path className='sketch-shade' d='M45 117 H108' />
            <path className='sketch-shade' d='M45 132 H108' />
            <path className='sketch-shade' d='M120 104 H191' />
            <path className='sketch-shade' d='M120 120 H191' />
            <path className='sketch-shade' d='M120 138 H191' />
            <path d='M225 147 L225 88 L282 62 L340 88 L340 147' />
            <path d='M225 88 L282 36 L340 88' />
            <path d='M250 147 V101 H316 V147' />
            <path d='M260 111 H307' />
            <path d='M260 123 H307' />
            <path className='sketch-shade' d='M235 99 H331' />
            <path className='sketch-shade' d='M235 114 H331' />
            <path className='sketch-shade' d='M235 130 H331' />
            <path d='M351 151 V100 L382 81 L414 100 V151' />
            <path d='M360 151 V116 H373 V151' />
            <path d='M389 151 V116 H402 V151' />
            <path d='M355 100 H410' />
            <path className='sketch-distant' d='M16 171 C67 162 102 178 153 167 C204 156 238 174 291 164 C331 156 366 168 419 160' />
            <path className='sketch-shade' d='M223 64 C244 76 266 79 281 73 C297 67 310 68 329 79' />
            <path className='sketch-shade' d='M31 74 C54 67 78 71 99 61' />
            <path className='sketch-shade' d='M95 61 C122 69 145 74 170 80' />
        </svg>
    )
}
