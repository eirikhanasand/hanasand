'use client'

import { Bot, LoaderCircle, Send } from 'lucide-react'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    composer: string
    isConnected: boolean
    onComposerChange: (value: string) => void
    onSend: () => void
}

export default function ChatPane({
    activeConversation,
    composer,
    isConnected,
    onComposerChange,
    onSend,
}: ChatPaneProps) {
    return (
        <section className='flex min-w-0 flex-1 flex-col rounded-2xl bg-dark/35 outline outline-dark'>
            <div className='border-b border-dark px-6 py-4'>
                <div className='flex items-center justify-between gap-4'>
                    <div>
                        <h1 className='text-xl font-semibold text-bright/90'>{activeConversation?.title || 'AI workspace'}</h1>
                        <p className='mt-1 text-sm text-bright/40'>
                            {isConnected ? 'Connected to live model worker' : 'Waiting for a model worker to connect'}
                        </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                        isConnected ? 'bg-emerald-500/10 text-emerald-400 outline outline-emerald-500/20' : 'bg-red-500/10 text-red-300 outline outline-red-500/20'
                    }`}>
                        {isConnected ? 'Live' : 'Offline'}
                    </div>
                </div>
            </div>

            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5'>
                {!activeConversation?.messages.length ? (
                    <div className='flex h-full min-h-56 items-center justify-center rounded-2xl bg-dark/25 p-6 text-center outline outline-dark'>
                        <div>
                            <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fd8738]/12 text-[#fd8738] outline outline-[#fd8738]/20'>
                                <Bot className='h-6 w-6' />
                            </div>
                            <h2 className='mt-4 text-lg font-semibold text-bright/90'>Start a coding conversation</h2>
                            <p className='mt-2 max-w-xl text-sm text-bright/45'>
                                Attach a share or imported repository on the right, then ask the connected model to inspect files, explain code, or help you edit.
                            </p>
                        </div>
                    </div>
                ) : activeConversation.messages.map((message) => (
                    <div
                        key={message.id}
                        className={`max-w-3xl rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                                ? 'ml-auto bg-[#fd8738]/12 text-bright/90 outline outline-[#fd8738]/20'
                                : message.error
                                    ? 'bg-red-500/10 text-red-100 outline outline-red-500/20'
                                    : 'bg-dark/25 text-bright/90 outline outline-dark'
                        }`}
                    >
                        <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-bright/35'>{message.role}</div>
                        <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6'>{message.content}</div>
                    </div>
                ))}
            </div>

            <div className='border-t border-dark p-4'>
                <div className='rounded-2xl bg-dark/25 p-3 outline outline-dark'>
                    <textarea
                        value={composer}
                        onChange={(event) => onComposerChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault()
                                onSend()
                            }
                        }}
                        placeholder='Ask about the attached codebase, request a plan, or describe an edit...'
                        className='min-h-28 w-full resize-none bg-transparent text-sm text-bright/90 outline-none placeholder:text-bright/30'
                    />
                    <div className='mt-3 flex items-center justify-between'>
                        <p className='text-xs text-bright/30'>Enter to send, Shift+Enter for newline</p>
                        <button
                            type='button'
                            onClick={onSend}
                            className='inline-flex items-center gap-2 rounded-xl bg-[#fd8738] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90'
                        >
                            {activeConversation?.messages.at(-1)?.pending ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
