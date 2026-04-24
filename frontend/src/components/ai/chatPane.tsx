'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, LoaderCircle, PanelRightOpen, Send, Sparkles } from 'lucide-react'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    clients: GPT_Client[]
    composer: string
    isConnected: boolean
    participants: number
    landing?: boolean
    onComposerChange: (value: string) => void
    onModelStrategyChange: (value: 'auto' | 'pinned') => void
    onPreferredModelChange: (value: string | null) => void
    onSend: () => void
}

export default function ChatPane({
    activeConversation,
    composer,
    isConnected,
    participants,
    landing = false,
    onComposerChange,
    onSend,
}: ChatPaneProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [showArtifacts, setShowArtifacts] = useState(false)
    const isThinking = Boolean(activeConversation?.messages.at(-1)?.pending)
        || activeConversation?.metrics?.status === 'preparing'
        || activeConversation?.metrics?.status === 'generating'
    const awaitingResponse = Boolean(activeConversation?.messages.at(-1)?.pending)
    const lastMessageKey = useMemo(() => {
        const lastMessage = activeConversation?.messages.at(-1)
        return `${lastMessage?.id || 'empty'}:${lastMessage?.content.length || 0}:${lastMessage?.pending ? 'pending' : 'done'}`
    }, [activeConversation?.messages])

    useEffect(() => {
        const container = scrollRef.current
        if (!container) {
            return
        }
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }, [lastMessageKey])

    const latestArtifacts = activeConversation?.messages.flatMap((message) =>
        Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []
    ) || []

    return (
        <section className='flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-dark/28 outline outline-dark'>
            <div className='border-b border-dark/80 px-5 py-4'>
                <div className='flex items-center justify-between gap-4'>
                    <div className='min-w-0'>
                        <h1 className='truncate text-base font-semibold text-bright/92'>{activeConversation?.title || 'New chat'}</h1>
                        <p className='mt-1 text-sm text-bright/38'>
                            {isConnected ? `${participants || 1} model${participants === 1 ? '' : 's'} connected` : 'No model connected'}
                        </p>
                    </div>
                    <div className='flex items-center gap-2'>
                        <StatusChip icon={isThinking ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <Sparkles className='h-3.5 w-3.5' />} label={isThinking ? 'Thinking...' : 'Ready'} accent={isThinking} />
                        {latestArtifacts.length ? (
                            <button type='button' onClick={() => setShowArtifacts((prev) => !prev)} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs outline transition-colors ${showArtifacts ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/18' : 'bg-dark/30 text-bright/55 outline-dark hover:text-bright/82'}`}>
                                <PanelRightOpen className='h-3.5 w-3.5' />
                                Artifacts
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className={`grid min-h-0 flex-1 ${showArtifacts ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'}`}>
                <div ref={scrollRef} className='min-h-0 space-y-4 overflow-y-auto px-5 py-5'>
                    {!activeConversation?.messages.length ? (
                        <EmptyComposerState landing={landing} />
                    ) : activeConversation.messages.map((message) => (
                        <article key={message.id} className={`max-w-3xl rounded-2xl px-4 py-3 ${message.role === 'user' ? 'ml-auto bg-[#fd8738]/12 text-bright/92 outline outline-[#fd8738]/20' : message.error ? 'bg-red-500/10 text-red-100 outline outline-red-500/20' : message.role === 'tool' ? 'bg-dark/24 text-bright/75 outline outline-dark' : 'bg-dark/22 text-bright/90 outline outline-dark'}`}>
                            <div className='mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-bright/35'>
                                <span>{message.role === 'tool' ? toolLabel(message) : message.role}</span>
                                <span>{message.role === 'assistant' ? (message.modelName || activeConversation.activeModel || 'assistant') : null}</span>
                            </div>
                            {message.role === 'user' ? (
                                <div className='whitespace-pre-wrap break-words text-sm leading-6'>{message.content}</div>
                            ) : message.role === 'tool' ? (
                                <ToolMessage message={message} />
                            ) : (
                                <MarkdownBlock content={message.content} />
                            )}
                            <ArtifactList artifacts={Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []} />
                        </article>
                    ))}
                </div>

                {showArtifacts ? (
                    <aside className='hidden min-h-0 border-l border-dark/80 bg-dark/18 xl:block'>
                        <div className='border-b border-dark/80 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-bright/35'>
                            Workspace output
                        </div>
                        <div className='min-h-0 space-y-3 overflow-y-auto p-4'>
                            <ArtifactList artifacts={latestArtifacts} forceExpanded />
                        </div>
                    </aside>
                ) : null}
            </div>

            <div className='border-t border-dark/80 p-4'>
                <div className='rounded-2xl bg-dark/22 p-3 outline outline-dark'>
                    <textarea
                        value={composer}
                        onChange={(event) => onComposerChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault()
                                onSend()
                            }
                        }}
                        placeholder='Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...'
                        className='min-h-24 w-full resize-none bg-transparent text-sm text-bright/90 outline-none placeholder:text-bright/28'
                    />
                    <div className='mt-3 flex items-center justify-between gap-3'>
                        <p className='text-xs text-bright/28'>Enter to send, Shift+Enter for newline</p>
                        <button type='button' disabled={!composer.trim() || awaitingResponse || !isConnected} onClick={onSend} className='inline-flex items-center gap-2 rounded-xl bg-[#fd8738] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                            {awaitingResponse ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

function EmptyComposerState({ landing }: { landing: boolean }) {
    return (
        <div className='flex h-full min-h-60 items-center justify-center'>
            <div className='max-w-xl text-center'>
                <div className='mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fd8738]/12 text-[#fd8738] outline outline-[#fd8738]/18'>
                    <Bot className='h-5 w-5' />
                </div>
                <h2 className='mt-5 text-xl font-semibold text-bright/92'>
                    {landing ? 'Start with the task, not the tooling.' : 'Describe what you want built.'}
                </h2>
                <p className='mt-3 text-sm leading-6 text-bright/42'>
                    {landing
                        ? 'Ask for a feature, a bug fix, or a full app. You can attach repositories and shares as the conversation takes shape.'
                        : 'This workspace can attach repositories, inspect files, scaffold starters, and show the tool trail as work happens.'}
                </p>
            </div>
        </div>
    )
}

function MarkdownBlock({ content }: { content: string }) {
    return (
        <div className='prose prose-invert max-w-none break-words text-sm leading-6 prose-p:my-3 prose-pre:overflow-auto prose-pre:rounded-xl prose-pre:bg-black/30 prose-pre:p-3 prose-code:text-[0.9em] prose-a:text-[#fd8738]'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    )
}

function ToolMessage({ message }: { message: AIConversationMessage }) {
    const state = typeof message.metadata?.toolState === 'string' ? message.metadata.toolState : 'running'
    return (
        <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 rounded-full bg-dark/30 px-3 py-1 text-xs text-bright/55 outline outline-dark'>
                {state === 'running' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin text-[#fd8738]' /> : <Sparkles className='h-3.5 w-3.5 text-[#fd8738]' />}
                {state === 'running' ? 'Thinking...' : state === 'error' ? 'Tool error' : 'Tool complete'}
            </div>
            <div className='whitespace-pre-wrap break-words text-sm leading-6 text-bright/78'>{message.content}</div>
        </div>
    )
}

function StatusChip({
    icon,
    label,
    accent = false,
}: {
    icon: React.ReactNode
    label: string
    accent?: boolean
}) {
    return (
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs outline ${accent ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/18' : 'bg-dark/30 text-bright/55 outline-dark'}`}>
            {icon}
            {label}
        </div>
    )
}

function ArtifactList({
    artifacts,
    forceExpanded = false,
}: {
    artifacts: AIArtifact[]
    forceExpanded?: boolean
}) {
    if (!artifacts.length) {
        return null
    }

    return (
        <div className='mt-3 grid gap-3 border-t border-dark/70 pt-3'>
            {artifacts.map((artifact, index) => (
                <details key={`${artifact.kind}-${artifact.title}-${index}`} open={forceExpanded} className='rounded-xl bg-black/18 p-3 outline outline-dark'>
                    <summary className='cursor-pointer list-none'>
                        <div className='text-[10px] uppercase tracking-[0.18em] text-bright/38'>{artifact.kind}</div>
                        <div className='mt-1 text-sm font-medium text-bright/88'>{artifact.title}</div>
                    </summary>
                    {artifact.url ? (
                        <a href={artifact.url} target='_blank' rel='noreferrer' className='mt-2 inline-flex text-xs text-[#fd8738] hover:underline'>
                            {artifact.url}
                        </a>
                    ) : null}
                    {artifact.dataUrl ? (
                        <Image src={artifact.dataUrl} alt={artifact.title} width={1200} height={800} className='mt-3 max-h-72 w-full rounded-lg object-contain outline outline-dark' />
                    ) : null}
                    {artifact.kind === 'diff' && artifact.content ? (
                        <DiffArtifact content={artifact.content} />
                    ) : artifact.content ? (
                        <pre className='mt-3 max-h-72 overflow-auto rounded-lg bg-black/25 p-3 text-xs leading-5 text-bright/78'>{artifact.content}</pre>
                    ) : null}
                </details>
            ))}
        </div>
    )
}

function DiffArtifact({ content }: { content: string }) {
    const lines = content.split('\n')
    return (
        <div className='mt-3 max-h-80 overflow-auto rounded-lg bg-black/25 p-3 text-xs leading-5'>
            {lines.map((line, index) => (
                <div
                    key={`${line}-${index}`}
                    className={`whitespace-pre-wrap break-all rounded px-2 ${line.startsWith('+') ? 'bg-emerald-500/10 text-emerald-300' : line.startsWith('-') ? 'bg-red-500/10 text-red-300' : 'text-bright/72'}`}
                >
                    {line || ' '}
                </div>
            ))}
        </div>
    )
}

function toolLabel(message: AIConversationMessage) {
    const [firstLine] = message.content.split('\n')
    return firstLine || 'tool'
}
