'use client'

import { aiClientRequest } from '@/utils/ai/client'
import randomId from '@/utils/random/randomId'
import { findTreeFileId, listTreePaths } from '@/components/ai/shareTree'
import { updateShare } from '@/utils/share/put'
import postShare from '@/utils/share/post'
import { ArrowUp, Check, Code2, ExternalLink, Gauge, Globe2, Loader2, RotateCw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import ErrorNotice from '@/components/error/errorNotice'

type ShareChatProps = {
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    tree?: Tree | null
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    mode?: 'panel' | 'workspace'
    previewUrl?: string | null
}

type Message = {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    createdAt: string
}

type PendingEdit = {
    id: string
    changes: PendingShareChange[]
    status: 'pending' | 'applying' | 'applied' | 'error'
    error?: string
}

type PendingShareChange = {
    id: string
    action: 'update_share' | 'upsert_share'
    shareId?: string
    path: string
    beforeContent: string
    content: string
    created?: boolean
}

type ToolCall = {
    action?: 'update_share' | 'upsert_share' | 'create_share' | 'browser_task'
    shareId?: string
    path?: string
    content?: string
    type?: 'file' | 'folder'
    url?: string
    captureScreenshot?: boolean
    timeoutMs?: number
    actions?: ToolCall[]
}

type BrowserTarget = {
    url: string
    title: string
}

type BrowserEvidence = {
    id: string
    url: string
    title?: string | null
    screenshotPath?: string | null
    textExcerpt?: string
    structure?: {
        headings?: string[]
        links?: { text?: string, href?: string }[]
        buttons?: string[]
        inputs?: string[]
        forms?: string[]
        hasViewportMeta?: boolean
    }
    consoleMessages?: string[]
    pageErrors?: string[]
    fetchedAt: string
}

type RunSummary = {
    durationMs: number
    pendingChanges: number
    browserProofs: number
    tokenCap: number
    status: 'completed' | 'error'
}

export default function ShareChat({
    share,
    setShare,
    tree,
    editingContent,
    setEditorPatch,
    mode = 'panel',
    previewUrl,
}: ShareChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null)
    const [browserTarget, setBrowserTarget] = useState<BrowserTarget | null>(null)
    const [browserEvidence, setBrowserEvidence] = useState<BrowserEvidence[]>([])
    const [lastRun, setLastRun] = useState<RunSummary | null>(null)
    const [lastBrowserCalls, setLastBrowserCalls] = useState<ToolCall[]>([])
    const [retryingProof, setRetryingProof] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const formRef = useRef<HTMLFormElement | null>(null)
    const treePaths = useMemo(() => listTreePaths(tree || null).slice(0, 80), [tree])
    const proofTarget = previewUrl
        ? { label: 'Preview target', url: previewUrl }
        : share
            ? { label: 'Current share target', url: buildShareEvidenceUrl(share) }
            : null
    const composerHint = getComposerHint(input)
    const pendingEditBlocksNewRun = pendingEdit?.status === 'pending' || pendingEdit?.status === 'applying'
    const canSend = hydrated && !loading && !pendingEditBlocksNewRun
    const phaseLabel = loading
        ? elapsedSeconds < 4
            ? 'Scoping'
            : elapsedSeconds < 14
                ? 'Preparing'
                : 'Still working'
        : pendingEdit?.status === 'pending'
            ? 'Review'
            : pendingEdit?.status === 'applied'
                ? 'Applied'
                : 'Ready'
    const proofApplyBlocked = pendingEdit?.status === 'pending' && lastRun?.status === 'error' && lastRun.browserProofs > 0

    useEffect(() => {
        setHydrated(true)
    }, [])

    useEffect(() => {
        if (!startedAt) {
            setElapsedSeconds(0)
            return
        }

        const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        updateElapsed()
        const interval = window.setInterval(updateElapsed, 1000)
        return () => window.clearInterval(interval)
    }, [startedAt])

    async function submit(event?: FormEvent<HTMLFormElement>) {
        event?.preventDefault()
        const currentForm = event?.currentTarget
        await submitPrompt(readSubmittedPrompt(currentForm))
    }

    async function submitPrompt(rawPrompt: string) {
        const trimmed = rawPrompt.trim()
        if (!trimmed || loading) {
            return
        }
        const activeShare = share || createOptimisticChatShare(trimmed)

        const userMessage: Message = {
            id: randomId(),
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        }
        setMessages((current) => [...current, userMessage])
        setInput('')
        setLoading(true)
        setStartedAt(Date.now())
        setPendingEdit(null)
        setLastRun(null)
        const runStartedAt = Date.now()

        try {
            const tokenCap = 2200
            const response = await requestShareChat({
                method: 'POST',
                body: JSON.stringify({
                    prompt: buildPrompt(trimmed, activeShare, editingContent, treePaths, previewUrl || null),
                    context: buildContext(activeShare, editingContent, treePaths, messages, previewUrl || null, trimmed),
                    maxTokens: tokenCap,
                }),
            })
            const data = await response.json().catch(() => ({}))
            const rawContent = response.ok
                ? data.message || data.suggestion || 'No response.'
                : friendlyChatError(response.status)
            if (response.ok && data.intent === 'open_browser' && data.target?.url) {
                setBrowserTarget({
                    url: data.target.url,
                    title: data.target.title || data.target.url,
                })
            }
            const toolCalls = parseToolCalls(rawContent)
            const pendingChanges = buildPendingChanges(toolCalls, activeShare, tree || null, editingContent)
            const browserCalls = toolCalls.filter((call) => call.action === 'browser_task' && call.url)
            const boundedBrowserCalls = browserCalls.slice(0, 3)
            let browserProofs = browserCalls.length
            let browserProofHadIssues = false
            const visibleContent = stripToolTags(rawContent).trim()
                || (pendingChanges.length ? `Prepared ${pendingChanges.length} file change${pendingChanges.length === 1 ? '' : 's'}.` : rawContent)

            setMessages((current) => [...current, {
                id: randomId(),
                role: response.ok ? 'assistant' : 'tool',
                content: visibleContent,
                createdAt: new Date().toISOString(),
            }])

            if (pendingChanges.length) {
                setPendingEdit({
                    id: randomId(),
                    changes: pendingChanges,
                    status: 'pending',
                })
            }
            setLastBrowserCalls(boundedBrowserCalls)
            if (browserCalls.length) {
                const results = await Promise.all(boundedBrowserCalls.map(runBrowserEvidenceTool))
                const visibleResults = results.filter(Boolean) as BrowserEvidence[]
                browserProofs = visibleResults.length
                browserProofHadIssues = visibleResults.length !== boundedBrowserCalls.length
                    || visibleResults.some((result) => Boolean(result.pageErrors?.filter(Boolean).length))
                if (visibleResults.length) {
                    setBrowserEvidence((current) => [...visibleResults, ...current].slice(0, 5))
                    setMessages((current) => [...current, ...visibleResults.map((result) => ({
                        id: randomId(),
                        role: 'tool' as const,
                        content: summarizeBrowserEvidence(result),
                        createdAt: new Date().toISOString(),
                    }))])
                }
            }
            setLastRun({
                durationMs: Date.now() - runStartedAt,
                pendingChanges: pendingChanges.length,
                browserProofs,
                tokenCap,
                status: response.ok && !browserProofHadIssues ? 'completed' : 'error',
            })
        } catch {
            setMessages((current) => [...current, {
                id: randomId(),
                role: 'tool',
                content: 'Hanasand AI is reconnecting. Try the same message again in a moment.',
                createdAt: new Date().toISOString(),
            }])
            setLastRun({
                durationMs: Date.now() - runStartedAt,
                pendingChanges: 0,
                browserProofs: 0,
                tokenCap: 2200,
                status: 'error',
            })
        } finally {
            setLoading(false)
            setStartedAt(null)
            window.setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    function readSubmittedPrompt(form?: HTMLFormElement) {
        if (!form) {
            return inputRef.current?.value || input
        }
        const formData = new FormData(form)
        const submittedInput = typeof formData.get('shareChatPrompt') === 'string'
            ? formData.get('shareChatPrompt') as string
            : ''
        const submittedFallback = typeof formData.get('shareChatPromptFallback') === 'string'
            ? formData.get('shareChatPromptFallback') as string
            : ''
        const fallbackInput = inputRef.current?.value || ''
        return submittedInput || submittedFallback || fallbackInput || input
    }

    async function retryBrowserProof() {
        if (!lastBrowserCalls.length || retryingProof) {
            return
        }

        setRetryingProof(true)
        const runStartedAt = Date.now()
        try {
            const results = await Promise.all(lastBrowserCalls.map(runBrowserEvidenceTool))
            const visibleResults = results.filter(Boolean) as BrowserEvidence[]
            const browserProofHadIssues = visibleResults.length !== lastBrowserCalls.length
                || visibleResults.some((result) => Boolean(result.pageErrors?.filter(Boolean).length))

            if (visibleResults.length) {
                setBrowserEvidence((current) => [...visibleResults, ...current].slice(0, 5))
                setMessages((current) => [...current, ...visibleResults.map((result) => ({
                    id: randomId(),
                    role: 'tool' as const,
                    content: summarizeBrowserEvidence(result),
                    createdAt: new Date().toISOString(),
                }))])
            }

            setLastRun({
                durationMs: Date.now() - runStartedAt,
                pendingChanges: pendingEdit?.changes.length || 0,
                browserProofs: visibleResults.length,
                tokenCap: lastRun?.tokenCap || 2200,
                status: browserProofHadIssues ? 'error' : 'completed',
            })
        } finally {
            setRetryingProof(false)
        }
    }

    async function applyPendingEdit() {
        if (!share || !pendingEdit || pendingEdit.status === 'applying' || proofApplyBlocked) {
            return
        }

        setPendingEdit((current) => current ? { ...current, status: 'applying', error: undefined } : current)
        const applied: Share[] = []
        for (const change of pendingEdit.changes) {
            const updated = change.shareId
                ? await updateShare(change.shareId, {
                    content: change.content,
                    path: change.path,
                })
                : await postShare({
                    includeTree: true,
                    id: randomId(),
                    content: change.content,
                    name: fileNameFromPath(change.path),
                    path: change.path,
                    parent: parentIdForPath(tree || null, change.path) || share.parent || undefined,
                    type: 'file',
                })
            if (!updated) {
                setPendingEdit((current) => current ? { ...current, status: 'error', error: `Unable to apply ${change.path}.` } : current)
                return
            }
            applied.push(updated)
        }

        const activeUpdate = applied.find((updated) => updated.id === share.id)
        if (activeUpdate) {
            setShare(activeUpdate)
            setEditorPatch({ value: activeUpdate.content, nonce: Date.now() })
        }
        setPendingEdit((current) => current ? { ...current, status: 'applied' } : current)
        setMessages((current) => [...current, {
            id: randomId(),
            role: 'tool',
            content: `Applied ${pendingEdit.changes.length} file change${pendingEdit.changes.length === 1 ? '' : 's'}.`,
            createdAt: new Date().toISOString(),
        }])
        if (pendingEdit.changes.some((change) => !change.shareId)) {
            window.setTimeout(() => window.location.reload(), 500)
        }
    }

    function discardPendingEdit() {
        if (pendingEdit?.status === 'applying') {
            return
        }
        setPendingEdit(null)
    }

    return (
        <section className={`flex flex-col overflow-hidden rounded-lg border border-bright/8 bg-black/10 ${
            mode === 'workspace' ? 'h-full min-h-0 shadow-2xl shadow-black/20' : 'h-[calc(100%-3.5rem)] min-h-[32rem]'
        }`}>
            <div className='flex items-center justify-between border-b border-bright/8 px-3 py-2'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-bright/88'>
                        <Sparkles className='h-4 w-4 text-[#f07d33]' />
                        Chat
                    </div>
                    <p className='truncate text-xs text-bright/45'>{share?.path || 'Waiting for share...'}</p>
                </div>
                <span className='rounded-full border border-bright/10 px-2 py-1 text-[10px] font-medium text-bright/45'>
                    {treePaths.length ? `${treePaths.length} files` : 'Current file'}
                </span>
            </div>
            <div className='grid grid-cols-3 gap-2 border-b border-bright/8 bg-black/12 px-3 py-2 text-[11px] text-bright/58'>
                <div className='flex min-w-0 items-center gap-1.5 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1'>
                    {loading ? <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin text-[#f07d33]' /> : <Gauge className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />}
                    <span className='truncate'>{phaseLabel}{loading ? ` · ${elapsedSeconds}s` : ''}</span>
                </div>
                <div className='flex min-w-0 items-center gap-1.5 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1'>
                    <Code2 className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />
                    <span className='truncate'>{treePaths.length ? `${treePaths.length} context files` : 'Current file context'}</span>
                </div>
                <div className='flex min-w-0 items-center gap-1.5 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1'>
                    <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />
                    <span className='truncate'>
                        {pendingEdit?.status === 'pending'
                            ? `${pendingEdit.changes.length} pending change${pendingEdit.changes.length === 1 ? '' : 's'}`
                            : 'No auto-apply'}
                    </span>
                </div>
            </div>

            {lastRun ? (
                <div className='border-b border-bright/8 bg-black/10 px-3 py-2'>
                    <div className='flex flex-wrap items-center gap-1.5 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1.5 text-[11px] text-bright/58'>
                        <Gauge className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />
                        <span className='font-semibold text-bright/70'>Last run</span>
                        <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{formatRunDuration(lastRun.durationMs)}</span>
                        <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{lastRun.pendingChanges} edit{lastRun.pendingChanges === 1 ? '' : 's'}</span>
                        <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{lastRun.browserProofs} browser proof{lastRun.browserProofs === 1 ? '' : 's'}</span>
                        <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{(lastRun.tokenCap / 1000).toFixed(1)}k cap</span>
                        <span className={`rounded-full border px-2 py-0.5 ${lastRun.status === 'completed' ? 'border-emerald-300/15 text-emerald-100/62' : 'border-red-300/15 text-red-100/70'}`}>
                            {lastRun.status === 'completed' ? 'Completed' : 'Needs retry'}
                        </span>
                    </div>
                </div>
            ) : null}

            {proofTarget?.url ? (
                <div className='border-b border-bright/8 bg-black/10 px-3 py-2'>
                    <div className='flex items-center justify-between gap-3 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1.5 text-[11px] text-bright/62'>
                        <div className='flex min-w-0 items-center gap-1.5'>
                            <Globe2 className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />
                            <span className='shrink-0 font-semibold text-bright/68'>{proofTarget.label}</span>
                            <span className='truncate font-mono text-bright/42'>{proofTarget.url}</span>
                        </div>
                        <a href={proofTarget.url} target='_blank' rel='noopener noreferrer' aria-label='Open current AI proof target' className='grid h-7 w-7 shrink-0 place-items-center rounded-md text-bright/45 transition hover:bg-bright/8 hover:text-bright'>
                            <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                    </div>
                </div>
            ) : null}

            {browserEvidence[0] ? (
                <div className='border-b border-bright/8 bg-black/10 px-3 py-2'>
                    <div className='grid gap-2 rounded-lg border border-bright/8 bg-bright/[0.035] px-2 py-1.5 text-[11px] text-bright/62 sm:grid-cols-[minmax(0,1fr)_auto]'>
                        <div className='flex min-w-0 items-start gap-1.5'>
                            <ScanSearch className='h-3.5 w-3.5 shrink-0 text-[#f07d33]' />
                            <div className='min-w-0'>
                                <p className='truncate font-semibold text-bright/72'>Browser proof: {browserEvidence[0].title || 'Untitled page'}</p>
                                <p className='truncate font-mono text-bright/42'>{browserEvidence[0].url}</p>
                            </div>
                        </div>
                        <div className='flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end'>
                            <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{browserEvidence[0].structure?.headings?.length || 0} headings</span>
                            <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{browserEvidence[0].pageErrors?.filter(Boolean).length || 0} issues</span>
                            <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/50'>{browserEvidence[0].screenshotPath ? 'Screenshot captured' : 'No screenshot'}</span>
                            <span className='rounded-full border border-bright/8 px-2 py-0.5 text-bright/42'>{browserEvidence.length} saved</span>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className={`flex-1 space-y-3 overflow-y-auto px-3 py-4 ${mode === 'workspace' ? 'lg:px-6 lg:py-5' : ''}`}>
                {messages.length === 0 ? (
                    <div className='grid h-full place-items-center text-center'>
                        <div>
                            <div className='mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bright/7 text-bright/70'>
                                <Sparkles className='h-5 w-5' />
                            </div>
                            <h3 className='text-base font-semibold text-bright/90'>Ready when you are.</h3>
                            <p className='mt-1 max-w-xs text-sm leading-5 text-bright/48'>Ask for a change and review the diff before it lands.</p>
                        </div>
                    </div>
                ) : messages.map((message) => (
                    <article key={message.id} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                        message.role === 'user'
                            ? 'ml-auto bg-bright/12 text-bright'
                            : message.role === 'tool'
                                ? 'border border-bright/8 bg-black/18 text-bright/62'
                                : 'bg-white/[0.055] text-bright/82'
                    }`}>
                        <p className='whitespace-pre-wrap wrap-break-word'>{message.content}</p>
                    </article>
                ))}
                {loading ? (
                    <div className='flex items-center gap-2 text-sm text-bright/55'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        {phaseLabel} changes
                    </div>
                ) : null}
                {browserTarget ? (
                    <div className='overflow-hidden rounded-2xl border border-bright/10 bg-black/24'>
                        <div className='flex items-center justify-between gap-3 border-b border-bright/8 px-3 py-2'>
                            <div className='flex min-w-0 items-center gap-2'>
                                <Globe2 className='h-4 w-4 shrink-0 text-[#f07d33]' />
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-semibold text-bright/82'>{browserTarget.title}</p>
                                    <p className='truncate text-xs text-bright/42'>{browserTarget.url}</p>
                                </div>
                            </div>
                            <a href={browserTarget.url} target='_blank' rel='noopener noreferrer' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-bright/52 transition hover:bg-bright/8 hover:text-bright' aria-label='Open browser target in a new tab'>
                                <ExternalLink className='h-4 w-4' />
                            </a>
                        </div>
                        <iframe
                            src={browserTarget.url}
                            title={`Inline browser for ${browserTarget.title}`}
                            className='h-[min(34rem,52vh)] w-full border-0 bg-white'
                            sandbox='allow-forms allow-modals allow-popups allow-same-origin allow-scripts'
                        />
                    </div>
                ) : null}
                {browserEvidence.map((evidence) => (
                    <BrowserEvidenceCard key={evidence.id} evidence={evidence} />
                ))}
            </div>

            {pendingEdit ? (
                <div className='border-t border-bright/8 bg-black/14 p-3'>
                    <div className='mb-2 flex items-center justify-between gap-3'>
                        <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-bright/82'>
                            <Code2 className='h-4 w-4 text-[#f07d33]' />
                            <span className='truncate'>
                                {pendingEdit.changes.length === 1
                                    ? pendingEdit.changes[0].path
                                    : `${pendingEdit.changes.length} file changes`}
                            </span>
                        </div>
                        <div className='flex shrink-0 items-center gap-1.5'>
                            {pendingEdit.status === 'pending' ? (
                                <button
                                    type='button'
                                    onClick={discardPendingEdit}
                                    className='inline-flex h-8 cursor-pointer items-center rounded-full border border-bright/10 px-3 text-xs font-medium text-bright/52 transition hover:bg-bright/8 hover:text-bright/72'
                                >
                                    Discard
                                </button>
                            ) : null}
                            <button
                                type='button'
                                disabled={pendingEdit.status === 'applying' || pendingEdit.status === 'applied' || proofApplyBlocked}
                                onClick={applyPendingEdit}
                                className='inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-bright/10 px-3 text-xs font-medium text-bright/72 transition hover:bg-bright/8 disabled:cursor-default disabled:opacity-55'
                            >
                                {pendingEdit.status === 'applying' ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Check className='h-3.5 w-3.5' />}
                                {proofApplyBlocked ? 'Retry proof first' : pendingEdit.status === 'applied' ? 'Applied' : 'Apply'}
                            </button>
                        </div>
                    </div>
                    {pendingEditBlocksNewRun ? (
                        <div className='mb-2 rounded-lg border border-amber-200/10 bg-amber-950/12 px-2 py-1.5 text-xs text-amber-50/68'>
                            Resolve the pending change before starting another AI run.
                        </div>
                    ) : null}
                    {proofApplyBlocked ? (
                        <div className='mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300/10 bg-red-950/15 px-2 py-1.5 text-xs text-red-100/72'>
                            <span>Browser proof needs retry before these changes can be applied.</span>
                            {lastBrowserCalls.length ? (
                                <button
                                    type='button'
                                    onClick={retryBrowserProof}
                                    disabled={retryingProof}
                                    className='inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-red-200/15 px-2.5 text-[11px] font-medium text-red-50/82 transition hover:bg-red-100/10 disabled:cursor-default disabled:opacity-55'
                                >
                                    {retryingProof ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <RotateCw className='h-3.5 w-3.5' />}
                                    Retry proof
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <div className='max-h-56 space-y-2 overflow-auto rounded-lg border border-bright/8 bg-black/24 p-2'>
                        {pendingEdit.changes.map((change) => {
                            const summary = summarizePendingChange(change)
                            return (
                                <details key={change.id} open={pendingEdit.changes.length <= 2} className='rounded-md border border-bright/8 bg-black/18 p-2'>
                                    <summary className='cursor-pointer text-xs font-semibold text-bright/72'>
                                        {summary.action} {change.path}
                                    </summary>
                                    <div className='mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-bright/52'>
                                        <span className='rounded-full border border-bright/8 px-2 py-0.5'>{summary.totalLines} line{summary.totalLines === 1 ? '' : 's'}</span>
                                        <span className='rounded-full border border-emerald-300/10 px-2 py-0.5 text-emerald-100/62'>+{summary.added}</span>
                                        <span className='rounded-full border border-red-300/10 px-2 py-0.5 text-red-100/62'>-{summary.removed}</span>
                                        <span className='truncate text-bright/42'>{summary.kind}</span>
                                    </div>
                                    <pre className='mt-2 whitespace-pre-wrap text-xs leading-5 text-bright/68'>
                                        {buildDiff(change.beforeContent, change.content)}
                                    </pre>
                                </details>
                            )
                        })}
                    </div>
                    {pendingEdit.error ? <ErrorNotice compact className='mt-2' message={pendingEdit.error} /> : null}
                </div>
            ) : null}

            <form ref={formRef} onSubmit={submit} className='border-t border-bright/8 p-3'>
                <div className='flex items-end gap-2 rounded-2xl border border-bright/10 bg-bright/[0.045] p-2'>
                    <input type='hidden' name='shareChatPromptFallback' value={input} />
                    <textarea
                        ref={inputRef}
                        name='shareChatPrompt'
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onInput={(event) => setInput(event.currentTarget.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault()
                                event.currentTarget.form?.requestSubmit()
                            }
                        }}
                        placeholder='Ask Hanasand AI to change this project...'
                        className='max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-bright outline-none placeholder:text-bright/35'
                        rows={1}
                    />
                    <button
                        type='button'
                        disabled={!canSend}
                        onClick={() => void submitPrompt(readSubmittedPrompt(formRef.current || undefined))}
                        aria-label='Send message'
                        className='grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-bright text-background transition hover:bg-bright/88 disabled:cursor-default disabled:opacity-35'
                    >
                        <ArrowUp className='h-4 w-4' />
                    </button>
                </div>
                {pendingEditBlocksNewRun ? (
                    <p className='mt-2 text-xs text-bright/42'>
                        Apply or discard the pending change before asking for another edit.
                    </p>
                ) : composerHint ? (
                    <p className='mt-2 text-xs text-bright/42'>
                        {composerHint}
                    </p>
                ) : null}
            </form>
        </section>
    )
}

async function requestShareChat(init: RequestInit & { body?: BodyInit | null }) {
    let lastResponse: Response | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const response = await aiClientRequest('/tools/ai', init)
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                return response
            }
            lastResponse = response
        } catch {
            // Retry transient browser/network failures before surfacing a calm fallback.
        }
        await wait(Math.min(350 * 2 ** attempt, 3000))
    }
    if (lastResponse) {
        return lastResponse
    }
    throw new Error('Chat connection failed.')
}

function friendlyChatError(status: number) {
    if (status === 429) {
        return 'The AI limit is cooling down. Try again in a moment.'
    }
    if (status === 401 || status === 403) {
        return 'The chat session is reconnecting. Try again in a moment.'
    }
    return 'Hanasand AI is reconnecting. Try again in a moment.'
}

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function buildPrompt(prompt: string, share: Share, editingContent: string, treePaths: string[], previewUrl: string | null) {
    const shareEvidenceUrl = buildShareEvidenceUrl(share)
    const diagnosticMode = isDeploymentDiagnosticPrompt(prompt)
    const costControlMode = isCostControlPrompt(prompt)
    const maintainabilityMode = isMaintainabilityPrompt(prompt)
    const progressGovernanceMode = isProgressGovernancePrompt(prompt)
    const evidenceTargets = [
        previewUrl ? `Runnable preview: ${previewUrl}` : null,
        shareEvidenceUrl ? `Current share page: ${shareEvidenceUrl}` : null,
    ].filter(Boolean)
    return [
        'You are Hanasand AI in a browser chat panel for the active /s share.',
        'Help like a coding agent. Be concise. For pure conversation, answer normally.',
        'For project changes, move directly to useful files. Do not ask for a full brief unless the request is impossible or unsafe.',
        'Keep visible prose to at most 5 short sentences. Spend tokens on complete file contents, not meta commentary.',
        'When the user asks for project changes, return complete replacement content for every changed or new file using Hanasand tool tags.',
        evidenceTargets.length ? `Browser evidence targets:\n${evidenceTargets.join('\n')}` : 'Browser evidence target: use the current share or preview URL once it exists.',
        'When the user asks whether a preview, public page, mobile page, pricing, contact, accessibility, or visual state works, request browser evidence using the best target above, for example:',
        `<hanasand-tool>{"action":"browser_task","url":"${previewUrl || shareEvidenceUrl || 'https://hanasand.com/s'}","captureScreenshot":true,"timeoutMs":16000}</hanasand-tool>`,
        'Use browser evidence before claiming a page works. If a screenshot is unavailable, say so briefly and use headings, links, buttons, forms, errors, and viewport proof.',
        diagnosticMode ? [
            'Deployment diagnostic mode:',
            '- For build failures, missing logs, env variable mismatch, preview vs production drift, or deploy queue/runtime issues, do not guess and do not edit first.',
            '- First return a compact diagnostic checklist covering target URL, environment scope, last changed config/package files, exact error/log evidence needed, and the smallest safe next check.',
            '- If browser evidence can prove the public or preview page state, request browser evidence. If logs or secrets are needed, ask for the specific missing evidence without asking for broad access.',
        ].join('\n') : null,
        costControlMode ? [
            'Cost control mode:',
            '- Users may be reacting to credit burn, broad rewrites, repeated retries, wrong-secret loops, or a project that got worse after many versions.',
            '- Preserve the current project shape. Prefer the smallest cohesive edit, name the intended files before tool tags, and avoid replacing unrelated files.',
            '- If the prompt says the AI made it worse, first identify what should be restored or preserved. Do not rebuild a different site unless the user explicitly asks.',
        ].join('\n') : null,
        maintainabilityMode ? [
            'Maintainability mode:',
            '- Users may be worried about AI-builder lock-in, messy generated code, missing CMS/content ownership, slow pages, browser/device edge cases, or redundant CSS/assets.',
            '- Prefer plain owned code, minimal dependencies, accessible semantic markup, and a structure a developer can maintain later.',
            '- Do not hide core content in platform-specific magic. If the user needs editing or CMS behavior, propose the smallest durable content model instead of hard-coding everything.',
            '- Treat performance and ownership as acceptance criteria: avoid giant generated styles, unused assets, opaque widgets, and unnecessary client-side code.',
        ].join('\n') : null,
        progressGovernanceMode ? [
            'Progress governance mode:',
            '- Users may be reacting to agents that wait silently, burn time while saying almost done, ask meaningless approvals, or ask a question and then proceed anyway.',
            '- Make approval points meaningful: name the exact action, files/scope, why it is needed, risk, and the smallest reversible next step.',
            '- Do not ask rhetorical questions followed by tool tags that already perform the action. If user confirmation is needed, stop before changing files.',
            '- If blocked, say the exact blocker and the next observable evidence needed. Prefer partial working output, logs, screenshots, or runtime errors over vague progress updates.',
            '- For runtime or deploy issues, keep the observe-and-react loop alive: collect stdout/stderr, browser console, screenshots, or deployment logs before claiming success.',
        ].join('\n') : null,
        'Tool format:',
        '<hanasand-tool>{"action":"upsert_share","path":"src/app/page.tsx","content":"complete file content"}</hanasand-tool>',
        'You may emit several tool tags in one answer. Do not emit partial diffs. Prefer small, cohesive files over one giant file. Include package/config files when a bot, API, or app needs them.',
        `Current share: ${share.id} (${share.path})`,
        treePaths.length ? `Project files:\n${treePaths.join('\n')}` : null,
        `Current file content:\n${editingContent.slice(0, 12000)}`,
        `User request:\n${prompt}`,
    ].filter(Boolean).join('\n\n')
}

function buildContext(share: Share, editingContent: string, treePaths: string[], messages: Message[], previewUrl: string | null, prompt: string) {
    return JSON.stringify({
        share: { id: share.id, path: share.path, alias: share.alias, parent: share.parent },
        diagnosticMode: isDeploymentDiagnosticPrompt(prompt),
        costControlMode: isCostControlPrompt(prompt),
        maintainabilityMode: isMaintainabilityPrompt(prompt),
        progressGovernanceMode: isProgressGovernancePrompt(prompt),
        browserEvidenceTargets: {
            previewUrl,
            sharePageUrl: buildShareEvidenceUrl(share),
        },
        tree: treePaths,
        currentContent: editingContent.slice(0, 6000),
        recentMessages: messages.slice(-3).map(({ role, content }) => ({ role, content })),
    })
}

function buildShareEvidenceUrl(share: Share | null) {
    const slug = share?.alias || share?.path || share?.id
    return slug ? `https://hanasand.com/s/${encodeURIComponent(slug)}` : null
}

function parseToolCalls(content: string): ToolCall[] {
    return [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].flatMap((match) => {
        try {
            const parsed = JSON.parse(match[1]) as ToolCall
            return Array.isArray(parsed.actions) ? parsed.actions : [parsed]
        } catch {
            return []
        }
    })
}

function buildPendingChanges(toolCalls: ToolCall[], share: Share, tree: Tree | null, editingContent: string): PendingShareChange[] {
    return toolCalls.flatMap((call) => {
        if (!call.content || !['update_share', 'upsert_share', 'create_share'].includes(call.action || '')) {
            return []
        }
        const path = normalizeSharePath(call.path || share.path || 'index.html')
        const existingShareId = call.shareId || findTreeFileId(tree, path) || (path === share.path ? share.id : undefined)
        return [{
            id: randomId(),
            action: call.action === 'update_share' ? 'update_share' : 'upsert_share',
            shareId: existingShareId,
            path,
            beforeContent: existingShareId === share.id ? editingContent : '',
            content: call.content,
            created: !existingShareId,
        }]
    })
}

async function runBrowserEvidenceTool(call: ToolCall): Promise<BrowserEvidence | null> {
    if (!call.url) {
        return null
    }
    try {
        const response = await aiClientRequest('/tools/browser/task', {
            method: 'POST',
            body: JSON.stringify({
                url: call.url,
                captureScreenshot: Boolean(call.captureScreenshot),
                timeoutMs: call.timeoutMs || 16000,
            }),
        })
        const payload = await response.json().catch(() => null) as Omit<BrowserEvidence, 'id' | 'fetchedAt'> | null
        if (!response.ok || !payload) {
            return {
                id: randomId(),
                url: call.url,
                title: null,
                screenshotPath: null,
                structure: emptyBrowserStructure(),
                consoleMessages: [],
                pageErrors: [friendlyChatError(response.status)],
                fetchedAt: new Date().toISOString(),
            }
        }
        return {
            id: randomId(),
            ...payload,
            url: payload.url || call.url,
            structure: payload.structure || emptyBrowserStructure(),
            fetchedAt: new Date().toISOString(),
        }
    } catch {
        return {
            id: randomId(),
            url: call.url,
            title: null,
            screenshotPath: null,
            structure: emptyBrowserStructure(),
            consoleMessages: [],
            pageErrors: ['Browser evidence is reconnecting. Try the check again in a moment.'],
            fetchedAt: new Date().toISOString(),
        }
    }
}

function BrowserEvidenceCard({ evidence }: { evidence: BrowserEvidence }) {
    const structure = evidence.structure || emptyBrowserStructure()
    const issues = evidence.pageErrors?.filter(Boolean) || []
    return (
        <article className='overflow-hidden rounded-2xl border border-bright/10 bg-black/24'>
            <div className='flex items-center justify-between gap-3 border-b border-bright/8 px-3 py-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <ScanSearch className='h-4 w-4 shrink-0 text-[#f07d33]' />
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-bright/84'>Browser proof</p>
                        <p className='truncate text-xs text-bright/42'>{evidence.title || evidence.url}</p>
                    </div>
                </div>
                <a href={evidence.url} target='_blank' rel='noopener noreferrer' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-bright/52 transition hover:bg-bright/8 hover:text-bright' aria-label='Open browser evidence URL'>
                    <ExternalLink className='h-4 w-4' />
                </a>
            </div>
            <div className='grid gap-2 p-3 text-xs text-bright/62 sm:grid-cols-2'>
                <EvidenceList title='Headings' items={structure.headings} />
                <EvidenceList title='Links' items={(structure.links || []).map((link) => [link.text, link.href].filter(Boolean).join(' -> '))} />
                <EvidenceList title='Buttons' items={structure.buttons} />
                <EvidenceList title='Inputs/forms' items={[...(structure.inputs || []), ...(structure.forms || [])]} />
                <div className='rounded-lg border border-bright/8 bg-black/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-bright/38'>Viewport</p>
                    <p className='mt-1 text-bright/72'>{structure.hasViewportMeta ? 'Viewport meta present' : 'Viewport meta missing or unknown'}</p>
                </div>
                <div className='rounded-lg border border-bright/8 bg-black/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-bright/38'>Screenshot</p>
                    <p className='mt-1 text-bright/72'>{evidence.screenshotPath || 'Screenshot not available yet'}</p>
                </div>
            </div>
            {issues.length ? (
                <div className='border-t border-bright/8 px-3 py-2 text-xs text-red-200/78'>
                    {issues.slice(0, 3).join('\n')}
                </div>
            ) : null}
        </article>
    )
}

function EvidenceList({ title, items }: { title: string, items?: string[] }) {
    const visible = (items || []).filter(Boolean).slice(0, 4)
    return (
        <div className='rounded-lg border border-bright/8 bg-black/16 p-2'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-bright/38'>{title}</p>
            <ul className='mt-1 space-y-0.5 text-bright/72'>
                {visible.length ? visible.map((item) => <li key={item} className='truncate'>{item}</li>) : <li>&lt;none&gt;</li>}
            </ul>
        </div>
    )
}

function emptyBrowserStructure() {
    return {
        headings: [],
        links: [],
        buttons: [],
        inputs: [],
        forms: [],
        hasViewportMeta: false,
    }
}

function summarizeBrowserEvidence(evidence: BrowserEvidence) {
    const structure = evidence.structure || emptyBrowserStructure()
    const issueCount = evidence.pageErrors?.filter(Boolean).length || 0
    return [
        `Browser proof visible for ${evidence.url}.`,
        `Headings: ${structure.headings?.slice(0, 3).join(', ') || '<none>'}.`,
        `Links/buttons/forms: ${(structure.links?.length || 0)}/${(structure.buttons?.length || 0)}/${((structure.inputs?.length || 0) + (structure.forms?.length || 0))}.`,
        `Viewport: ${structure.hasViewportMeta ? 'present' : 'missing/unknown'}. Screenshot: ${evidence.screenshotPath ? 'available' : 'not available yet'}.`,
        issueCount ? `Page issues: ${issueCount}.` : 'Page issues: none.',
    ].join('\n')
}

function formatRunDuration(durationMs: number) {
    const seconds = Math.max(0.1, durationMs / 1000)
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
}

function normalizeSharePath(path: string) {
    return path.replace(/^\/+/, '').trim() || 'index.html'
}

function fileNameFromPath(path: string) {
    return normalizeSharePath(path).split('/').filter(Boolean).pop() || 'index.html'
}

function parentIdForPath(tree: Tree | null, filePath: string) {
    const folders = normalizeSharePath(filePath).split('/').filter(Boolean).slice(0, -1)
    if (!tree || folders.length === 0) {
        return undefined
    }

    function walk(items: Tree, depth: number): string | undefined {
        const name = folders[depth]
        const folder = items.find((item) => item.type === 'folder' && item.name === name)
        if (!folder || folder.type !== 'folder') {
            return undefined
        }
        if (depth === folders.length - 1) {
            return folder.id
        }
        return walk(folder.children, depth + 1)
    }

    return walk(tree, 0)
}

function stripToolTags(content: string) {
    return content.replace(/<hanasand-tool>[\s\S]*?<\/hanasand-tool>/g, '').replace(/\n{3,}/g, '\n\n')
}

function isDeploymentDiagnosticPrompt(prompt: string) {
    return /\b(deploy|deployed|deployment|build|vercel|netlify|env|environment|secret|preview|production|prod|staging|runtime|log|logs|queue|edge|serverless)\b/i.test(prompt)
}

function isCostControlPrompt(prompt: string) {
    return /\b(cost|credit|credits|budget|spend|spent|paid|pricing|limit|limits|usage|retry|retrying|rerun|rerunning|burn|burns|again|fix|fixed|worse|break|broke|broken|restore|revert|minimal|small|smallest|tiny|simple|only|preserve|scope|unrelated|related|file edits|version|versions|rewrite|rewrote|surprise|different site|wrong secret|secrets)\b/i.test(prompt)
}

function isMaintainabilityPrompt(prompt: string) {
    return /\b(maintain|maintainable|maintenance|messy|mess|refactor|technical debt|debt|slow|slower|performance|perf|crawl|bloated|bloat|redundant|css|asset|assets|cms|content management|ownership|own the code|export|lock-in|locked in|platform|vendor|portable|handoff|developer later|edge case|browser|device|mobile safari|checkout|integration|weird bug|scalability|scale)\b/i.test(prompt)
}

function isProgressGovernancePrompt(prompt: string) {
    return /\b(permission|permissions|approve|approval|deny|autopilot|auto.?approve|bypass|waiting|wait|stuck|almost done|no progress|progress|governance|partial|intermediate|logs|stdout|stderr|runtime|stacktrace|console|screenshot|screenshots|observable|proof|claim|claimed|blocked|blocker|meaningful|confirm|confirmation|ask me|question|proceed|validation|fixed|reversible|early abort|abort|progress update|tool call|tool calls|failed tool|timeout|session|sessions|needs action|three days|hours)\b/i.test(prompt)
}

function getComposerHint(prompt: string) {
    const deploymentDiagnostic = isDeploymentDiagnosticPrompt(prompt)
    const costControl = isCostControlPrompt(prompt)
    const maintainability = isMaintainabilityPrompt(prompt)
    const progressGovernance = isProgressGovernancePrompt(prompt)
    const hints = [
        deploymentDiagnostic ? 'Diagnostic mode: collect deploy evidence.' : null,
        costControl ? 'Cost control mode: preserve scope and make the smallest useful edit.' : null,
        maintainability ? 'Maintainability mode: keep code owned, small, fast, and editable.' : null,
        progressGovernance ? 'Progress mode: show blockers, evidence, and meaningful approvals.' : null,
    ].filter(Boolean)
    if (hints.length) {
        return hints.join(' ')
    }
    return null
}

function createOptimisticChatShare(prompt: string): Share {
    const safeId = `unsaved-${randomId()}`
    return {
        id: safeId,
        path: safeId,
        content: '',
        wordCount: prompt.split(/\s+/).filter(Boolean).length,
        estimatedMinutes: 0,
        timestamp: new Date().toISOString(),
        git: null,
        locked: false,
        owner: '',
        parent: '',
        alias: safeId,
    }
}

function summarizePendingChange(change: PendingShareChange) {
    const beforeLines = change.beforeContent ? change.beforeContent.split('\n') : []
    const afterLines = change.content ? change.content.split('\n') : []
    const max = Math.max(beforeLines.length, afterLines.length)
    let added = 0
    let removed = 0
    for (let index = 0; index < max; index += 1) {
        const oldLine = beforeLines[index]
        const newLine = afterLines[index]
        if (oldLine === newLine) {
            continue
        }
        if (typeof oldLine === 'string' && oldLine.length > 0) {
            removed += 1
        }
        if (typeof newLine === 'string' && newLine.length > 0) {
            added += 1
        }
    }
    return {
        action: change.shareId ? 'Update' : 'Create',
        added,
        removed,
        totalLines: afterLines.filter((line) => line.length > 0).length,
        kind: change.created || !change.shareId ? 'New file' : 'Existing file',
    }
}

function buildDiff(before: string, after: string) {
    const beforeLines = before.split('\n')
    const afterLines = after.split('\n')
    const lines: string[] = []
    const max = Math.max(beforeLines.length, afterLines.length)
    for (let index = 0; index < max; index += 1) {
        const oldLine = beforeLines[index]
        const newLine = afterLines[index]
        if (oldLine === newLine) {
            if (typeof newLine === 'string') {
                lines.push(`  ${newLine}`)
            }
            continue
        }
        if (typeof oldLine === 'string') {
            lines.push(`- ${oldLine}`)
        }
        if (typeof newLine === 'string') {
            lines.push(`+ ${newLine}`)
        }
    }
    return lines.slice(0, 260).join('\n') || 'No visible line changes.'
}
