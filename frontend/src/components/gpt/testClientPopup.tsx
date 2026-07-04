'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X } from 'lucide-react'
import Button from '../misc/button'
import ErrorNotice from '@/components/error/errorNotice'

type TestClientPopupProps = {
    client: GPT_Client
    conversationId: string
    isSending: boolean
    messages: GPT_ChatMessage[]
    metrics: GPT_ModelMetrics
    onClose: () => void
    onSend: (content: string) => void
}

export default function TestClientPopup({
    client,
    conversationId,
    isSending,
    messages,
    metrics,
    onClose,
    onSend,
}: TestClientPopupProps) {
    const [input, setInput] = useState('')
    const scrollerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    useEffect(() => {
        if (!scrollerRef.current) {
            return
        }

        scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
    }, [messages])

    function handleSubmit() {
        const trimmed = input.trim()
        if (!trimmed || isSending) {
            return
        }

        onSend(trimmed)
        setInput('')
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-ui-canvas/65 backdrop-blur-md p-4'>
            <div
                className='relative flex h-[min(85vh,54rem)] w-full max-w-5xl flex-col overflow-hidden
                    rounded-2xl bg-ui-canvas shadow-2xl outline outline-ui-border'
            >
                <div className='absolute inset-x-0 top-0 h-1 bg-linear-to-r from-ui-primary/60 via-ui-primary to-ui-primary/50' />
                <div className='flex items-center justify-between border-b border-ui-border px-6 py-4'>
                    <div>
                        <h2 className='text-xl font-semibold text-ui-text/90'>Test client</h2>
                        <p className='text-sm text-ui-text/50'>
                            {client.name} • conversation {conversationId}
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={onClose}
                        className='rounded-lg p-2 text-ui-text/35 transition-colors hover:bg-ui-primary/12 hover:text-ui-primary'
                    >
                        <X className='h-5 w-5' />
                    </button>
                </div>

                <div className='grid flex-1 min-h-0 lg:grid-cols-[minmax(0,1fr)_19rem]'>
                    <div className='flex min-h-0 flex-col border-b border-ui-border lg:border-b-0 lg:border-r'>
                        <div ref={scrollerRef} className='flex-1 space-y-4 overflow-y-auto p-6'>
                            {!messages.length ? (
                                <div
                                    className='flex h-full min-h-56 items-center justify-center rounded-2xl
                                        bg-ui-canvas/20 p-6 text-center outline outline-dashed outline-ui-border'
                                >
                                    <div>
                                        <div
                                            className='mx-auto flex h-12 w-12 items-center justify-center
                                                rounded-full bg-ui-primary/12 text-ui-primary outline outline-ui-primary/20'
                                        >
                                            <Bot className='h-6 w-6' />
                                        </div>
                                        <h3 className='mt-4 font-semibold text-ui-text/90'>
                                            Start a test conversation
                                        </h3>
                                        <p className='mt-2 text-sm text-ui-text/50'>
                                            Send a prompt to verify this client responds and watch
                                            the token metrics update while it generates.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`max-w-3xl rounded-2xl border px-4 py-3 ${
                                            message.role === 'user'
                                                ? 'ml-auto border-ui-primary/20 bg-ui-primary/12 text-ui-text/90'
                                                : message.error
                                                    ? 'border-ui-danger/20 bg-ui-danger/10 text-ui-danger'
                                                    : 'bg-ui-canvas/20 text-ui-text/90 outline outline-ui-border'
                                        }`}
                                    >
                                        <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-ui-text/35'>
                                            {message.role}
                                        </div>
                                        <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6'>
                                            {message.content || (message.pending ? 'Generating...' : '')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className='border-t border-ui-border p-4'>
                            <div className='flex flex-col gap-3'>
                                <textarea
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault()
                                            handleSubmit()
                                        }
                                    }}
                                    placeholder='Ask the client something...'
                                    className='min-h-28 w-full rounded-2xl bg-ui-canvas/20 px-4 py-3 text-sm text-ui-text/90 outline outline-ui-border transition-colors placeholder:text-ui-text/35 focus:outline-ui-primary/35'
                                />
                                <div className='flex justify-end'>
                                    <Button
                                        text={isSending ? 'Generating' : 'Send'}
                                        icon={<Send className='h-4 w-4' />}
                                        onClick={handleSubmit}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='space-y-3 p-4'>
                        <StatCard title='Status' value={operationalStateLabel(metrics.status)} />
                        <StatCard title='TPS' value={metrics.tps.toFixed(1)} />
                        <StatCard title='Current tokens' value={metrics.currentTokens.toString()} />
                        <StatCard title='Max tokens' value={metrics.maxTokens.toString()} />
                        <StatCard title='Prompt tokens' value={metrics.promptTokens.toString()} />
                        <StatCard title='Generated tokens' value={metrics.generatedTokens.toString()} />
                        <StatCard
                            title='Context'
                            value={`${metrics.contextTokens}/${metrics.contextMaxTokens || 0}`}
                        />
                        {metrics.lastError ? <StatCard title='Last error' value={metrics.lastError} error /> : null}
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, error = false }: { title: string, value: string, error?: boolean }) {
    return (
        <div
            className={`rounded-2xl border p-3 ${
                error ? 'border-ui-danger/20 bg-ui-danger/10' : 'bg-ui-canvas/20 outline outline-ui-border'
            }`}
        >
            <div className='text-[10px] uppercase tracking-[0.18em] text-ui-text/35'>{title}</div>
            {error ? <ErrorNotice compact className='mt-2' message={value} /> : <div className='mt-2 text-sm font-semibold text-ui-text/90'>{value}</div>}
        </div>
    )
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'action_required') return 'reviewing'
    return value.replaceAll('_', ' ')
}
