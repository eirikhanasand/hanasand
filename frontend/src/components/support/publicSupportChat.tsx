'use client'

import { ArrowUp, LoaderCircle, Sparkles, UserRound } from 'lucide-react'
import SupportFeedback, { type Feedback } from './supportFeedback'
import useSupportLive from './useSupportLive'
import useSupportUnread from './useSupportUnread'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Message = { id: string; body: string; sender_kind: 'user' | 'assistant' | 'support' | 'system'; sender_name: string; request_id?: string }
type Ticket = { id: string; subject: string; reply_count: number }
type Conversation = Feedback & { id?: string; tickets?: Ticket[]; agent_name?: string; channel: 'ai' | 'human'; status: string; pending: boolean; messages: Message[]; error?: string; accepted?: boolean }
type Submission = { requestId: string; message: string; handoff?: boolean; conversationId?: string }
const emptyTickets: Ticket[] = []
const empty: Conversation = { channel: 'ai', status: 'open', pending: false, messages: [] }

// Render only same-site links from the assistant, never HTML or arbitrary model URLs.
function MessageBody({ text }: { text: string }) {
    return <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{text.split(/(\[[^\]]+\]\(\/[^\s)]*\))/g).map((part, index) => {
        const match = /^\[([^\]]+)\]\((\/[^\s)]*)\)$/.exec(part)
        return match && !match[2].startsWith('//') && !match[2].includes('\\') ? <a key={index} href={match[2]} className='font-medium underline underline-offset-2'>{match[1]}</a> : part
    })}</p>
}

export default function PublicSupportChat({ active = true, onUnreadChange }: { active?: boolean; onUnreadChange?: (count: number) => void }) {
    const [selectedId, setSelectedId] = useState('')
    const selection = useRef('')
    const restoredSelection = useRef(false)
    const realtime = useRef(false)
    const drafts = useRef<Record<string, string>>({})
    const [conversation, setConversation] = useState<Conversation>(empty)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [pendingMessages, setPendingMessages] = useState<Record<string, Submission>>({})
    const [transfers, setTransfers] = useState<Record<string, boolean>>({})
    const sending = Boolean(pendingMessages[selectedId])
    const transferring = Boolean(transfers[selectedId])
    const outgoing = pendingMessages[selectedId] || null
    const [error, setError] = useState('')
    const [refreshError, setRefreshError] = useState('')
    const [retry, setRetry] = useState<Submission | null>(null)
    const log = useRef<HTMLDivElement>(null)
    const mounted = useRef(true)
    const revision = useRef(0)
    const inFlight = useRef(new Map<string, string>())
    const failures = useRef<Record<string, { message: string; submission: Submission }>>({})


    const refresh = useCallback(async () => {
        const version = ++revision.current
        const response = await fetch(`/api/support/chat${selection.current ? `?conversationId=${encodeURIComponent(selection.current)}` : ''}`, { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'We could not load your conversation.')
        if (mounted.current && version === revision.current) {
            realtime.current = Array.isArray(payload.tickets)
            if (!realtime.current) { selection.current = ''; setSelectedId('') }
            if (restoredSelection.current) {
                restoredSelection.current = false
                if (!payload.id && selection.current) { selection.current = crypto.randomUUID(); setSelectedId(selection.current) }
            }
            // Keep the old single-chat read marker when upgrading to per-chat history.
            try {
                const key = 'hanasand-support-read:visitor'
                const read = JSON.parse(localStorage.getItem(key) || '{}')
                const readId = payload.id || 'legacy'
                if (read[readId] === undefined) {
                    const replies = payload.messages.filter((message: Message) => ['assistant', 'support'].includes(message.sender_kind))
                    const index = replies.findIndex((message: Message) => message.id === localStorage.getItem('hanasand-support-last-read'))
                    if (index >= 0) { read[readId] = index + 1; localStorage.setItem(key, JSON.stringify(read)) }
                }
            } catch { /* Read markers are optional when browser storage is unavailable. */ }
            setConversation(payload); setRefreshError(''); setLoading(false)
            if (!selection.current && payload.id) { selection.current = payload.id; setSelectedId(payload.id) }
        }
    }, [])

    useEffect(() => {
        mounted.current = true
        try { selection.current = localStorage.getItem('hanasand-support-selected') || ''; restoredSelection.current = Boolean(selection.current); setSelectedId(selection.current) } catch { /* Use the newest conversation. */ }
        return () => { mounted.current = false }
    }, [])
    useEffect(() => { if (selectedId) try { localStorage.setItem('hanasand-support-selected', selectedId) } catch { /* Selection is still available in this tab. */ } }, [selectedId])
    const connection = useSupportLive(async () => {
        try { await refresh(); return realtime.current } catch (error) { if (mounted.current) { setRefreshError(error instanceof Error ? error.message : 'Reconnecting…'); setLoading(false) } }
    }, true)
    const legacy = !Array.isArray(conversation.tickets)
    const tickets = useMemo(() => conversation.tickets || (conversation.messages.length ? [{ id: 'legacy', subject: 'Support', reply_count: conversation.messages.filter(message => ['assistant', 'support'].includes(message.sender_kind)).length }] : emptyTickets), [conversation])
    const unread = useSupportUnread(tickets, legacy ? 'legacy' : selectedId, active, 'visitor')
    useEffect(() => { onUnreadChange?.(Object.values(unread).reduce((sum, count) => sum + count, 0)) }, [unread, onUnreadChange])
    async function selectChat(id: string) {
        drafts.current[selection.current] = input
        selection.current = id; setSelectedId(id)
        try { localStorage.setItem('hanasand-support-selected', id) } catch { /* Selection still works in this tab. */ }
        revision.current += 1
        setInput(drafts.current[id] || ''); setError(failures.current[id]?.message || ''); setRetry(failures.current[id]?.submission || null)
        setConversation(current => ({ ...empty, id, tickets: current.tickets }))
        setLoading(true)
        try { await refresh() } catch { setRefreshError('Could not load this chat. Reconnecting…') } finally { setLoading(false) }
    }
    useEffect(() => { if (active && log.current) log.current.scrollTop = log.current.scrollHeight }, [active, conversation.messages.length, sending])

    async function submit(submission: Submission) {
        const id = submission.conversationId || selection.current || (legacy ? '' : crypto.randomUUID())
        submission = { ...submission, conversationId: id || undefined }
        if (!selection.current && id) { selection.current = id; setSelectedId(id) }
        const handoff = submission.handoff === true
        const key = `${id}:${handoff ? 'handoff' : 'message'}`
        if (inFlight.current.has(key)) return
        inFlight.current.set(key, submission.requestId)
        if (handoff) setTransfers(current => ({ ...current, [id]: true }))
        else setPendingMessages(current => ({ ...current, [id]: submission }))
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
            if (payload.accepted !== false && !handoff && (!submission.conversationId || selection.current === submission.conversationId)) setInput(current => current.trim() === submission.message ? '' : current)
            if (payload.accepted !== false && drafts.current[id]?.trim() === submission.message) delete drafts.current[id]
            if (payload.error && !handoff) failures.current[id] = { message: payload.error, submission }
            else delete failures.current[id]
            if (selection.current === id) { setRetry(payload.error && !handoff ? submission : null); setError(payload.error || '') }
            if (handoff) {
                inFlight.current.delete(`${id}:message`)
                setPendingMessages(current => { const next = { ...current }; delete next[id]; return next })
            }
        } catch (error) {
            if (mounted.current) {
                const message = error instanceof Error ? error.message : 'We could not send your message. Please try again.'
                failures.current[id] = { message, submission }
                if (selection.current === id) { setError(message); setRetry(submission) }
            }
        } finally {
            if (inFlight.current.get(key) === submission.requestId) inFlight.current.delete(key)
            if (handoff) setTransfers(current => { const next = { ...current }; delete next[id]; return next })
            else setPendingMessages(current => { if (current[id]?.requestId !== submission.requestId) return current; const next = { ...current }; delete next[id]; return next })
        }
    }
    function send(event: FormEvent) {
        event.preventDefault()
        const message = input.trim()
        if (!message || conversation.status === 'closed') return
        void submit(retry?.message === message ? retry : { requestId: crypto.randomUUID(), message })
    }
    const resolved = conversation.status === 'closed'
    async function sendFeedback(rating: number, comment: string) {
        const id = selectedId, version = conversation.resolution_version
        revision.current += 1
        const response = await fetch('/api/support/chat', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'feedback', conversationId: id, resolutionVersion: version, rating, comment }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not save feedback.')
        if (mounted.current && selection.current === id) {
            revision.current += 1
            setConversation(current => current.id === id && current.resolution_version === version && current.status === 'closed'
                ? { ...current, feedback_rating: rating, feedback_comment: comment } : current)
        }
    }
    const human = conversation.channel === 'human'
    const agentName = conversation.agent_name || conversation.messages.filter(message => message.sender_kind === 'support').at(-1)?.sender_name
    const busy = sending || conversation.pending
    const lastMessage = conversation.messages.at(-1)
    const unanswered = !human && !busy && lastMessage?.sender_kind === 'user' && lastMessage.request_id
        ? { requestId: lastMessage.request_id, message: lastMessage.body } : null
    const visibleMessages = outgoing && !conversation.messages.some(message => message.request_id === outgoing.requestId)
        ? [...conversation.messages, { id: outgoing.requestId, body: outgoing.message, sender_kind: 'user' as const, sender_name: 'You' }]
        : conversation.messages
    return (
        <section aria-label='Support chat' className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]'>
            {!legacy ? <div className='flex min-w-0 items-center gap-2 border-b border-ui-border px-4 py-2'>
                <select aria-label='Conversation' value={selectedId} onChange={event => void selectChat(event.target.value)} className='min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-panel px-2 py-1.5 text-xs text-ui-text'>
                    {!tickets.some(ticket => ticket.id === selectedId) ? <option value={selectedId}>New chat</option> : null}
                    {tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{ticket.subject}{unread[ticket.id] ? ` (${unread[ticket.id]} unread)` : ''}</option>)}
                </select>
                {Object.values(unread).some(count => count > 0) ? <span role='status' aria-label='Unread replies in other chats' className='rounded-full bg-ui-primary px-2 py-0.5 text-xs text-ui-canvas'>{Object.values(unread).reduce((sum, count) => sum + count, 0)}</span> : null}
                <button type='button' onClick={() => void selectChat(crypto.randomUUID())} className='shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-ui-primary hover:bg-ui-raised disabled:opacity-50'>New chat</button>
            </div> : <div />}
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
                {busy && !human && !resolved ? <p role='status' className='mt-4 flex items-center gap-2 text-xs text-ui-muted'><LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />Hanasand AI is thinking…</p> : null}
            </div>
            <div className='min-w-0 border-t border-ui-border bg-ui-panel px-4 pb-3 pt-3'>
                {error ? <div role='alert' className='mb-3 text-xs leading-5 text-ui-danger'>{error}{retry ? <button type='button' disabled={sending || transferring} className='ml-2 font-semibold underline disabled:opacity-50' onClick={() => void submit(retry)}>Retry</button> : null}</div> : null}
                {!error && (refreshError || connection === 'reconnecting') ? <p role='status' className='mb-2 text-xs text-ui-muted'>{refreshError || 'Reconnecting…'}</p> : null}
                {!error && unanswered ? <button type='button' onClick={() => void submit(unanswered)} className='mb-2 text-xs font-medium text-ui-primary hover:underline'>Retry AI answer</button> : null}
                {resolved ? <SupportFeedback key={`${selectedId}:${conversation.resolution_version}`} feedback={conversation} submit={sendFeedback} /> : <><form onSubmit={send} className='flex min-w-0 items-end gap-2 rounded-2xl border border-ui-border bg-ui-canvas p-2 focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/10'>
                    <textarea aria-label='Message' rows={2} maxLength={4000} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!loading && !busy) send(event) } }} placeholder={human ? 'Message the support team…' : 'Ask a question…'} className='min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-ui-text outline-none placeholder:text-ui-muted' />
                    <button type='submit' disabled={loading || busy || !input.trim()} aria-label='Send message' className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ui-primary text-ui-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-40'>{sending ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <ArrowUp className='h-4 w-4' />}</button>
                </form>
                <div className='mt-3 flex min-h-7 items-center justify-center'>
                    {human ? <p className='flex items-center gap-1.5 text-xs text-ui-muted'><UserRound className='h-3.5 w-3.5' />{agentName ? `Speaking with ${agentName}` : 'Waiting for support.'}</p> : <button type='button' disabled={loading || transferring} onClick={() => void submit({ requestId: crypto.randomUUID(), message: 'I\'d like to speak with a human.', handoff: true })} className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'><UserRound className='h-3.5 w-3.5' />{transferring ? 'Connecting…' : 'Talk to a human'}</button>}
                </div></>}
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
