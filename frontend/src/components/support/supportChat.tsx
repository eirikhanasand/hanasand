'use client'

import Link from 'next/link'
import useSupportLive from './useSupportLive'
import useSupportUnread from './useSupportUnread'
import { PublicSupportPanel } from './publicSupportChat'
import { MessageCircle, Send } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'

type Ticket = { id: string; subject: string; status: string; user_name?: string; last_message?: string; updated_at: string; agent_name?: string; channel?: string; reply_count?: number }
type Message = { id: string; sender_id: string | null; sender_kind?: string; sender_name: string; body: string; created_at: string }

const fieldClass = 'min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'

export default function SupportChat({ embedded = false }: { embedded?: boolean }) {
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [selectedId, setSelectedId] = useState('')
    const selectedRef = useRef('')
    selectedRef.current = selectedId
    const creating = useRef(false)
    const drafts = useRef<Record<string, string>>({})
    const log = useRef<HTMLDivElement>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [subject, setSubject] = useState('')
    const [role, setRole] = useState<'user' | 'support'>('user')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [syncedId, setSyncedId] = useState('')
    const [signedOut, setSignedOut] = useState(false)
    const [sending, setSending] = useState(false)
    const [userId, setUserId] = useState('')

    const loadTickets = useCallback(async () => {
        const response = await fetch('/api/backend/support/tickets', { cache: 'no-store' })
        setSignedOut(response.status === 401)
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to chat with support.' : 'Support is temporarily unavailable.')
        const payload = await response.json() as { tickets?: Ticket[]; role?: 'user' | 'support' }
        setTickets(payload.tickets || [])
        setRole(payload.role || 'user')
        setSelectedId(current => creating.current ? current : current || payload.tickets?.[0]?.id || '')
    }, [])

    const loadMessages = useCallback(async (id: string, signal?: AbortSignal) => {
        if (!id) return
        const response = await fetch(`/api/backend/support/tickets/${encodeURIComponent(id)}/messages`, { cache: 'no-store', signal })
        if (!response.ok) throw new Error('We could not load this conversation.')
        const payload = await response.json() as { messages?: Message[] }
        if (!signal?.aborted && selectedRef.current === id) { setMessages(payload.messages || []) }
    }, [])

    useEffect(() => {
        setUserId(getCookie('impersonating_id') || getCookie('id') || '')
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        setMessages([]); setSyncedId('')
        const refresh = () => { void loadMessages(selectedId, controller.signal).then(() => { if (!controller.signal.aborted) { setError(''); setSyncedId(selectedId) } }).catch(error => { if (!controller.signal.aborted) setError(error.message) }) }
        refresh()
        return () => { controller.abort() }
    }, [loadMessages, selectedId])

    const connection = useSupportLive(async () => {
        const id = selectedRef.current
        setSyncedId('')
        try { await Promise.all([loadTickets(), loadMessages(id)]); setError(''); setSyncedId(id) }
        catch (error) { setError(error instanceof Error ? error.message : 'Reconnecting…') }
        finally { setLoading(false) }
    }, false, !signedOut)
    const unread = useSupportUnread(tickets, selectedId, syncedId === selectedId && !error, `user:${userId}`)
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages])
    function selectChat(id: string) {
        drafts.current[selectedId] = input
        creating.current = !id
        selectedRef.current = id; setSelectedId(id)
        setInput(drafts.current[id] || ''); setMessages([]); setError('')
    }

    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const body = input.trim()
        if (!body || sending) return
        setSending(true)
        setError('')
        try {
            const response = selectedId
                ? await fetch(`/api/backend/support/tickets/${encodeURIComponent(selectedId)}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: body }) })
                : await fetch('/api/backend/support/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: subject.trim() || 'Support question', message: body }) })
            if (!response.ok) throw new Error('We could not send that message. Please try again.')
            const payload = await response.json() as { id?: string }
            setInput('')
            if (payload.id) { creating.current = false; selectedRef.current = payload.id; setSelectedId(payload.id) }
            else await loadMessages(selectedId)
            await loadTickets()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'We could not send that message. Please try again.')
        } finally {
            setSending(false)
        }
    }

    if (signedOut) return <PublicSupportPanel />

    const selected = tickets.find(ticket => ticket.id === selectedId)
    const shell = embedded
        ? 'grid h-[calc(100dvh-7rem)] min-h-[30rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1'
        : 'grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ui-panel'
    const headingClass = 'flex min-h-20 flex-col justify-center gap-1 border-b border-ui-border px-4 py-3'
    return (
        <section className={shell} aria-label='Support chat'>
            {embedded ? (
                <aside className='flex min-h-0 min-w-0 flex-col border-b border-ui-border bg-ui-raised lg:border-b-0 lg:border-r'>
                    <div className={headingClass}>
                        <h1 className='text-sm font-semibold text-ui-text'>{role === 'support' ? 'Support queue' : 'Your support chats'}</h1>
                        <p className='text-xs text-ui-muted'>{role === 'support' ? 'Customer conversations.' : 'Conversations with the support team.'}</p>
                    </div>
                    {role !== 'support' ? <button type='button' onClick={() => selectChat('')} className='mx-4 mb-2 rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-primary hover:bg-ui-panel'>New chat</button> : null}
                    <div className='max-h-36 overflow-y-auto p-2 lg:max-h-none lg:flex-1'>
                        {tickets.map(ticket => (
                            <button key={ticket.id} type='button' aria-pressed={selectedId === ticket.id} onClick={() => selectChat(ticket.id)} className={`grid w-full min-w-0 gap-1 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ui-primary ${selectedId === ticket.id ? 'bg-ui-primary/10' : 'hover:bg-ui-panel'}`}>
                                <span className='truncate text-sm font-semibold text-ui-text'>{role === 'support' && ticket.user_name !== 'Visitor' ? ticket.user_name || ticket.subject : ticket.subject}</span>
                                {unread[ticket.id] ? <span role='status' aria-label={`${unread[ticket.id]} unread replies`} className='w-fit rounded-full bg-ui-primary px-2 py-0.5 text-[11px] text-ui-canvas'>{unread[ticket.id]}</span> : null}
                                <span className='truncate text-xs text-ui-muted'>{ticket.last_message || 'No messages yet'}</span>
                            </button>
                        ))}
                        {!tickets.length ? <p className='p-2 text-xs text-ui-muted'>{loading ? 'Loading conversations…' : 'No support chats yet.'}</p> : null}
                    </div>
                </aside>
            ) : (
                <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                    {tickets.length ? <label className='grid gap-1.5 text-xs text-ui-muted'>Conversation<select aria-label='Conversation' value={selectedId} onChange={event => selectChat(event.target.value)} className={fieldClass}>{tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{role === 'support' && ticket.user_name ? `${ticket.user_name} — ` : ''}{ticket.subject}</option>)}</select></label> : <p className='text-xs text-ui-muted'>Account, billing, or product questions? Talk to our support team.</p>}
                </div>
            )}
            <div className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]'>
                <header className={headingClass}>
                    <h2 className='truncate text-sm font-semibold text-ui-text'>{selected?.subject || (role === 'support' ? 'Customer conversation' : 'Start a support chat')}</h2>
                    <p className='text-xs text-ui-muted'>{selected ? selected.status === 'closed' ? 'Conversation closed' : selected.agent_name ? `Speaking with ${selected.agent_name}` : 'Waiting for support.' : role === 'support' ? 'Choose a conversation from the queue.' : 'Tell us what you need help with.'}</p>
                </header>
                <div ref={log} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto p-4'>
                    {messages.length ? <div className='grid gap-3'>{messages.map(message => message.sender_kind === 'system' ? <p key={message.id} className='px-3 py-1 text-center text-xs leading-5 text-ui-muted'>{message.body}</p> : <div key={message.id} className={`min-w-0 max-w-[90%] rounded-lg px-3 py-2 text-sm text-ui-text ${message.sender_id === userId ? 'justify-self-end bg-ui-primary/10' : 'justify-self-start bg-ui-raised'}`}><p className='text-xs font-semibold text-ui-muted'>{message.sender_name}</p><p className='mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]'>{message.body}</p></div>)}</div> : <div className='grid h-full content-center justify-items-center gap-3 text-center text-sm text-ui-muted'><MessageCircle aria-hidden='true' className='h-8 w-8 text-ui-muted' /><p>{loading ? 'Loading conversations…' : role === 'support' ? 'Select a customer chat to read and reply.' : 'Your conversation starts here.'}</p></div>}
                </div>
                <div className='border-t border-ui-border p-4'>
                    {!error && connection === 'reconnecting' ? <p role='status' className='mb-2 text-xs text-ui-muted'>Reconnecting…</p> : null}
                    {error ? <p role='alert' className='mb-3 text-sm text-ui-danger'>{error}</p> : null}
                    {role !== 'support' || selectedId ? (
                        <form onSubmit={send} className='grid min-w-0 gap-3'>
                            {!selectedId ? <input aria-label='Subject' maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder='Subject' className={`h-10 ${fieldClass}`} /> : null}
                            <div className='flex min-w-0 items-end gap-2'>
                                <textarea aria-label='Message' rows={2} maxLength={10000} disabled={sending || loading} value={input} onChange={event => setInput(event.target.value)} placeholder='Write a message…' className={`max-h-32 min-h-20 flex-1 resize-y disabled:opacity-60 ${fieldClass}`} />
                                <button type='submit' disabled={sending || loading || !input.trim()} className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:cursor-not-allowed disabled:opacity-50'><Send aria-hidden='true' className='h-4 w-4' />{sending ? 'Sending…' : 'Send'}</button>
                            </div>
                        </form>
                    ) : <p className='text-xs text-ui-muted'>Select a conversation to reply.</p>}
                    {!embedded ? <Link href='/support' className='mt-3 block text-center text-xs text-ui-primary hover:underline'>Open full support page</Link> : null}
                </div>
            </div>
        </section>
    )
}
