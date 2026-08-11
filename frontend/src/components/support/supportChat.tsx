'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'

type Ticket = { id: string; subject: string; status: string; user_name?: string; last_message?: string; updated_at: string }
type Message = { id: string; sender_id: string; sender_name: string; body: string; created_at: string }

export default function SupportChat({ embedded = false }: { embedded?: boolean }) {
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [subject, setSubject] = useState('Browser run help')
    const [role, setRole] = useState<'user' | 'support'>('user')
    const [error, setError] = useState('')

    const loadTickets = useCallback(async () => {
        const response = await fetch('/api/backend/support/tickets', { cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to chat with support.' : 'Support is temporarily unavailable.')
        const payload = await response.json() as { tickets?: Ticket[]; role?: 'user' | 'support' }
        setTickets(payload.tickets || [])
        setRole(payload.role || 'user')
        setSelectedId(current => current || payload.tickets?.[0]?.id || '')
    }, [])

    const loadMessages = useCallback(async (id: string) => {
        if (!id) return
        const response = await fetch(`/api/backend/support/tickets/${encodeURIComponent(id)}/messages`, { cache: 'no-store' })
        if (response.ok) setMessages((await response.json() as { messages?: Message[] }).messages || [])
    }, [])

    useEffect(() => { void loadTickets().catch(error => setError(error.message)) }, [loadTickets])
    useEffect(() => { void loadMessages(selectedId) }, [loadMessages, selectedId])
    useEffect(() => {
        const timer = window.setInterval(() => { void loadTickets().catch(() => undefined); void loadMessages(selectedId) }, 4_000)
        return () => window.clearInterval(timer)
    }, [loadMessages, loadTickets, selectedId])

    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const body = input.trim()
        if (!body) return
        setInput('')
        const response = selectedId
            ? await fetch(`/api/backend/support/tickets/${encodeURIComponent(selectedId)}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: body }) })
            : await fetch('/api/backend/support/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, message: body }) })
        if (!response.ok) { setError('We could not send that message.'); return }
        const payload = await response.json() as { id?: string }
        if (payload.id) setSelectedId(payload.id)
        await loadTickets()
        if (payload.id) await loadMessages(payload.id)
    }

    const shell = embedded ? 'grid min-h-[32rem] overflow-hidden rounded-lg border border-ui-border bg-ui-panel lg:grid-cols-[18rem_minmax(0,1fr)]' : 'grid h-[min(42rem,calc(100vh-2.5rem))] w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-[0_24px_80px_rgba(0,0,0,0.24)]'
    return <section className={shell} aria-label='Support chat'>
        <aside className='grid min-h-0 grid-rows-[auto_1fr] border-b border-ui-border bg-ui-raised lg:border-b-0 lg:border-r'>
            <div className='border-b border-ui-border p-3'><p className='text-sm font-semibold text-ui-text'>{role === 'support' ? 'Support queue' : 'Your support chats'}</p><p className='mt-1 text-xs text-ui-muted'>{role === 'support' ? 'All open customer conversations.' : 'Ask a human for help.'}</p></div>
            <div className='overflow-auto p-2'>
                {tickets.map(ticket => <button key={ticket.id} type='button' onClick={() => setSelectedId(ticket.id)} className={`grid w-full gap-1 rounded-md p-2 text-left ${selectedId === ticket.id ? 'bg-ui-primary/10' : 'hover:bg-ui-panel'}`}><span className='truncate text-xs font-semibold text-ui-text'>{role === 'support' ? ticket.user_name || ticket.subject : ticket.subject}</span><span className='truncate text-xs text-ui-muted'>{ticket.last_message || 'No messages yet'}</span></button>)}
                {!tickets.length ? <p className='p-2 text-xs text-ui-muted'>No support chats yet.</p> : null}
            </div>
        </aside>
        <div className='grid min-h-0 grid-rows-[auto_1fr_auto]'>
            <header className='border-b border-ui-border p-3'><p className='text-sm font-semibold text-ui-text'>{selectedId ? tickets.find(ticket => ticket.id === selectedId)?.subject || 'Support chat' : 'Start a support chat'}</p>{error ? <p className='mt-1 text-xs text-ui-danger'>{error}</p> : null}</header>
            <div className='overflow-auto p-4'>
                {messages.length ? <div className='grid gap-3'>{messages.map(message => <div key={message.id} className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${message.sender_id === 'self' ? 'justify-self-end bg-ui-primary/10 text-ui-text' : 'bg-ui-raised text-ui-text'}`}><p className='text-[10px] font-semibold uppercase text-ui-muted'>{message.sender_name}</p><p className='mt-1 whitespace-pre-wrap'>{message.body}</p></div>)}</div> : <div className='grid h-full place-items-center text-center text-sm text-ui-muted'><p>{role === 'support' ? 'Select a customer chat.' : 'Describe what you need help with.'}</p></div>}
            </div>
            <form onSubmit={send} className='grid gap-2 border-t border-ui-border p-3'>{!selectedId ? <input value={subject} onChange={event => setSubject(event.target.value)} placeholder='Subject' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' /> : null}<div className='flex gap-2'><input value={input} onChange={event => setInput(event.target.value)} placeholder='Write a message...' className='min-w-0 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' /><button type='submit' className='rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas'>Send</button></div>{!embedded ? <Link href='/support' className='text-center text-xs text-ui-primary hover:underline'>Open full support page</Link> : null}</form>
        </div>
    </section>
}
