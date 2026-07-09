'use client'

import { usePathname } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { MessageCircle, RotateCcw, Send, X } from 'lucide-react'

type Message = {
    role: 'user' | 'assistant'
    text: string
}

const supportPaths = new Set([
    '/support',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
    '/cookies',
    '/cookie-settings',
    '/account-pending-deletion',
    '/reset-password',
])

export default function SupportAssistant({ force = false }: { force?: boolean }) {
    const pathname = usePathname()
    const visible = force || supportPaths.has(pathname || '')
    const [open, setOpen] = useState(false)
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const placeholder = messages.length ? 'Ask a support question...' : 'What can I get help with here?'
    const greeting = useMemo(() => pageGreeting(pathname || ''), [pathname])

    if (!visible) return null

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const text = input.trim()
        if (!text || busy) return
        setInput('')
        setMessages(current => [...current, { role: 'user', text }])
        setBusy(true)
        try {
            const response = await fetch('/api/support-assistant', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message: text, page: pathname }),
            })
            const payload = await response.json().catch(() => ({})) as { message?: string }
            setMessages(current => [...current, { role: 'assistant', text: payload.message || 'I can help route this. Use the contact form if you want a human reply.' }])
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='fixed bottom-5 right-5 z-[1100]'>
            {open ? (
                <section className='grid h-[min(42rem,calc(100vh-2.5rem))] w-[min(25rem,calc(100vw-2rem))] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-[0_24px_80px_rgba(0,0,0,0.18)]'>
                    <header className='flex items-center justify-between gap-3 px-4 py-3'>
                        <button type='button' onClick={() => setMessages([])} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Start over'>
                            <RotateCcw className='h-5 w-5' />
                        </button>
                        <button type='button' onClick={() => setOpen(false)} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text' aria-label='Close support assistant'>
                            <X className='h-5 w-5' />
                        </button>
                    </header>

                    <div className='overflow-auto px-4 py-3'>
                        {!messages.length ? (
                            <div className='grid h-full place-items-center text-center'>
                                <div className='grid gap-3'>
                                    <h2 className='text-2xl font-semibold text-ui-text'>Hanasand Support</h2>
                                    <p className='mx-auto max-w-72 text-sm leading-6 text-ui-muted'>{greeting}</p>
                                </div>
                            </div>
                        ) : (
                            <div className='grid gap-4'>
                                {messages.map((message, index) => (
                                    <div key={index} className={message.role === 'user' ? 'justify-self-end rounded-full bg-ui-raised px-4 py-2 text-sm text-ui-text' : 'max-w-[92%] text-sm leading-6 text-ui-text'}>
                                        {message.text}
                                    </div>
                                ))}
                                {busy ? <p className='text-sm font-medium text-ui-muted'>Thinking...</p> : null}
                            </div>
                        )}
                    </div>

                    <div className='border-t border-ui-border px-4 pb-4 pt-3'>
                        <form onSubmit={submit} className='flex min-h-13 items-center gap-2 rounded-full border border-ui-border bg-ui-canvas px-4 shadow-sm'>
                            <span className='text-2xl text-ui-muted'>+</span>
                            <input
                                value={input}
                                onChange={event => setInput(event.target.value)}
                                placeholder={placeholder}
                                className='min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted'
                            />
                            <button type='submit' disabled={!input.trim() || busy} className='grid h-10 w-10 place-items-center rounded-full bg-ui-text text-ui-canvas transition hover:opacity-90 disabled:opacity-35' aria-label='Send support question'>
                                <Send className='h-4 w-4' />
                            </button>
                        </form>
                        <p className='mt-3 text-center text-xs leading-5 text-ui-muted'>AI support can make mistakes. For account-specific help, use the contact form.</p>
                    </div>
                </section>
            ) : (
                <button
                    type='button'
                    onClick={() => setOpen(true)}
                    className='grid h-16 w-16 place-items-center rounded-full bg-ui-text text-ui-canvas shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition hover:scale-105'
                    aria-label='Open support assistant'
                >
                    <MessageCircle className='h-7 w-7' />
                </button>
            )}
        </div>
    )
}

function pageGreeting(pathname: string) {
    if (pathname === '/contact' || pathname === '/support') return 'Ask about accounts, billing, API access, webhooks, or getting a reply from support.'
    if (pathname === '/faq') return 'Ask a quick question about the FAQ or where to find the right Hanasand page.'
    return 'Ask for help finding the right page or understanding this support information.'
}
