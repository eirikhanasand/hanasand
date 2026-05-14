'use client'

import { useState } from 'react'
import {
    Paperclip,
    Send,
} from 'lucide-react'
import type { RecentMailRecipient, MailMessageSummary } from '@/utils/mail/types'
import { fileToDraftAttachment, formatDate, formatRelativeTime, prettyBytes, subtleInput, toolbarButton, type ComposerState } from './utils'

export function MessageRow({ message, active, onClick }: {
    message: MailMessageSummary
    active: boolean
    onClick: () => void
}) {
    const senderLine = message.from.map((from) => from.name || from.email).join(', ')

    return (
        <button
            data-testid={`mail-message-${message.id}`}
            onClick={onClick}
            className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                active
                    ? 'border-orange-300/30 bg-orange-300/10'
                    : 'border-transparent bg-white/2 hover:border-white/10 hover:bg-white/4'
            }`}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1'>
                    <div className='flex min-w-0 items-center gap-2'>
                        {!message.isRead && <span className='h-1.5 w-1.5 rounded-full bg-orange-300' />}
                        <p className='truncate text-xs font-medium text-bright'>{message.subject}</p>
                    </div>
                    <div className='mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-bright/44'>
                        <span className='truncate'>{senderLine}</span>
                        {message.preview ? <span className='shrink-0 text-bright/24'>•</span> : null}
                        {message.preview ? <span className='truncate text-bright/54'>{message.preview}</span> : null}
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-2 pt-0.5'>
                    {message.hasAttachment && <Paperclip className='h-3.5 w-3.5 text-bright/34' />}
                    <span className='text-[10px] text-bright/32'>{formatDate(message.receivedAt)}</span>
                </div>
            </div>
        </button>
    )
}

export function Composer({
    state,
    now,
    mailboxUser,
    recentRecipients,
    onChange,
    onClose,
    onSubmit,
}: {
    state: ComposerState
    now: number
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
        <div className='fixed inset-0 z-1400 grid place-items-center bg-black/50 p-4 backdrop-blur-sm'>
            <form
                data-testid='mail-compose-form'
                className='w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#0f120f]/92 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-4'
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
                <div className='flex items-center justify-between gap-3 border-b border-white/8 pb-3'>
                    <div>
                        <p className='text-[10px] uppercase tracking-[0.28em] text-bright/34'>{state.mode}</p>
                        <h3 className='mt-1 text-base font-semibold text-bright'>Create message</h3>
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
                        onBlur={() => window.setTimeout(() => setActiveRecipientField((current) => current === 'to' ? null : current), 120)}
                        suggestions={activeRecipientField === 'to' ? recentRecipients : []}
                        now={now}
                    />
                    <div className='grid gap-2 md:grid-cols-2'>
                        <RecipientField
                            placeholder='CC'
                            value={state.cc}
                            onChange={(value) => patch({ cc: value })}
                            onFocus={() => setActiveRecipientField('cc')}
                            onBlur={() => window.setTimeout(() => setActiveRecipientField((current) => current === 'cc' ? null : current), 120)}
                            suggestions={activeRecipientField === 'cc' ? recentRecipients : []}
                            now={now}
                        />
                        <RecipientField
                            placeholder='BCC'
                            value={state.bcc}
                            onChange={(value) => patch({ bcc: value })}
                            onFocus={() => setActiveRecipientField('bcc')}
                            onBlur={() => window.setTimeout(() => setActiveRecipientField((current) => current === 'bcc' ? null : current), 120)}
                            suggestions={activeRecipientField === 'bcc' ? recentRecipients : []}
                            now={now}
                        />
                    </div>
                    <input
                        data-testid='mail-compose-subject'
                        className={`${subtleInput} w-full`}
                        placeholder='Subject'
                        value={state.subject}
                        onChange={(event) => patch({ subject: event.target.value })}
                    />
                    <textarea
                        data-testid='mail-compose-body'
                        className='min-h-56 w-full rounded-[20px] border border-white/10 bg-white/3 px-3 py-3 text-[13px] leading-6 text-bright outline-none transition placeholder:text-bright/28 focus:border-orange-300/45 focus:bg-white/5 sm:min-h-64'
                        placeholder='Write your message...'
                        value={state.body}
                        onChange={(event) => patch({ body: event.target.value })}
                    />

                    <label className='inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/2 px-3 py-2 text-[11px] text-bright/56 hover:bg-white/4'>
                        <Paperclip className='h-3.5 w-3.5' />
                        Add attachments
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
                                <div key={`${attachment.name}-${index}`} className='rounded-2xl border border-white/10 bg-white/3 px-3 py-2'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-xs font-medium text-bright'>{attachment.name}</p>
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
    now,
    onChange,
    onFocus,
    onBlur,
    suggestions,
    placeholder,
    testId,
}: {
    value: string
    now: number
    onChange: (value: string) => void
    onFocus: () => void
    onBlur: () => void
    suggestions: RecentMailRecipient[]
    placeholder: string
    testId?: string
}) {
    const currentToken = value.split(',').at(-1)?.trim().toLowerCase() || ''
    const visibleSuggestions = suggestions
        .filter((recipient) => {
            if (!currentToken) {
                return true
            }

            const label = `${recipient.name || ''} ${recipient.email}`.toLowerCase()
            return label.includes(currentToken)
        })
        .slice(0, 6)

    function applySuggestion(recipient: RecentMailRecipient) {
        const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
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
                onChange={(event) => onChange(event.target.value)}
            />
            {!!visibleSuggestions.length && (
                <div className='absolute left-0 right-0 top-[calc(100%+0.35rem)] z-10 rounded-2xl border border-white/10 bg-[#101310]/96 p-1 shadow-[0_22px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl'>
                    {visibleSuggestions.map((recipient) => (
                        <button
                            key={recipient.email}
                            type='button'
                            data-testid={`mail-recipient-suggestion-${recipient.email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            className='flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5'
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applySuggestion(recipient)}
                        >
                            <div className='min-w-0'>
                                <p className='truncate text-xs text-bright'>{recipient.name || recipient.email}</p>
                                {recipient.name && <p className='truncate text-[10px] text-bright/40'>{recipient.email}</p>}
                            </div>
                            <span className='shrink-0 text-[10px] text-bright/28'>
                                {formatRelativeTime(new Date(recipient.lastUsedAt).getTime(), now)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
