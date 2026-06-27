'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, ArrowUp, Bot, CheckCircle2, ChevronDown, ExternalLink, FolderKanban, LoaderCircle, PanelRightOpen, Sparkles, X } from 'lucide-react'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    clients: GPT_Client[]
    composer: string
    isConnected: boolean
    isAuthenticated: boolean
    participants: number
    landing?: boolean
    readOnly?: boolean
    onComposerChange: (value: string) => void
    onModelStrategyChange: (value: 'auto' | 'pinned') => void
    onPreferredModelChange: (value: string | null) => void
    onSend: () => void
}

const EMPTY_CHAT_TOOLTIPS = [
    'Attach the relevant context, then ask for a focused review, code change, or release check.',
    'Start from a bug, repo, screenshot, or customer note and keep the important context visible.',
    'Ask for a plan, implementation pass, browser check, or customer-ready summary.',
]

export default function ChatPane({
    activeConversation,
    clients,
    composer,
    isConnected,
    isAuthenticated,
    readOnly = false,
    onModelStrategyChange,
    onPreferredModelChange,
    onComposerChange,
    onSend,
}: ChatPaneProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [showArtifacts, setShowArtifacts] = useState(false)
    const [modelMenuOpen, setModelMenuOpen] = useState(false)
    const [previewArtifact, setPreviewArtifact] = useState<AIArtifact | null>(null)
    const emptyTooltip = useMemo(() => pickTooltip(EMPTY_CHAT_TOOLTIPS) || EMPTY_CHAT_TOOLTIPS[0], [])
    const isThinking = Boolean(activeConversation?.messages.at(-1)?.pending)
        || activeConversation?.metrics?.status === 'preparing'
        || activeConversation?.metrics?.status === 'generating'
    const awaitingResponse = Boolean(activeConversation?.messages.at(-1)?.pending)
    const hasReadyModel = isConnected && clients.length > 0
    const unavailableModelReason = isAuthenticated
        ? 'Review is paused. You can still open context, attach files, and continue from this page.'
        : 'Review is paused. Sign in to continue, or open shared context first.'
    const composerBlockedReason = readOnly
        ? 'Reviewer mode: you can inspect this workspace but cannot send prompts.'
        : awaitingResponse
            ? 'Waiting for the current agent turn to finish.'
            : !hasReadyModel
                ? unavailableModelReason
                : null
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
    const groupedArtifacts = useMemo(() => groupArtifacts(latestArtifacts), [latestArtifacts])
    const selectedClient = useMemo(() => {
        const selectedName = activeConversation?.preferredModel || activeConversation?.activeModel
        return clients.find((client) => client.name === selectedName) || clients[0] || null
    }, [activeConversation?.activeModel, activeConversation?.preferredModel, clients])
    const selectedModelLabel = selectedClient ? 'Review ready' : 'Review paused'

    return (
        <Fragment>
            <section className='relative flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden'>
                <div className='relative z-10 w-full max-w-full border-b border-[#e0e5ed] bg-white px-4 py-4 sm:px-7 sm:py-5'>
                    <div className='flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                        <div className='min-w-0'>
                            <h1 className='truncate text-base font-semibold tracking-normal text-[#171a21]'>{conversationTitle(activeConversation?.title)}</h1>
                            <div className='relative mt-1 inline-block'>
                                <button
                                    type='button'
                                    onClick={() => setModelMenuOpen((prev) => !prev)}
                                    disabled={!clients.length}
                                    className='inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-[#3056d3] transition-colors hover:text-[#2546a8] disabled:cursor-not-allowed disabled:text-[#98a2b3] sm:px-1'
                                    title={selectedModelLabel}
                                >
                                    <span className='truncate'>{isConnected ? selectedModelLabel : 'Review paused'}</span>
                                    {clients.length ? <ChevronDown className='h-3.5 w-3.5 shrink-0' /> : null}
                                </button>
                                {modelMenuOpen && clients.length ? (
                                    <div className='absolute left-0 top-full z-30 mt-2 w-[min(26rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-[0_18px_60px_rgba(26,35,55,0.14)]'>
                                        {clients.map((client) => {
                                            const active = client.name === selectedClient?.name
                                            return (
                                                <button
                                                    key={client.name}
                                                    type='button'
                                                    onClick={() => {
                                                        onModelStrategyChange('pinned')
                                                        onPreferredModelChange(client.name)
                                                        setModelMenuOpen(false)
                                                    }}
                                                    className={`block w-full px-3 py-2.5 text-left transition-colors ${active ? 'bg-[#eef3ff] text-[#2546a8]' : 'text-[#344054] hover:bg-[#f8fafc] hover:text-[#171a21]'}`}
                                                >
                                                    <span className='block truncate text-sm font-medium'>{modelLabel(client)}</span>
                                                    <span className='mt-0.5 block truncate text-xs text-[#667085]'>{client.name}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className='flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
                            <Link
                                href='/s'
                                className='grid h-9 w-9 place-items-center rounded-lg text-[#667085] transition-colors hover:bg-[#f8fafc] hover:text-[#171a21]'
                                aria-label='Import context'
                            >
                                <FolderKanban className='h-4 w-4 shrink-0' />
                            </Link>
                            <StatusChip
                                icon={isThinking ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <Sparkles className='h-3.5 w-3.5' />}
                                label={isThinking ? 'Working...' : hasReadyModel ? 'Ready' : 'Paused'}
                                accent={isThinking}
                            />
                            {latestArtifacts.length ? (
                                <button type='button' onClick={() => setShowArtifacts((prev) => !prev)} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${showArtifacts ? 'bg-[#eef3ff] text-[#2546a8]' : 'text-[#667085] hover:bg-[#f8fafc] hover:text-[#171a21]'}`}>
                                    <PanelRightOpen className='h-3.5 w-3.5' />
                                    Artifacts
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className={`grid min-h-0 w-full max-w-full flex-1 ${showArtifacts ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'}`}>
                    <div ref={scrollRef} className='min-h-0 w-full max-w-full space-y-5 overflow-y-auto px-5 py-8 md:px-12 xl:px-24'>
                        {!activeConversation?.messages.length ? (
                            <EmptyComposerState tooltip={emptyTooltip} hasReadyModel={hasReadyModel} isAuthenticated={isAuthenticated} />
                        ) : activeConversation.messages.map((message) => (
                            <article key={message.id} className={`max-w-3xl rounded-lg border px-4 py-3 ${message.role === 'user' ? 'ml-auto border-[#dfe5ee] bg-white text-[#171a21] shadow-sm' : message.error ? 'border-[#fecdca] bg-[#fff1f0] text-[#912018]' : message.role === 'tool' ? 'border-[#dfe5ee] bg-[#f8fafc] text-[#344054]' : 'border-transparent bg-transparent text-[#171a21]'}`}>
                                {message.role === 'tool' || message.role === 'assistant' ? (
                                    <div className='mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase text-[#667085]'>
                                        <span>{message.role === 'tool' ? toolLabel(message) : message.role}</span>
                                        <span>{message.role === 'assistant' ? (message.modelName || activeConversation.activeModel || 'assistant') : null}</span>
                                    </div>
                                ) : null}
                                {message.role === 'user' ? (
                                    <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6'>{message.content}</div>
                                ) : message.role === 'tool' ? (
                                    <ToolMessage
                                        message={message}
                                        artifacts={Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []}
                                    />
                                ) : (
                                    <MarkdownBlock content={message.content} />
                                )}
                                <ArtifactList
                                    artifacts={Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []}
                                    onPreview={setPreviewArtifact}
                                />
                            </article>
                        ))}
                    </div>

                    {showArtifacts ? (
                        <aside className='min-h-0 border-t border-[#e0e5ed] bg-white xl:border-t-0 xl:border-l'>
                            <div className='border-b border-[#e0e5ed] px-4 py-3 text-[11px] font-semibold uppercase text-[#667085]'>
                                Workspace output
                            </div>
                            <div className='min-h-0 space-y-3 overflow-y-auto p-4'>
                                {groupedArtifacts.map((group) => (
                                    <section key={group.kind} className='space-y-3'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <div>
                                                <div className='text-[10px] font-semibold uppercase text-[#667085]'>{group.label}</div>
                                                <div className='mt-1 text-xs text-[#596170]'>{group.artifacts.length} item{group.artifacts.length === 1 ? '' : 's'}</div>
                                            </div>
                                            <div className='rounded-full border border-[#d8dee9] px-2.5 py-1 text-[10px] font-semibold uppercase text-[#667085]'>
                                                {group.kind}
                                            </div>
                                        </div>
                                        <ArtifactList artifacts={group.artifacts} forceExpanded onPreview={setPreviewArtifact} />
                                    </section>
                                ))}
                            </div>
                        </aside>
                    ) : null}
                </div>

                <div className='relative z-10 border-t border-[#e0e5ed] bg-white px-4 py-4 md:px-12 xl:px-24'>
                    <div className='mx-auto flex min-h-14 max-w-5xl items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 shadow-sm focus-within:border-[#3056d3] focus-within:ring-4 focus-within:ring-[#dce6ff]'>
                        <textarea
                            value={composer}
                            onChange={(event) => onComposerChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    onSend()
                                }
                            }}
                            placeholder='Ask Hanasand to inspect context, draft a change, review files, or prepare customer notes...'
                            readOnly={readOnly}
                            rows={1}
                            className='h-10 min-h-0 flex-1 resize-none overflow-hidden bg-transparent py-2 text-sm leading-6 text-[#171a21] outline-none placeholder:text-[#8c95a5]'
                        />
                        <button
                            type='button'
                            aria-label='Send'
                            aria-describedby={composerBlockedReason ? 'ai-composer-blocked-reason' : undefined}
                            title={composerBlockedReason || undefined}
                            disabled={Boolean(composerBlockedReason) || !composer.trim()}
                            onClick={onSend}
                            className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#171a21] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'
                        >
                            {awaitingResponse ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <ArrowUp className='h-3.5 w-3.5 stroke-[2.8]' />}
                        </button>
                    </div>
                    {composerBlockedReason ? (
                        <div id='ai-composer-blocked-reason' className='mx-auto mt-2 max-w-5xl px-4 text-xs text-[#667085]'>
                            {composerBlockedReason}
                        </div>
                    ) : null}
                </div>
            </section>
            <ArtifactPreviewOverlay artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
        </Fragment>
    )
}

function EmptyComposerState({ tooltip, hasReadyModel, isAuthenticated }: { tooltip: string, hasReadyModel: boolean, isAuthenticated: boolean }) {
    return (
        <div className='flex h-full min-h-[28rem] items-center justify-center'>
            <div className='max-w-xl text-center'>
                <div className='mx-auto grid h-14 w-14 place-items-center rounded-lg border border-[#dfe5ee] bg-white text-[#3056d3]'>
                    <Bot className='h-6 w-6' />
                </div>
                <h2 className='mt-7 text-2xl font-semibold tracking-normal text-[#171a21]'>
                    Review context, then ship when it is ready.
                </h2>
                <p className='mt-3 text-sm leading-6 text-[#596170]'>
                    {hasReadyModel
                        ? tooltip
                        : 'Attach context or open a shared workspace. Files, launch state, and notes stay visible while review is paused.'}
                </p>
                {!hasReadyModel ? (
                    <div className='mt-5 flex flex-wrap justify-center gap-2 text-xs text-[#596170]'>
                        <Link href='/s' className='inline-flex min-h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-3 py-1.5 font-semibold transition-colors hover:bg-[#f8fafc] hover:text-[#171a21]'>
                            Open context
                        </Link>
                        {!isAuthenticated ? (
                            <Link href='/login' className='inline-flex min-h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-3 py-1.5 font-semibold transition-colors hover:bg-[#f8fafc] hover:text-[#171a21]'>
                                Sign in
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function pickTooltip(tooltips: unknown[]) {
    const candidates = tooltips
        .map((item) => {
            if (typeof item === 'string') return { text: item, weight: 1 }
            if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
                return {
                    text: item.text,
                    weight: 'weight' in item && typeof item.weight === 'number' && Number.isFinite(item.weight) ? item.weight : 1,
                }
            }
            if (item && typeof item === 'object' && 'message' in item && typeof item.message === 'string') {
                return { text: item.message, weight: 1 }
            }
            return { text: '', weight: 1 }
        })
        .map((item) => ({ ...item, text: item.text.trim(), weight: Math.max(0.1, item.weight) }))
        .filter((item) => item.text)
    if (!candidates.length) return ''
    const total = candidates.reduce((sum, item) => sum + item.weight, 0)
    let cursor = Math.random() * total
    for (const candidate of candidates) {
        cursor -= candidate.weight
        if (cursor <= 0) return candidate.text
    }
    return candidates[0]?.text || ''
}

function modelLabel(client: GPT_Client) {
    return client.displayName || client.modelId || client.profile || client.name
}

function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'New chat' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'Review assistant' : normalized
}

function MarkdownBlock({ content }: { content: string }) {
    return (
        <div className='prose max-w-none wrap-break-word text-sm leading-6 text-[#344054] prose-p:my-3 prose-pre:overflow-auto prose-pre:rounded-lg prose-pre:bg-[#f4f6fa] prose-pre:p-3 prose-code:text-[0.9em] prose-a:text-[#3056d3]'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    )
}

function ToolMessage({
    message,
    artifacts,
}: {
    message: AIConversationMessage
    artifacts: AIArtifact[]
}) {
    const state = typeof message.metadata?.toolState === 'string' ? message.metadata.toolState : 'running'
    const browserSummary = getBrowserVerificationSummary(message, artifacts)

    return (
        <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-medium text-[#3056d3]'>
                {state === 'running' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin text-[#3056d3]' /> : <Sparkles className='h-3.5 w-3.5 text-[#3056d3]' />}
                {state === 'running' ? 'Working...' : state === 'error' ? 'Tool error' : 'Tool complete'}
            </div>
            {browserSummary ? <BrowserVerificationCard summary={browserSummary} /> : null}
            <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6 text-[#344054]'>{message.content}</div>
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
        <div className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs ${accent ? 'bg-[#eef3ff] text-[#3056d3]' : 'text-[#667085]'}`}>
            {icon}
            {label}
        </div>
    )
}

function ArtifactList({
    artifacts,
    forceExpanded = false,
    onPreview,
}: {
    artifacts: AIArtifact[]
    forceExpanded?: boolean
    onPreview: (artifact: AIArtifact | null) => void
}) {
    if (!artifacts.length) {
        return null
    }

    return (
        <div className='mt-3 grid gap-3 border-t border-dark/70 pt-3'>
            {artifacts.map((artifact, index) => (
                <details
                    key={`${artifact.kind}-${artifact.title}-${index}`}
                    open={forceExpanded || index === artifacts.length - 1}
                    className={`rounded-xl border bg-[#202020] p-3 ${artifact.kind === 'screenshot' ? 'border-[#555550]' : index === artifacts.length - 1 ? 'border-[#444440]' : 'border-[#30302e]'}`}
                >
                    <summary className='cursor-pointer list-none'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <div className='text-[10px] uppercase tracking-[0.16em] text-[#858581]'>{artifactKindLabel(artifact.kind)}</div>
                                <div className='mt-1 text-sm font-medium text-[#eeeeea]'>{artifact.title}</div>
                            </div>
                            <div className='flex items-center gap-2'>
                                {artifact.kind === 'screenshot' ? (
                                    <div className='rounded-full bg-[#30302e] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#d3d3ce]'>
                                        Verification
                                    </div>
                                ) : null}
                                {index === artifacts.length - 1 ? (
                                    <div className='rounded-full bg-[#30302e] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#d3d3ce]'>
                                        Newest
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </summary>
                    {artifact.url ? (
                        <a href={artifact.url} target='_blank' rel='noopener noreferrer' className='mt-2 inline-flex items-center gap-1.5 text-xs text-[#d3d3ce] hover:underline'>
                            {artifact.url}
                            <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                    ) : null}
                    {artifact.dataUrl ? (
                        <button type='button' onClick={() => onPreview(artifact)} className='mt-3 block w-full text-left'>
                            <Image src={artifact.dataUrl} alt={artifact.title} width={1200} height={800} className='max-h-72 w-full rounded-lg object-contain outline outline-[#30302e] transition hover:opacity-92' />
                            <div className='mt-2 text-xs text-[#9a9a95]'>Open full-size preview</div>
                        </button>
                    ) : null}
                    {artifact.kind === 'diff' && artifact.content ? (
                        <DiffArtifact content={artifact.content} />
                    ) : artifact.content ? (
                        <ArtifactTextContent artifact={artifact} />
                    ) : null}
                </details>
            ))}
        </div>
    )
}

function ArtifactTextContent({ artifact }: { artifact: AIArtifact }) {
    const [expanded, setExpanded] = useState(false)
    const lines = (artifact.content || '').split('\n')
    const shouldCollapse = (artifact.kind === 'log' || artifact.kind === 'command') && lines.length > 18
    const visibleContent = shouldCollapse && !expanded ? lines.slice(0, 18).join('\n') : artifact.content || ''

    return (
        <div className='mt-3'>
            <pre className='max-h-72 overflow-auto rounded-lg bg-[#151515] p-3 text-xs leading-5 text-[#d3d3ce]'>{visibleContent}</pre>
            {shouldCollapse ? (
                <button
                    type='button'
                    onClick={() => setExpanded((prev) => !prev)}
                    className='mt-2 text-xs text-[#d3d3ce] hover:underline'
                >
                    {expanded ? 'Collapse output' : `Expand full output (${lines.length} lines)`}
                </button>
            ) : null}
        </div>
    )
}

function ArtifactPreviewOverlay({
    artifact,
    onClose,
}: {
    artifact: AIArtifact | null
    onClose: () => void
}) {
    if (!artifact?.dataUrl) {
        return null
    }

    return (
        <div className='fixed inset-0 z-200 flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm' onClick={onClose}>
            <div className='w-full max-w-6xl rounded-3xl bg-[#070909] p-4 outline outline-white/10' onClick={(event) => event.stopPropagation()}>
                <div className='mb-3 flex items-center justify-between gap-3'>
                    <div>
                        <div className='text-[10px] uppercase tracking-[0.16em] text-[#858581]'>{artifactKindLabel(artifact.kind)}</div>
                        <div className='mt-1 text-sm font-medium text-[#eeeeea]'>{artifact.title}</div>
                    </div>
                    <button type='button' onClick={onClose} className='rounded-full bg-white/5 p-2 text-[#d3d3ce] outline outline-white/10 transition hover:bg-white/8'>
                        <X className='h-4 w-4' />
                    </button>
                </div>
                <div className='overflow-auto rounded-2xl bg-black/30 p-3'>
                    <Image src={artifact.dataUrl} alt={artifact.title} width={1600} height={1200} className='max-h-[78vh] w-full object-contain' />
                </div>
            </div>
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
                    className={`whitespace-pre-wrap break-all rounded px-2 ${line.startsWith('+') ? 'bg-[#283026] text-[#b9c8b0]' : line.startsWith('-') ? 'bg-[#352321] text-[#d8aaa5]' : 'text-[#b7b7b2]'}`}
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

function BrowserVerificationCard({
    summary,
}: {
    summary: {
        status: 'passed' | 'issues'
        url: string | null
        title: string | null
        pageErrors: string[]
        consoleMessages: string[]
        hasScreenshot: boolean
    }
}) {
    const issueLines = [...summary.pageErrors, ...summary.consoleMessages].slice(0, 4)

    return (
        <div className={`rounded-2xl border px-4 py-3 ${summary.status === 'passed' ? 'border-[#3b4537] bg-[#20251f] text-[#d9e3d4]' : 'border-[#4a4030] bg-[#27231d] text-[#e6d6b7]'}`}>
            <div className='flex items-start gap-3'>
                <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${summary.status === 'passed' ? 'bg-[#30382d] text-[#d9e3d4]' : 'bg-[#332c21] text-[#e6d6b7]'}`}>
                    {summary.status === 'passed' ? <CheckCircle2 className='h-4 w-4' /> : <AlertTriangle className='h-4 w-4' />}
                </div>
                <div className='min-w-0 flex-1'>
                    <div className='text-[10px] uppercase tracking-[0.18em] text-current/70'>Browser verification</div>
                    <div className='mt-1 text-sm font-medium'>
                        {summary.status === 'passed' ? 'Verification passed' : 'Verification found issues'}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-2 text-[11px] text-current/80'>
                        {summary.title ? <span className='rounded-full bg-black/20 px-2.5 py-1'>{summary.title}</span> : null}
                        {summary.url ? <span className='rounded-full bg-black/20 px-2.5 py-1'>{summary.url}</span> : null}
                        <span className='rounded-full bg-black/20 px-2.5 py-1'>{summary.hasScreenshot ? 'Screenshot captured' : 'No screenshot'}</span>
                        <span className='rounded-full bg-black/20 px-2.5 py-1'>{summary.pageErrors.length} page error{summary.pageErrors.length === 1 ? '' : 's'}</span>
                        <span className='rounded-full bg-black/20 px-2.5 py-1'>{summary.consoleMessages.length} console message{summary.consoleMessages.length === 1 ? '' : 's'}</span>
                    </div>
                    {issueLines.length ? (
                        <div className='mt-3 space-y-1 text-xs text-current/90'>
                            {issueLines.map((line, index) => (
                                <div key={`${line}-${index}`} className='rounded-lg bg-black/20 px-2.5 py-2'>
                                    {line}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function getBrowserVerificationSummary(message: AIConversationMessage, artifacts: AIArtifact[]) {
    if (!message.content.includes('Tool browser_task executed')) {
        return null
    }

    const lines = message.content.split('\n')
    const url = lines.find((line) => line.startsWith('Tool browser_task executed for URL: '))?.replace('Tool browser_task executed for URL: ', '') || null
    const title = lines.find((line) => line.startsWith('Title: '))?.replace('Title: ', '') || null
    const pageErrors = extractBrowserSection(message.content, 'Page errors:')
    const consoleMessages = extractBrowserSection(message.content, 'Console:')
    const hasScreenshot = artifacts.some((artifact) => artifact.kind === 'screenshot')

    return {
        status: (pageErrors.length || consoleMessages.length || message.error ? 'issues' : 'passed') as 'issues' | 'passed',
        url,
        title,
        pageErrors,
        consoleMessages,
        hasScreenshot,
    }
}

function extractBrowserSection(content: string, label: string) {
    const normalized = content.replace(/\r\n/g, '\n')
    const marker = `${label}\n`
    const startIndex = normalized.indexOf(marker)

    if (startIndex === -1) {
        return []
    }

    const sectionStart = startIndex + marker.length
    const remaining = normalized.slice(sectionStart)
    const sectionEnd = remaining.indexOf('\n\n')
    const rawSection = (sectionEnd === -1 ? remaining : remaining.slice(0, sectionEnd)).trim()

    if (!rawSection || rawSection === '<none>') {
        return []
    }

    return rawSection.split('\n').map((line) => line.trim()).filter(Boolean)
}

function groupArtifacts(artifacts: AIArtifact[]) {
    const order: AIArtifact['kind'][] = ['screenshot', 'command', 'http', 'log', 'file', 'link', 'diff']
    const labels: Record<AIArtifact['kind'], string> = {
        screenshot: 'Screenshots',
        command: 'Command output',
        http: 'HTTP checks',
        log: 'Logs',
        file: 'Files',
        link: 'Links',
        diff: 'Diffs',
    }

    return order
        .map((kind) => ({
            kind,
            label: labels[kind],
            artifacts: artifacts.filter((artifact) => artifact.kind === kind),
        }))
        .filter((group) => group.artifacts.length > 0)
}

function artifactKindLabel(kind: AIArtifact['kind']) {
    switch (kind) {
        case 'screenshot':
            return 'Screenshot'
        case 'command':
            return 'Command'
        case 'http':
            return 'HTTP'
        case 'log':
            return 'Log'
        case 'file':
            return 'File'
        case 'link':
            return 'Link'
        case 'diff':
            return 'Diff'
        default:
            return kind
    }
}
