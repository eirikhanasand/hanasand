'use client'

import Link from 'next/link'
import SupportFeedback, { SupportStars, type Feedback } from './supportFeedback'
import useSupportLive, { SUPPORT_CHAT_OPENED_EVENT } from './useSupportLive'
import useSupportUnread from './useSupportUnread'
import { SUPPORT_TICKETS_UPDATED_EVENT } from '@/utils/supportUnread'
import { PublicSupportPanel } from './publicSupportChat'
import { BellDot, ListFilter, Loader2, MessageCircle, Search, Send } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'

type Ticket = Feedback & { id: string; subject: string; status: string; user_name?: string; last_message?: string; created_at?: string; updated_at: string; agent_name?: string; channel?: string; reply_count?: number }
type Message = { id: string; sender_id: string | null; sender_kind?: string; sender_name: string; body: string; created_at: string }

const fieldClass = 'min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'

function localDateKey(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type InitialChat = { tickets: Ticket[]; isSupport: boolean; selectedId: string; messages: Message[]; realtime: boolean }

export default function SupportChat({ embedded = false, initialChat }: { embedded?: boolean; initialChat?: InitialChat }) {
    const [tickets, setTickets] = useState<Ticket[]>(initialChat?.tickets || [])
    const [selectedId, setSelectedId] = useState(initialChat?.selectedId || '')
    const selectedRef = useRef('')
    const messageRevision = useRef(0)
    const ticketRevision = useRef(0)
    const realtime = useRef(initialChat?.realtime || false)
    selectedRef.current = selectedId
    const creating = useRef(false)
    const drafts = useRef<Record<string, string>>({})
    const log = useRef<HTMLDivElement>(null)
    const [messages, setMessages] = useState<Message[]>(initialChat?.messages || [])
    const [readSelectedId, setReadSelectedId] = useState('')
    const [input, setInput] = useState('')
    const [subject, setSubject] = useState('')
    const [isSupport, setIsSupport] = useState(initialChat?.isSupport === true)
    const isSupportRef = useRef(initialChat?.isSupport === true)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(!initialChat)
    const [syncedId, setSyncedId] = useState('')
    const [signedOut, setSignedOut] = useState(false)
    const [sending, setSending] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [statusChange, setStatusChange] = useState<{ id: string; status: 'open' | 'closed' } | null>(null)
    const statusPending = useRef(false)
    const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null)
    const [userId, setUserId] = useState('')
    const [discordLinkCode, setDiscordLinkCode] = useState('')
    const [discordLinkExpiry, setDiscordLinkExpiry] = useState('')
    const [discordLinkBusy, setDiscordLinkBusy] = useState(false)
    const [discordLinkError, setDiscordLinkError] = useState('')
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [filterText, setFilterText] = useState('')
    const [starFilter, setStarFilter] = useState('all')
    const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'comment' | 'none'>('all')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const filterControlsRef = useRef({ search: '', stars: 'all', feedback: 'all', from: '', to: '' })
    filterControlsRef.current = { search: filterText, stars: starFilter, feedback: feedbackFilter, from: dateFrom, to: dateTo }
    const filterControlsInitialized = useRef(false)

    const loadTickets = useCallback(async (searchText?: string) => {
        const version = ++ticketRevision.current
        const controls = filterControlsRef.current
        const params = new URLSearchParams()
        const query = (searchText ?? controls.search).trim()
        if (query) params.set('search', query)
        if (controls.from) params.set('from', controls.from)
        if (controls.to) params.set('to', controls.to)
        if (controls.stars !== 'all') params.set('stars', controls.stars)
        if (controls.feedback !== 'all') params.set('feedback', controls.feedback)
        const suffix = params.size ? `?${params.toString()}` : ''
        const path = `/api/backend/support/tickets${suffix}`
        const response = await fetch(path, { cache: 'no-store' })
        setSignedOut(response.status === 401)
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to chat with support.' : 'Support is temporarily unavailable.')
        const payload = await response.json() as { tickets?: Ticket[]; isSupport?: boolean; realtime?: boolean }
        if (version !== ticketRevision.current) return
        realtime.current = payload.realtime === true
        const updatedTickets = payload.tickets || []
        const supportQueue = payload.isSupport === true
        isSupportRef.current = supportQueue
        setTickets(updatedTickets)
        window.dispatchEvent(new CustomEvent(SUPPORT_TICKETS_UPDATED_EVENT, {
            detail: {
                scope: `user:${getCookie('impersonating_id') || getCookie('id') || ''}`,
                tickets: updatedTickets,
            },
        }))
        if (!supportQueue && updatedTickets.some(ticket => ticket.status === 'open')) window.dispatchEvent(new Event(SUPPORT_CHAT_OPENED_EVENT))
        setIsSupport(supportQueue)
        setSelectedId(current => creating.current ? current : current || payload.tickets?.[0]?.id || '')
        return payload.tickets || []
    }, [])

    const loadMessages = useCallback(async (id: string, signal?: AbortSignal) => {
        if (!id) return
        const version = ++messageRevision.current
        const response = await fetch(`/api/backend/support/tickets/${encodeURIComponent(id)}/messages`, { cache: 'no-store', signal })
        if (!response.ok) throw new Error('We could not load this conversation.')
        const payload = await response.json() as { messages?: Message[] }
        if (!signal?.aborted && selectedRef.current === id && version === messageRevision.current) {
            // Messages are immutable; retain a committed status message if an earlier read finishes later.
            setMessages(current => Array.from(new Map([...current, ...(payload.messages || [])].map(message => [message.id, message])).values()).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)))
        }
    }, [])

    useEffect(() => {
        setUserId(getCookie('impersonating_id') || getCookie('id') || '')
    }, [])
    useEffect(() => {
        if (!isSupport) return
        if (!filterControlsInitialized.current) { filterControlsInitialized.current = true; return }
        const timer = window.setTimeout(() => {
            void loadTickets().catch(error => setError(error instanceof Error ? error.message : 'Could not filter support chats.'))
        }, 250)
        return () => window.clearTimeout(timer)
    }, [dateFrom, dateTo, feedbackFilter, filterText, isSupport, loadTickets, starFilter])
    useEffect(() => {
        const controller = new AbortController()
        if (initialChat?.selectedId !== selectedId) setMessages([])
        setSyncedId('')
        const refresh = () => { void loadMessages(selectedId, controller.signal).then(() => { if (!controller.signal.aborted) { setError(''); setSyncedId(selectedId) } }).catch(error => { if (!controller.signal.aborted) setError(error.message) }) }
        refresh()
        return () => { controller.abort() }
    }, [initialChat?.selectedId, loadMessages, selectedId])

    const connection = useSupportLive(async () => {
        const id = selectedRef.current
        setSyncedId('')
        try {
            const [updatedTickets] = await Promise.all([loadTickets(), loadMessages(id)])
            setError(''); setSyncedId(id)
            return realtime.current && (isSupportRef.current || Boolean(updatedTickets?.some(ticket => ticket.status === 'open')))
        }
        catch (error) { setError(error instanceof Error ? error.message : 'Reconnecting…') }
        finally { setLoading(false) }
    }, false, !signedOut)
    const unread = useSupportUnread(tickets, selectedId, readSelectedId === selectedId && syncedId === selectedId && !error, `user:${userId}`)
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages])
    function selectChat(id: string) {
        drafts.current[selectedId] = input
        creating.current = !id
        setReadSelectedId(id)
        selectedRef.current = id; setSelectedId(id)
        setInput(drafts.current[id] || ''); setMessages([]); setError('')
    }

    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const body = input.trim()
        if (!body || sending || statusPending.current) return
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

    async function updateStatus(status: 'open' | 'closed') {
        if (statusPending.current) return
        statusPending.current = true
        const id = selectedId
        ++ticketRevision.current
        setStatusChange({ id, status }); setUpdatingStatus(true); setStatusError(null); setError('')
        try {
            const response = await fetch(`/api/backend/support/tickets/${encodeURIComponent(id)}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
            const payload = await response.json() as { error?: string; ticket?: Partial<Ticket> & { id: string }; message?: Message }
            if (!response.ok) throw new Error(payload.error || 'Could not update this chat.')
            if (payload.ticket?.id === id) {
                // The committed response replaces two round trips. Ignore reads begun before this acknowledgement.
                ++ticketRevision.current
                setTickets(current => current.map(ticket => ticket.id === id ? { ...ticket, ...payload.ticket, ...(payload.message ? { last_message: payload.message.body } : {}) } : ticket))
                const message = payload.message
                if (selectedRef.current === id && message) {
                    setMessages(current => current.some(existing => existing.id === message.id) ? current : [...current, message])
                }
            } else await Promise.all([loadTickets(), loadMessages(id)]) // Older API during a rolling release.
        } catch (error) {
            setStatusError({ id, message: error instanceof Error ? error.message : 'Could not update this chat.' })
            // A lost response may still have committed; reconcile before removing the pending display.
            const refreshed = await loadTickets().catch(() => undefined)
            if (refreshed?.some(ticket => ticket.id === id && ticket.status === status)) setStatusError(null)
        } finally { statusPending.current = false; setStatusChange(null); setUpdatingStatus(false) }
    }
    async function sendFeedback(rating: number, comment: string) {
        const id = selectedId, version = tickets.find(ticket => ticket.id === id)?.resolution_version
        ticketRevision.current += 1
        const response = await fetch(`/api/backend/support/tickets/${encodeURIComponent(id)}/feedback`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating, comment, resolutionVersion: version }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not save feedback.')
        ticketRevision.current += 1
        setTickets(current => current.map(ticket => ticket.id === id && ticket.resolution_version === version && ticket.status === 'closed'
            ? { ...ticket, feedback_rating: rating, feedback_comment: comment } : ticket))
    }

    async function createDiscordLinkCode() {
        if (discordLinkBusy) return
        setDiscordLinkBusy(true)
        setDiscordLinkError('')
        setDiscordLinkCode('')
        try {
            const response = await fetch('/api/backend/support/discord/link-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
            const payload = await response.json() as { code?: string; expiresAt?: string; error?: string }
            if (!response.ok || !payload.code) throw new Error(payload.error || 'Could not create a Discord link code.')
            setDiscordLinkCode(payload.code)
            setDiscordLinkExpiry(payload.expiresAt || '')
        } catch (error) {
            setDiscordLinkError(error instanceof Error ? error.message : 'Could not create a Discord link code.')
        } finally {
            setDiscordLinkBusy(false)
        }
    }

    if (signedOut) return <PublicSupportPanel />
    if (embedded && loading) return <section aria-label='Support chat' aria-busy='true' className='grid min-h-0 min-w-0 place-items-center'><Loader2 className='site-loading-icon' aria-hidden='true' /></section>

    const displayedTickets = tickets.map(ticket => ticket.id === statusChange?.id ? { ...ticket, status: statusChange.status, ...(statusChange.status === 'closed' ? { feedback_rating: null, feedback_comment: null } : {}) } : ticket)
    const query = filterText.trim().toLocaleLowerCase()
    const visibleTickets = displayedTickets.filter(ticket => {
        if (starFilter === 'rated' && !ticket.feedback_rating) return false
        if (starFilter === 'unrated' && ticket.feedback_rating) return false
        if (/^[1-5]$/.test(starFilter) && ticket.feedback_rating !== Number(starFilter)) return false
        const hasComment = Boolean(ticket.feedback_comment?.trim())
        if (feedbackFilter === 'comment' && !hasComment) return false
        if (feedbackFilter === 'none' && hasComment) return false
        if (dateFrom || dateTo) {
            const date = localDateKey(ticket.created_at || ticket.updated_at)
            if (!date || dateFrom && date < dateFrom || dateTo && date > dateTo) return false
        }
        return true
    })
    const hasFilters = Boolean(query || starFilter !== 'all' || feedbackFilter !== 'all' || dateFrom || dateTo)
    const orderedVisibleTickets = [...visibleTickets].sort((left, right) => Number(Boolean(unread[right.id])) - Number(Boolean(unread[left.id])))
    const selected = displayedTickets.find(ticket => ticket.id === selectedId)
    const shell = embedded
        ? 'grid h-[calc(100dvh-6.5rem)] min-h-[30rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1'
        : 'grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ui-panel'
    const headingClass = 'flex min-h-20 flex-col justify-center gap-1 border-b border-ui-border px-4 py-3'
    return (
        <section className={shell} aria-label='Support chat'>
            {embedded ? (
                <aside className='flex min-h-0 min-w-0 flex-col border-b border-ui-border bg-ui-raised lg:border-b-0 lg:border-r'>
                    <div className={headingClass}>
                        <div className='flex w-full items-center justify-between gap-2'>
                            <h1 className='text-sm font-semibold text-ui-text'>{isSupport ? 'Support' : 'Your support chats'}</h1>
                            {isSupport ? <div className='relative'>
                                <button type='button' aria-label='Filter support chats' aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)} className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ui-border transition hover:bg-ui-panel focus-visible:outline-2 focus-visible:outline-ui-primary ${filtersOpen || hasFilters ? 'text-ui-primary' : 'text-ui-muted'}`}>
                                    <ListFilter aria-hidden='true' className='h-4 w-4' />
                                    {hasFilters ? <span className='absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ui-primary' /> : null}
                                </button>
                                {filtersOpen ? <div role='dialog' aria-label='Filter support chats' className='absolute right-0 top-full z-30 mt-2 grid w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-xl'>
                                    <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Search text
                                        <span className='relative'><Search aria-hidden='true' className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' /><input aria-label='Search support tickets' type='search' value={filterText} onChange={event => setFilterText(event.target.value)} placeholder='Search conversations…' className={`${fieldClass} w-full pl-9`} /></span>
                                    </label>
                                    <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Stars
                                        <select aria-label='Filter by stars' value={starFilter} onChange={event => setStarFilter(event.target.value)} className={fieldClass}>
                                            <option value='all'>Any rating</option><option value='rated'>Has a star rating</option><option value='unrated'>No star rating</option>
                                            {[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} stars</option>)}
                                        </select>
                                    </label>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>From<input aria-label='Filter from date' type='date' value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} className={fieldClass} /></label>
                                        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>To<input aria-label='Filter to date' type='date' value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} className={fieldClass} /></label>
                                    </div>
                                    <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Written feedback
                                        <select aria-label='Filter by written feedback' value={feedbackFilter} onChange={event => setFeedbackFilter(event.target.value as typeof feedbackFilter)} className={fieldClass}>
                                            <option value='all'>Any</option><option value='comment'>Has a comment</option><option value='none'>No comment</option>
                                        </select>
                                    </label>
                                    <div className='flex items-center justify-between gap-3 border-t border-ui-border pt-3'>
                                        <p role='status' className='text-xs text-ui-muted'>{visibleTickets.length} of {tickets.length} chats</p>
                                        <button type='button' disabled={!hasFilters} onClick={() => { setFilterText(''); setStarFilter('all'); setFeedbackFilter('all'); setDateFrom(''); setDateTo('') }} className='rounded-md px-2 py-1 text-xs font-medium text-ui-primary hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-50'>Clear filters</button>
                                    </div>
                                </div> : null}
                            </div> : null}
                        </div>
                        {!isSupport ? <p className='text-xs text-ui-muted'>Conversations with the support team.</p> : null}
                    </div>
                    <div className='grid gap-2 border-b border-ui-border px-4 py-3'>
                        <button type='button' disabled={discordLinkBusy} onClick={() => void createDiscordLinkCode()} className='w-fit rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>{discordLinkBusy ? 'Creating code…' : 'Connect Discord'}</button>
                        {discordLinkCode ? <p role='status' className='text-xs leading-5 text-ui-muted'>In Discord, run <span className='font-medium text-ui-text'>/tickets</span>, choose <span className='font-medium text-ui-text'>Link account</span>, then enter <code className='select-all rounded bg-ui-panel px-1.5 py-0.5 font-mono text-ui-text'>{discordLinkCode}</code>. Code expires {new Date(discordLinkExpiry).toLocaleTimeString()}.</p> : null}
                        {discordLinkError ? <p role='alert' className='text-xs text-ui-text'>{discordLinkError}</p> : null}
                    </div>
                    {!isSupport ? <button type='button' onClick={() => selectChat('')} className='mx-4 mb-2 rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-primary hover:bg-ui-panel'>New chat</button> : null}
                    <div className='max-h-36 overflow-y-auto p-2 lg:max-h-none lg:flex-1'>
                        {orderedVisibleTickets.map(ticket => (
                            <button key={ticket.id} type='button' aria-pressed={selectedId === ticket.id} onClick={() => selectChat(ticket.id)} className={`grid w-full min-w-0 gap-1 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ui-primary ${selectedId === ticket.id ? 'bg-ui-primary/10' : 'hover:bg-ui-panel'}`}>
                                <span className='flex min-w-0 items-center gap-2'>{unread[ticket.id] ? <BellDot role='img' aria-label='Unread messages' className='h-4 w-4 shrink-0 text-ui-primary' /> : null}<span className='truncate text-sm font-semibold text-ui-text'>{isSupport && ticket.user_name !== 'Visitor' ? ticket.user_name || ticket.subject : ticket.subject}</span></span>
                                {ticket.status === 'closed' || ticket.feedback_rating ? <span className='flex flex-wrap items-center gap-2'>{ticket.status === 'closed' ? <span className='rounded-md border border-ui-success/30 bg-ui-success/10 px-2 py-0.5 text-[11px] font-medium text-ui-success'>Resolved</span> : null}{ticket.feedback_rating ? <SupportStars rating={ticket.feedback_rating} /> : null}</span> : null}
                                {unread[ticket.id] ? <span role='status' aria-label={`${unread[ticket.id]} unread replies`} className='w-fit rounded-full bg-ui-primary px-2 py-0.5 text-[11px] text-ui-on-primary'>{unread[ticket.id]}</span> : null}
                                <span className='truncate text-xs text-ui-muted'>{ticket.last_message || 'No messages yet'}</span>
                            </button>
                        ))}
                        {!visibleTickets.length && !loading ? <p className='p-2 text-xs text-ui-muted'>{tickets.length && hasFilters ? 'No chats match these filters.' : 'No support chats yet.'}</p> : null}
                    </div>
                </aside>
            ) : (
                <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                    {tickets.length ? <label className='grid gap-1.5 text-xs text-ui-muted'>Conversation<select aria-label='Conversation' value={selectedId} onChange={event => selectChat(event.target.value)} className={fieldClass}>{tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{isSupport && ticket.user_name ? `${ticket.user_name} — ` : ''}{ticket.subject}</option>)}</select></label> : <p className='text-xs text-ui-muted'>Account, billing, or product questions? Talk to our support team.</p>}
                </div>
            )}
            <div className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]'>
                <header className='flex min-h-20 items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                    <div className='grid min-w-0 gap-1'>
                        <h2 className='truncate text-sm font-semibold text-ui-text'>{selected?.subject || (isSupport ? 'Customer conversation' : 'Start a support chat')}</h2>
                        <p className='text-xs text-ui-muted'>{selected ? selected.status === 'closed' ? 'Chat resolved' : selected.agent_name ? `Speaking with ${selected.agent_name}` : 'Waiting for support.' : isSupport ? 'Choose a conversation from the queue.' : 'Tell us what you need help with.'}</p>
                    </div>
                    {isSupport && selected ? <div className='flex shrink-0 items-center gap-2'>{statusChange?.id === selectedId ? <span role='status' className='text-xs text-ui-muted'>Saving…</span> : null}<button type='button' disabled={updatingStatus || sending} onClick={() => void updateStatus(selected.status === 'closed' ? 'open' : 'closed')} className='shrink-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-medium text-ui-text hover:bg-ui-raised disabled:opacity-50'>{selected.status === 'closed' ? 'Reopen chat' : 'Resolve'}</button></div> : null}
                </header>
                <div ref={log} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto p-4'>
                    {isSupport && selected?.feedback_rating ? <section aria-label='Customer feedback' className='mb-4 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'><h3 className='text-xs font-semibold text-ui-text'>Customer feedback</h3><SupportStars rating={selected.feedback_rating} />{selected.feedback_comment ? <p className='whitespace-pre-wrap text-sm text-ui-text [overflow-wrap:anywhere]'>{selected.feedback_comment}</p> : null}</section> : null}
                    {messages.length ? <div className='grid gap-3'>{messages.map(message => message.sender_kind === 'system' ? <p key={message.id} className='px-3 py-1 text-center text-xs leading-5 text-ui-muted'>{message.body}</p> : <div key={message.id} className={`min-w-0 max-w-[90%] rounded-lg px-3 py-2 text-sm text-ui-text ${message.sender_id === userId ? 'justify-self-end bg-ui-primary/10' : 'justify-self-start bg-ui-raised'}`}><p className='text-xs font-semibold text-ui-muted'>{message.sender_name}</p><p className='mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]'>{message.body}</p></div>)}</div> : <div className='grid h-full content-center justify-items-center gap-3 text-center text-sm text-ui-muted'><MessageCircle aria-hidden='true' className='h-8 w-8 text-ui-muted' /><p>{isSupport ? 'Select a customer chat to read and reply.' : 'Your conversation starts here.'}</p></div>}
                </div>
                <div className='border-t border-ui-border p-4'>
                    {!error && connection === 'reconnecting' ? <p role='status' className='mb-2 text-xs text-ui-muted'>Reconnecting…</p> : null}
                    {error ? <p role='alert' className='mb-3 text-sm text-ui-text'>{error}</p> : null}
                    {statusError?.id === selectedId ? <p role='alert' className='mb-3 text-sm text-ui-text'>{statusError.message}</p> : null}
                    {selected?.status === 'closed' ? isSupport ? <p className='text-xs text-ui-muted'>Chat resolved. Reopen it to continue the conversation.</p> : <SupportFeedback key={`${selectedId}:${selected.resolution_version}`} feedback={selected} submit={sendFeedback} /> : !isSupport || selectedId ? (
                        <form onSubmit={send} className='grid min-w-0 gap-3'>
                            {!selectedId ? <input aria-label='Subject' maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder='Subject' className={`h-10 ${fieldClass}`} /> : null}
                            <div className='flex min-w-0 items-end gap-2'>
                                <textarea aria-label='Message' rows={2} maxLength={10000} disabled={sending || loading || updatingStatus} value={input} onChange={event => setInput(event.target.value)} placeholder='Write a message…' className={`max-h-32 min-h-20 flex-1 resize-y disabled:opacity-60 ${fieldClass}`} />
                                <button type='submit' disabled={sending || loading || updatingStatus || !input.trim()} className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:cursor-not-allowed disabled:opacity-50'><Send aria-hidden='true' className='h-4 w-4' />{sending ? 'Sending…' : 'Send'}</button>
                            </div>
                        </form>
                    ) : <p className='text-xs text-ui-muted'>Select a conversation to reply.</p>}
                    {!embedded ? <Link href='/support' className='mt-3 block text-center text-xs text-ui-primary hover:underline'>Open full support page</Link> : null}
                </div>
            </div>
        </section>
    )
}
