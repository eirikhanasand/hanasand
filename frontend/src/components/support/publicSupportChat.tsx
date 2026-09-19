'use client'

import { ArrowUp, LoaderCircle, Sparkles, UserRound } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'

type Message = { id: string; body: string; sender_kind: 'user' | 'assistant' | 'support' | 'system'; sender_name: string; request_id?: string }
type Conversation = { channel: 'ai' | 'human'; status: string; pending: boolean; messages: Message[]; error?: string; accepted?: boolean }
type Submission = { requestId: string; message: string; handoff?: boolean }
const empty: Conversation = { channel: 'ai', status: 'open', pending: false, messages: [] }

// Render only same-site links from the assistant, never HTML or arbitrary model URLs.
function MessageBody({ text }: { text: string }) {
    return <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{text.split(/(\[[^\]]+\]\(\/[^\s)]*\))/g).map((part, index) => {
        const match = /^\[([^\]]+)\]\((\/[^\s)]*)\)$/.exec(part)
        return match && !match[2].startsWith('//') && !match[2].includes('\\') ? <a key={index} href={match[2]} className='font-medium underline underline-offset-2'>{match[1]}</a> : part
    })}</p>
}

export default function PublicSupportChat() {
    const [conversation, setConversation] = useState<Conversation>(empty)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [transferring, setTransferring] = useState(false)
    const [error, setError] = useState('')
    const [refreshError, setRefreshError] = useState('')
    const [outgoing, setOutgoing] = useState<Submission | null>(null)
    const [retry, setRetry] = useState<Submission | null>(null)
    const log = useRef<HTMLDivElement>(null)
    const mounted = useRef(true)
    const revision = useRef(0)
    const sendingRef = useRef(false)

    const refresh = useCallback(async () => {
        const version = revision.current
        const response = await fetch('/api/support/chat', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'We could not load your conversation.')
        if (mounted.current && version === revision.current) { setConversation(payload); setRefreshError('') }
    }, [])

    useEffect(() => {
        mounted.current = true
        void refresh().catch(error => { if (mounted.current) setError(error.message) }).finally(() => { if (mounted.current) setLoading(false) })
        const timer = window.setInterval(() => { if (!sendingRef.current) void refresh().catch(() => { if (mounted.current) setRefreshError('Could not refresh your conversation. Reconnecting…') }) }, 4000)
        return () => { mounted.current = false; window.clearInterval(timer) }
    }, [refresh])
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [conversation.messages.length, sending])

    async function submit(submission: Submission) {
        const handoff = submission.handoff === true
        if (handoff ? transferring : sendingRef.current) return
        if (handoff) setTransferring(true)
        else { setSending(true); sendingRef.current = true; setOutgoing(submission) }
        revision.current += 1
        setError('')
        try {
            const response = await fetch('/api/support/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(submission) })
            const payload = await response.json() as Conversation
            if (!response.ok) throw new Error(payload.error || 'We could not send your message. Please try again.')
            if (!mounted.current) return
            // Fetch current state after the write so a concurrent handoff cannot be overwritten by an older reply.
            revision.current += 1
            await refresh()
            if (payload.accepted !== false && !handoff) setInput(current => current.trim() === submission.message ? '' : current)
            setRetry(payload.error && !handoff ? submission : null)
            setError(payload.error || '')
        } catch (error) {
            if (mounted.current) {
                setError(error instanceof Error ? error.message : 'We could not send your message. Please try again.')
                setRetry(submission)
            }
        } finally {
            if (handoff) setTransferring(false)
            else { setSending(false); sendingRef.current = false; setOutgoing(null) }
        }
    }
    function send(event: FormEvent) {
        event.preventDefault()
        const message = input.trim()
        if (!message) return
        void submit(retry?.message === message ? retry : { requestId: crypto.randomUUID(), message })
    }
    const human = conversation.channel === 'human'
    const busy = sending || conversation.pending
    const lastMessage = conversation.messages.at(-1)
    const unanswered = !human && !busy && lastMessage?.sender_kind === 'user' && lastMessage.request_id
        ? { requestId: lastMessage.request_id, message: lastMessage.body } : null
    const visibleMessages = outgoing && !conversation.messages.some(message => message.request_id === outgoing.requestId)
        ? [...conversation.messages, { id: outgoing.requestId, body: outgoing.message, sender_kind: 'user' as const, sender_name: 'You' }]
        : conversation.messages
    return (
        <section aria-label='Support chat' className='grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]'>
            <div ref={log} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto overscroll-contain px-5 py-5'>
                {!visibleMessages.length ? <div className='flex min-h-full flex-col justify-center pb-3'>
                    <div className='mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-ui-primary/10 text-ui-primary'><Sparkles className='h-5 w-5' aria-hidden='true' /></div>
                    <h3 className='text-xl font-semibold tracking-tight text-ui-text'>How can we help?</h3>
                    <p className='mt-2 max-w-64 text-sm leading-6 text-ui-muted'>Ask Hanasand AI, or talk to a member of our team.</p>
                    <div className='mt-6 flex flex-wrap gap-2'>{['Account help', 'Billing question', 'Using Hanasand'].map(topic => <button key={topic} type='button' disabled={loading || sending} onClick={() => setInput(topic)} className='rounded-full border border-ui-border px-3 py-2 text-xs text-ui-text transition hover:border-ui-primary hover:bg-ui-primary/5 disabled:opacity-50'>{topic}</button>)}</div>
                </div> : <div className='grid gap-4'>{visibleMessages.map(message => message.sender_kind === 'system'
                    ? <p key={message.id} className='px-2 py-1 text-center text-xs leading-5 text-ui-muted'>{message.body}</p>
                    : <div key={message.id} className={`min-w-0 max-w-[92%] ${message.sender_kind === 'user' ? 'justify-self-end' : 'justify-self-start'}`}>
                        <p className={`mb-1.5 text-[11px] font-medium text-ui-muted ${message.sender_kind === 'user' ? 'text-right' : ''}`}>{message.sender_name}</p>
                        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.sender_kind === 'user' ? 'rounded-tr-md bg-ui-primary text-ui-canvas' : 'rounded-tl-md bg-ui-raised text-ui-text'}`}><MessageBody text={message.body} /></div>
                    </div>)}</div>}
                {busy && !human ? <p role='status' className='mt-4 flex items-center gap-2 text-xs text-ui-muted'><LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />Hanasand AI is thinking…</p> : null}
            </div>
            <div className='min-w-0 border-t border-ui-border bg-ui-panel px-4 pb-3 pt-3'>
                {error ? <div role='alert' className='mb-3 text-xs leading-5 text-ui-danger'>{error}{retry ? <button type='button' disabled={sending || transferring} className='ml-2 font-semibold underline disabled:opacity-50' onClick={() => void submit(retry)}>Retry</button> : null}</div> : null}
                {!error && refreshError ? <p role='status' className='mb-2 text-xs text-ui-muted'>{refreshError}</p> : null}
                {!error && unanswered ? <button type='button' onClick={() => void submit(unanswered)} className='mb-2 text-xs font-medium text-ui-primary hover:underline'>Retry AI answer</button> : null}
                <form onSubmit={send} className='flex min-w-0 items-end gap-2 rounded-2xl border border-ui-border bg-ui-canvas p-2 focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/10'>
                    <textarea aria-label='Message' rows={2} maxLength={4000} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!loading && !busy) send(event) } }} placeholder={human ? 'Message the support team…' : 'Ask a question…'} className='min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-ui-text outline-none placeholder:text-ui-muted' />
                    <button type='submit' disabled={loading || busy || !input.trim()} aria-label='Send message' className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ui-primary text-ui-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-40'>{sending ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <ArrowUp className='h-4 w-4' />}</button>
                </form>
                <div className='mt-3 flex min-h-7 items-center justify-center'>
                    {human ? <p className='flex items-center gap-1.5 text-xs text-ui-muted'><UserRound className='h-3.5 w-3.5' />{conversation.status === 'closed' ? 'Conversation closed · Send a message to reopen' : 'Connected to the support queue'}</p> : <button type='button' disabled={loading || transferring} onClick={() => void submit({ requestId: crypto.randomUUID(), message: 'I\'d like to speak with a human.', handoff: true })} className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'><UserRound className='h-3.5 w-3.5' />{transferring ? 'Connecting…' : 'Talk to a human'}</button>}
                </div>
            </div>
        </section>
    )
}

export function PublicSupportPanel() {
    return (
        <section className='mx-auto grid h-[calc(100dvh-9rem)] min-h-96 w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-sm' aria-label='Guest support'>
            <header className='flex items-center gap-3 border-b border-ui-border px-5 py-4'>
                <span className='grid h-9 w-9 place-items-center rounded-xl bg-ui-primary text-ui-canvas'><Sparkles className='h-4 w-4' aria-hidden='true' /></span>
                <div><h1 className='text-sm font-semibold text-ui-text'>Hanasand AI</h1><p className='mt-0.5 text-xs text-ui-muted'>Support</p></div>
            </header>
            <PublicSupportChat />
        </section>
    )
}
