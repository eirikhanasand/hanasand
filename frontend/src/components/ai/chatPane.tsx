'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, Bot, CheckCircle2, ExternalLink, LoaderCircle, PanelRightOpen, Send, Sparkles, X } from 'lucide-react'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    clients: GPT_Client[]
    composer: string
    isConnected: boolean
    participants: number
    landing?: boolean
    readOnly?: boolean
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
    readOnly = false,
    onComposerChange,
    onSend,
}: ChatPaneProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [showArtifacts, setShowArtifacts] = useState(false)
    const [previewArtifact, setPreviewArtifact] = useState<AIArtifact | null>(null)
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
    const groupedArtifacts = useMemo(() => groupArtifacts(latestArtifacts), [latestArtifacts])

    return (
        <Fragment>
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

                <div className={`grid min-h-0 flex-1 ${showArtifacts ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'}`}>
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
                        <aside className='min-h-0 border-t border-dark/80 bg-dark/18 xl:border-t-0 xl:border-l'>
                            <div className='border-b border-dark/80 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-bright/35'>
                                Workspace output
                            </div>
                            <div className='min-h-0 space-y-3 overflow-y-auto p-4'>
                                {groupedArtifacts.map((group) => (
                                    <section key={group.kind} className='space-y-3'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <div>
                                                <div className='text-[10px] uppercase tracking-[0.18em] text-bright/32'>{group.label}</div>
                                                <div className='mt-1 text-xs text-bright/48'>{group.artifacts.length} item{group.artifacts.length === 1 ? '' : 's'}</div>
                                            </div>
                                            <div className='rounded-full bg-dark/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-bright/38 outline outline-dark'>
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
                            readOnly={readOnly}
                            className='min-h-24 w-full resize-none bg-transparent text-sm text-bright/90 outline-none placeholder:text-bright/28'
                        />
                        <div className='mt-3 flex items-center justify-between gap-3'>
                            <p className='text-xs text-bright/28'>{readOnly ? 'Reviewer mode: inspect the conversation and workspace, but only editors can send.' : 'Enter to send, Shift+Enter for newline'}</p>
                            <button type='button' disabled={readOnly || !composer.trim() || awaitingResponse || !isConnected} onClick={onSend} className='inline-flex items-center gap-2 rounded-xl bg-[#fd8738] px-4 py-2 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                                {awaitingResponse ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </section>
            <ArtifactPreviewOverlay artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
        </Fragment>
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
                        ? 'Ask for a feature, a bug fix, or an app. Attach repos or shares when needed.'
                        : 'Attach repos, inspect files, scaffold starters, and review tool output here.'}
                </p>
            </div>
        </div>
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
            <div className='inline-flex items-center gap-2 rounded-full bg-dark/30 px-3 py-1 text-xs text-bright/55 outline outline-dark'>
                {state === 'running' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin text-[#fd8738]' /> : <Sparkles className='h-3.5 w-3.5 text-[#fd8738]' />}
                {state === 'running' ? 'Thinking...' : state === 'error' ? 'Tool error' : 'Tool complete'}
            </div>
            {browserSummary ? <BrowserVerificationCard summary={browserSummary} /> : null}
            <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6 text-bright/78'>{message.content}</div>
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
                    className={`rounded-xl bg-black/18 p-3 outline ${artifact.kind === 'screenshot' ? 'outline-sky-400/30' : index === artifacts.length - 1 ? 'outline-[#fd8738]/25' : 'outline-dark'}`}
                >
                    <summary className='cursor-pointer list-none'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <div className='text-[10px] uppercase tracking-[0.18em] text-bright/38'>{artifactKindLabel(artifact.kind)}</div>
                                <div className='mt-1 text-sm font-medium text-bright/88'>{artifact.title}</div>
                            </div>
                            <div className='flex items-center gap-2'>
                                {artifact.kind === 'screenshot' ? (
                                    <div className='rounded-full bg-sky-400/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-200 outline outline-sky-400/20'>
                                        Verification
                                    </div>
                                ) : null}
                                {index === artifacts.length - 1 ? (
                                    <div className='rounded-full bg-[#fd8738]/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#fd8738] outline outline-[#fd8738]/20'>
                                        Newest
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </summary>
                    {artifact.url ? (
                        <a href={artifact.url} target='_blank' rel='noopener noreferrer' className='mt-2 inline-flex items-center gap-1.5 text-xs text-[#fd8738] hover:underline'>
                            {artifact.url}
                            <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                    ) : null}
                    {artifact.dataUrl ? (
                        <button type='button' onClick={() => onPreview(artifact)} className='mt-3 block w-full text-left'>
                            <Image src={artifact.dataUrl} alt={artifact.title} width={1200} height={800} className='max-h-72 w-full rounded-lg object-contain outline outline-dark transition hover:opacity-92' />
                            <div className='mt-2 text-xs text-bright/45'>Open full-size preview</div>
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
            <pre className='max-h-72 overflow-auto rounded-lg bg-black/25 p-3 text-xs leading-5 text-bright/78'>{visibleContent}</pre>
            {shouldCollapse ? (
                <button
                    type='button'
                    onClick={() => setExpanded((prev) => !prev)}
                    className='mt-2 text-xs text-[#fd8738] hover:underline'
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
                        <div className='text-[10px] uppercase tracking-[0.18em] text-bright/32'>{artifactKindLabel(artifact.kind)}</div>
                        <div className='mt-1 text-sm font-medium text-bright/88'>{artifact.title}</div>
                    </div>
                    <button type='button' onClick={onClose} className='rounded-full bg-white/5 p-2 text-bright/72 outline outline-white/10 transition hover:bg-white/8'>
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
        <div className={`rounded-2xl px-4 py-3 outline ${summary.status === 'passed' ? 'bg-emerald-500/10 text-emerald-50 outline-emerald-500/20' : 'bg-amber-500/10 text-amber-50 outline-amber-500/20'}`}>
            <div className='flex items-start gap-3'>
                <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${summary.status === 'passed' ? 'bg-emerald-400/12 text-emerald-300' : 'bg-amber-400/12 text-amber-200'}`}>
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
