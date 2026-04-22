'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, LoaderCircle, Send, Zap } from 'lucide-react'
import Image from 'next/image'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    clients: GPT_Client[]
    composer: string
    isConnected: boolean
    onComposerChange: (value: string) => void
    onModelStrategyChange: (value: 'auto' | 'pinned') => void
    onPreferredModelChange: (value: string | null) => void
    onSend: () => void
}

export default function ChatPane(props: ChatPaneProps) {
    const { activeConversation, composer, isConnected, onComposerChange, onSend } = props
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const isThinking = Boolean(activeConversation?.messages.at(-1)?.pending)
        || activeConversation?.metrics?.status === 'preparing'
        || activeConversation?.metrics?.status === 'generating'
    const lastMessageKey = useMemo(() => {
        const lastMessage = activeConversation?.messages.at(-1)
        return `${lastMessage?.id || 'empty'}:${lastMessage?.content.length || 0}:${lastMessage?.pending ? 'pending' : 'done'}`
    }, [activeConversation?.messages])

    useEffect(() => {
        const container = scrollRef.current
        if (!container) {
            return
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
        })
    }, [lastMessageKey])

    const awaitingResponse = Boolean(activeConversation?.messages.at(-1)?.pending)

    return (
        <section className='flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-dark/35 outline outline-dark'>
            <div className='border-b border-dark px-5 py-4'>
                <div className='flex flex-wrap items-center justify-between gap-4'>
                    <div>
                        <h1 className='text-lg font-semibold text-bright/90'>{activeConversation?.title || 'New chat'}</h1>
                        <p className='mt-1 text-sm text-bright/40'>
                            {isConnected ? 'Connected to the live model pool' : 'Waiting for a model worker to connect'}
                        </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${isConnected ? 'bg-emerald-500/10 text-emerald-400 outline outline-emerald-500/20' : 'bg-red-500/10 text-red-300 outline outline-red-500/20'}`}>
                        {isConnected ? 'Live' : 'Offline'}
                    </div>
                </div>
                <div className='mt-3 flex flex-wrap gap-2 text-xs text-bright/42'>
                    <StatusPill icon={isThinking ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <Bot className='h-3.5 w-3.5' />} label={isThinking ? 'Thinking' : 'Ready'} />
                    <StatusPill icon={<Zap className='h-3.5 w-3.5' />} label={`${Math.round(activeConversation?.metrics?.tps || 0)} TPS`} />
                </div>
            </div>
            <div ref={scrollRef} className='min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5'>
                {!activeConversation?.messages.length ? (
                    <div className='flex h-full min-h-56 items-center justify-center text-center'>
                        <div className='max-w-xl text-sm leading-6 text-bright/42'>
                            Start with a prompt. Attach a repo or share from the tools above the chat list when you want the assistant to work against live code.
                        </div>
                    </div>
                ) : activeConversation.messages.map((message) => (
                    <div key={message.id} className={`max-w-3xl rounded-2xl px-4 py-3 ${message.role === 'user' ? 'ml-auto bg-[#fd8738]/12 text-bright/90 outline outline-[#fd8738]/20' : message.error ? 'bg-red-500/10 text-red-100 outline outline-red-500/20' : message.role === 'tool' ? 'bg-[#fd8738]/8 text-bright/80 outline outline-[#fd8738]/12' : 'bg-dark/25 text-bright/90 outline outline-dark'}`}>
                        <div className='mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-bright/35'>
                            <span>{message.role}</span>
                            <span>{message.modelName || (message.role === 'tool' ? 'workspace tool' : 'assistant')}</span>
                        </div>
                        {message.role === 'user' ? (
                            <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6'>{message.content}</div>
                        ) : (
                            <MarkdownBlock content={message.content} />
                        )}
                        <ArtifactList artifacts={Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []} />
                    </div>
                ))}
            </div>
            <div className='border-t border-dark p-4'>
                <div className='rounded-2xl bg-dark/25 p-3 outline outline-dark'>
                    <textarea value={composer} onChange={(event) => onComposerChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} placeholder='Ask about your code, request a patch, inspect a repo, or describe the task you want done...' className='min-h-28 w-full resize-none bg-transparent text-sm text-bright/90 outline-none placeholder:text-bright/30' />
                    <div className='mt-3 flex items-center justify-between'>
                        <p className='text-xs text-bright/30'>Enter to send, Shift+Enter for newline</p>
                        <button type='button' disabled={!composer.trim() || awaitingResponse || !isConnected} onClick={onSend} className='inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#fd8738] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                            {awaitingResponse ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />} Send
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

function MarkdownBlock({ content }: { content: string }) {
    return (
        <div className='prose prose-invert max-w-none wrap-break-word text-sm leading-6 prose-p:my-3 prose-pre:overflow-auto prose-pre:rounded-xl prose-pre:bg-black/30 prose-pre:p-3 prose-code:text-[0.9em] prose-a:text-[#fd8738]'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    )
}

function StatusPill({ icon, label }: { icon: ReactNode, label: string }) {
    return (
        <div className='inline-flex items-center gap-2 rounded-full bg-dark/30 px-3 py-1.5 outline outline-dark'>
            <span className='text-[#fd8738]'>{icon}</span>
            <span>{label}</span>
        </div>
    )
}

function ArtifactList({ artifacts }: { artifacts: AIArtifact[] }) {
    if (!artifacts.length) {
        return null
    }

    return (
        <div className='mt-3 grid gap-3 border-t border-dark/80 pt-3'>
            {artifacts.map((artifact, index) => (
                <div key={`${artifact.kind}-${artifact.title}-${index}`} className='rounded-xl bg-black/20 p-3 outline outline-dark'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-bright/38'>{artifact.kind}</div>
                    <div className='text-sm font-medium text-bright/88'>{artifact.title}</div>
                    {artifact.url ? (
                        <a href={artifact.url} target='_blank' rel='noreferrer' className='mt-2 inline-flex text-xs text-[#fd8738] hover:underline'>
                            {artifact.url}
                        </a>
                    ) : null}
                    {artifact.dataUrl ? (
                        <Image src={artifact.dataUrl} alt={artifact.title} className='mt-3 max-h-72 w-full rounded-lg object-contain outline outline-dark' />
                    ) : null}
                    {artifact.content ? (
                        <pre className='mt-3 max-h-72 overflow-auto rounded-lg bg-black/25 p-3 text-xs leading-5 text-bright/78'>{artifact.content}</pre>
                    ) : null}
                </div>
            ))}
        </div>
    )
}
