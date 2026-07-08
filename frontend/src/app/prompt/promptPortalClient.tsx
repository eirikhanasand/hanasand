'use client'

import { ArrowUp, ImageIcon, LockKeyhole, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type PortalFile = {
    id: string
    name: string
    type: string
    size: number
}

type PortalItem = {
    id: string
    prompt: string
    priority: 'now' | 'next'
    status: 'queued' | 'running' | 'done' | 'error'
    createdAt: string
    startedAt?: string
    completedAt?: string
    result?: string
    files: PortalFile[]
}

type PortalState = {
    authenticated: boolean
    readOnly: boolean
    idleExpiresAt?: string
    items: PortalItem[]
}

const emptyState: PortalState = {
    authenticated: false,
    readOnly: false,
    items: [],
}

export default function PromptPortalClient() {
    const [state, setState] = useState<PortalState>(emptyState)
    const [code, setCode] = useState('')
    const [prompt, setPrompt] = useState('')
    const [priority, setPriority] = useState<'now' | 'next'>('next')
    const [files, setFiles] = useState<FileList | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const pending = useMemo(() => state.items.filter(item => item.status === 'queued' || item.status === 'running'), [state.items])
    const completed = useMemo(() => state.items.filter(item => item.status === 'done' || item.status === 'error'), [state.items])

    useEffect(() => {
        void refresh()
        const interval = window.setInterval(refresh, 4000)
        return () => window.clearInterval(interval)
    }, [])

    async function refresh() {
        const response = await fetch('/api/prompt', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (payload?.items) setState(payload)
    }

    async function login(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'login', code }),
        })
        const payload = await response.json().catch(() => null)
        setBusy(false)
        if (!response.ok) return setError(payload?.error || 'Login failed.')
        setCode('')
        setState(payload)
    }

    async function enqueue(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        const form = new FormData()
        form.set('prompt', prompt)
        form.set('priority', priority)
        Array.from(files || []).forEach(file => form.append('files', file))
        const response = await fetch('/api/prompt', { method: 'POST', body: form })
        const payload = await response.json().catch(() => null)
        setBusy(false)
        if (!response.ok) return setError(payload?.error || 'Unable to queue prompt.')
        setPrompt('')
        setFiles(null)
        const input = document.getElementById('prompt-files') as HTMLInputElement | null
        if (input) input.value = ''
        setState(payload)
    }

    return (
        <main className='min-h-screen bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <div className='mx-auto grid max-w-6xl gap-4'>
                <header className='flex flex-col gap-3 border-b border-ui-border pb-4 md:flex-row md:items-end md:justify-between'>
                    <div>
                        <p className='text-xs font-semibold uppercase tracking-[0.16em] text-ui-primary'>Prompt portal</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-normal'>Remote prompt queue</h1>
                    </div>
                    <div className={`inline-flex h-9 items-center gap-2 self-start rounded-lg border px-3 text-sm font-semibold ${state.readOnly ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : state.authenticated ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-border bg-ui-panel text-ui-muted'}`}>
                        {state.authenticated ? <ShieldCheck className='h-4 w-4' /> : <LockKeyhole className='h-4 w-4' />}
                        {state.readOnly ? 'Read only' : state.authenticated ? 'Active' : 'Locked'}
                    </div>
                </header>

                {error ? <p className='rounded-lg border border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-sm font-semibold text-ui-danger'>{error}</p> : null}

                {!state.authenticated ? (
                    <form onSubmit={login} className='grid max-w-sm gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'>
                        <label className='grid gap-2 text-sm font-semibold'>
                            Access code
                            <input
                                value={code}
                                onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode='numeric'
                                autoComplete='one-time-code'
                                className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 text-lg font-semibold tracking-[0.24em] outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/25'
                                placeholder='000000'
                            />
                        </label>
                        <button disabled={busy || code.length !== 6} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas disabled:cursor-not-allowed disabled:opacity-60'>
                            <LockKeyhole className='h-4 w-4' />
                            Unlock
                        </button>
                    </form>
                ) : (
                    <section className='grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
                        <form onSubmit={enqueue} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'>
                            <div className='flex items-center justify-between gap-2'>
                                <h2 className='text-sm font-semibold'>New instruction</h2>
                                <button type='button' onClick={refresh} className='inline-flex h-8 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-xs font-semibold text-ui-muted hover:text-ui-text'>
                                    <RefreshCw className='h-3.5 w-3.5' />
                                    Refresh
                                </button>
                            </div>
                            {state.readOnly ? (
                                <p className='rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm text-ui-warning'>Session is read only. Ask for a new code to send more instructions.</p>
                            ) : null}
                            <textarea
                                value={prompt}
                                onChange={event => setPrompt(event.target.value)}
                                disabled={state.readOnly}
                                rows={9}
                                className='min-h-44 resize-y rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm leading-6 outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/25 disabled:cursor-not-allowed disabled:opacity-70'
                                placeholder='Write the next instruction.'
                            />
                            <div className='flex flex-wrap items-center gap-2'>
                                <button type='button' onClick={() => setPriority('next')} disabled={state.readOnly} className={priority === 'next' ? selectedButton : plainButton}>Next</button>
                                <button type='button' onClick={() => setPriority('now')} disabled={state.readOnly} className={priority === 'now' ? selectedButton : plainButton}>
                                    <ArrowUp className='h-3.5 w-3.5' />
                                    Now
                                </button>
                                <label className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted hover:text-ui-text'>
                                    <ImageIcon className='h-4 w-4' />
                                    Images
                                    <input id='prompt-files' disabled={state.readOnly} type='file' accept='image/*' multiple onChange={event => setFiles(event.target.files)} className='sr-only' />
                                </label>
                                {files?.length ? <span className='text-xs font-semibold text-ui-muted'>{files.length} selected</span> : null}
                            </div>
                            <button disabled={busy || state.readOnly || !prompt.trim()} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas disabled:cursor-not-allowed disabled:opacity-60'>
                                <Send className='h-4 w-4' />
                                Queue instruction
                            </button>
                        </form>

                        <div className='grid gap-4'>
                            <Queue title='Input queue' items={pending} empty='No queued instructions.' />
                            <Queue title='Output queue' items={completed} empty='No completed results yet.' />
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}

function Queue({ title, items, empty }: { title: string, items: PortalItem[], empty: string }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold'>{title}</h2>
            </div>
            <div className='grid gap-2 p-3'>
                {items.length ? items.map(item => <PromptItem key={item.id} item={item} />) : <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{empty}</p>}
            </div>
        </section>
    )
}

function PromptItem({ item }: { item: PortalItem }) {
    return (
        <article className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='text-xs font-semibold uppercase text-ui-muted'>{item.priority === 'now' ? 'Now' : 'Next'} · {item.status}</span>
                <time className='text-xs text-ui-muted'>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
            <p className='whitespace-pre-wrap break-words text-sm leading-6 text-ui-text'>{item.prompt}</p>
            {item.files.length ? <p className='text-xs font-semibold text-ui-muted'>{item.files.length} image{item.files.length === 1 ? '' : 's'} attached</p> : null}
            {item.result ? <pre className='max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm leading-6 text-ui-text'>{item.result}</pre> : null}
        </article>
    )
}

const plainButton = 'inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-60'
const selectedButton = 'inline-flex h-9 items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-sm font-semibold text-ui-text disabled:cursor-not-allowed disabled:opacity-60'
