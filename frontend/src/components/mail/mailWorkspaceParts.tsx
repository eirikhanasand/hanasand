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
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                active
                    ? 'border-ui-primary bg-ui-primary/10'
                    : 'border-transparent bg-ui-raised hover:border-ui-border hover:bg-ui-panel'
            }`}
        >
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1'>
                    <div className='flex min-w-0 items-center gap-2'>
                        {!message.isRead && <span className='h-1.5 w-1.5 rounded-full bg-ui-primary' />}
                        <p className='truncate text-xs font-medium text-ui-text'>{message.subject}</p>
                    </div>
                    <div className='mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-ui-muted'>
                        <span className='truncate'>{senderLine}</span>
                        {message.preview ? <span className='shrink-0 text-ui-muted'>•</span> : null}
                        {message.preview ? <span className='truncate text-ui-muted'>{message.preview}</span> : null}
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-2 pt-0.5'>
                    {message.hasAttachment && <Paperclip className='h-3.5 w-3.5 text-ui-muted' />}
                    <span className='text-[10px] text-ui-muted'>{formatDate(message.receivedAt)}</span>
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
        <div className='fixed inset-0 z-1400 grid place-items-center bg-ui-canvas/75 p-4 backdrop-blur-sm'>
            <form
                data-testid='mail-compose-form'
                className='w-full max-w-3xl rounded-[28px] border border-ui-border bg-ui-panel p-3 shadow-xl backdrop-blur-2xl sm:p-4'
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
                <div className='flex items-center justify-between gap-3 border-b border-ui-border pb-3'>
                    <div>
                        <p className='text-[10px] uppercase tracking-[0.28em] text-ui-muted'>{state.mode}</p>
                        <h3 className='mt-1 text-base font-semibold text-ui-text'>Create message</h3>
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
                        className='min-h-56 w-full rounded-[20px] border border-ui-border bg-ui-raised px-3 py-3 text-[13px] leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:bg-ui-panel sm:min-h-64'
                        placeholder='Write your message...'
                        value={state.body}
                        onChange={(event) => patch({ body: event.target.value })}
                    />

                    <label className='inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ui-border bg-ui-raised px-3 py-2 text-[11px] text-ui-muted hover:bg-ui-panel hover:text-ui-text'>
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
                                <div key={`${attachment.name}-${index}`} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-xs font-medium text-ui-text'>{attachment.name}</p>
                                            <p className='text-[10px] text-ui-muted'>{prettyBytes(attachment.size)}</p>
                                        </div>
                                        <button
                                            type='button'
                                            className='text-[10px] text-ui-danger hover:underline'
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
                    <p className='text-[11px] text-ui-muted'>Sending as `{mailboxUser}`</p>
                    <div className='flex items-center gap-2'>
                        <button type='button' className={toolbarButton} onClick={onClose}>Cancel</button>
                        <button data-testid='mail-compose-send' type='submit' className='inline-flex h-8 items-center gap-1.5 rounded-lg bg-ui-primary px-3 text-[11px] font-medium text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45' disabled={submitting}>
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
                <div className='absolute left-0 right-0 top-[calc(100%+0.35rem)] z-10 rounded-lg border border-ui-border bg-ui-panel p-1 shadow-xl backdrop-blur-xl'>
                    {visibleSuggestions.map((recipient) => (
                        <button
                            key={recipient.email}
                            type='button'
                            data-testid={`mail-recipient-suggestion-${recipient.email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            className='flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-ui-raised'
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applySuggestion(recipient)}
                        >
                            <div className='min-w-0'>
                                <p className='truncate text-xs text-ui-text'>{recipient.name || recipient.email}</p>
                                {recipient.name && <p className='truncate text-[10px] text-ui-muted'>{recipient.email}</p>}
                            </div>
                            <span className='shrink-0 text-[10px] text-ui-muted'>
                                {formatRelativeTime(new Date(recipient.lastUsedAt).getTime(), now)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
