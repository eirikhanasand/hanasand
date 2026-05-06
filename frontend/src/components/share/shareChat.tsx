'use client'

import { aiClientRequest } from '@/utils/ai/client'
import randomId from '@/utils/random/randomId'
import { findTreeFileId, listTreePaths } from '@/components/ai/shareTree'
import { updateShare } from '@/utils/share/put'
import postShare from '@/utils/share/post'
import { ArrowUp, Check, Code2, ExternalLink, Globe2, Loader2, Sparkles } from 'lucide-react'
import { Dispatch, FormEvent, SetStateAction, useMemo, useRef, useState } from 'react'
import ErrorNotice from '@/components/error/errorNotice'

type ShareChatProps = {
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    tree?: Tree | null
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    mode?: 'panel' | 'workspace'
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
    action?: 'update_share' | 'upsert_share' | 'create_share'
    shareId?: string
    path?: string
    content?: string
    type?: 'file' | 'folder'
    actions?: ToolCall[]
}

type BrowserTarget = {
    url: string
    title: string
}

export default function ShareChat({
    share,
    setShare,
    tree,
    editingContent,
    setEditorPatch,
    mode = 'panel',
}: ShareChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null)
    const [browserTarget, setBrowserTarget] = useState<BrowserTarget | null>(null)
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const treePaths = useMemo(() => listTreePaths(tree || null).slice(0, 120), [tree])
    const canSend = input.trim().length > 0 && !loading && Boolean(share)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmed = input.trim()
        if (!trimmed || !share || loading) {
            return
        }

        const userMessage: Message = {
            id: randomId(),
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        }
        setMessages((current) => [...current, userMessage])
        setInput('')
        setLoading(true)

        try {
            const response = await requestShareChat({
                method: 'POST',
                body: JSON.stringify({
                    prompt: buildPrompt(trimmed, share, editingContent, treePaths),
                    context: buildContext(share, editingContent, treePaths, messages),
                    maxTokens: 4200,
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
            const pendingChanges = buildPendingChanges(toolCalls, share, tree || null, editingContent)
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
        } catch {
            setMessages((current) => [...current, {
                id: randomId(),
                role: 'tool',
                content: 'Hanasand AI is reconnecting. Try the same message again in a moment.',
                createdAt: new Date().toISOString(),
            }])
        } finally {
            setLoading(false)
            window.setTimeout(() => inputRef.current?.focus(), 0)
        }
    }

    async function applyPendingEdit() {
        if (!share || !pendingEdit || pendingEdit.status === 'applying') {
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

    return (
        <section className={`flex flex-col overflow-hidden rounded-lg border border-bright/8 bg-black/10 ${
            mode === 'workspace' ? 'h-full min-h-0 shadow-2xl shadow-black/20' : 'h-[calc(100%-3.5rem)] min-h-[32rem]'
        }`}>
            <div className='flex items-center justify-between border-b border-bright/8 px-3 py-2'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-bright/88'>
                        <Sparkles className='h-4 w-4 text-[#ffb15f]' />
                        Chat
                    </div>
                    <p className='truncate text-xs text-bright/45'>{share?.path || 'Waiting for share...'}</p>
                </div>
                <span className='rounded-full border border-bright/10 px-2 py-1 text-[10px] font-medium text-bright/45'>
                    {treePaths.length ? `${treePaths.length} files` : 'Current file'}
                </span>
            </div>

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
                        Thinking
                    </div>
                ) : null}
                {browserTarget ? (
                    <div className='overflow-hidden rounded-2xl border border-bright/10 bg-black/24'>
                        <div className='flex items-center justify-between gap-3 border-b border-bright/8 px-3 py-2'>
                            <div className='flex min-w-0 items-center gap-2'>
                                <Globe2 className='h-4 w-4 shrink-0 text-[#ffb15f]' />
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
            </div>

            {pendingEdit ? (
                <div className='border-t border-bright/8 bg-black/14 p-3'>
                    <div className='mb-2 flex items-center justify-between gap-3'>
                        <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-bright/82'>
                            <Code2 className='h-4 w-4 text-[#ffb15f]' />
                            <span className='truncate'>
                                {pendingEdit.changes.length === 1
                                    ? pendingEdit.changes[0].path
                                    : `${pendingEdit.changes.length} file changes`}
                            </span>
                        </div>
                        <button
                            type='button'
                            disabled={pendingEdit.status === 'applying' || pendingEdit.status === 'applied'}
                            onClick={applyPendingEdit}
                            className='inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-bright/10 px-3 text-xs font-medium text-bright/72 transition hover:bg-bright/8 disabled:cursor-default disabled:opacity-55'
                        >
                            {pendingEdit.status === 'applying' ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Check className='h-3.5 w-3.5' />}
                            {pendingEdit.status === 'applied' ? 'Applied' : 'Apply'}
                        </button>
                    </div>
                    <div className='max-h-56 space-y-2 overflow-auto rounded-lg border border-bright/8 bg-black/24 p-2'>
                        {pendingEdit.changes.map((change) => (
                            <details key={change.id} open={pendingEdit.changes.length === 1} className='rounded-md border border-bright/8 bg-black/18 p-2'>
                                <summary className='cursor-pointer text-xs font-semibold text-bright/72'>
                                    {change.shareId ? 'Update' : 'Create'} {change.path}
                                </summary>
                                <pre className='mt-2 whitespace-pre-wrap text-xs leading-5 text-bright/68'>
                                    {buildDiff(change.beforeContent, change.content)}
                                </pre>
                            </details>
                        ))}
                    </div>
                    {pendingEdit.error ? <ErrorNotice compact className='mt-2' message={pendingEdit.error} /> : null}
                </div>
            ) : null}

            <form onSubmit={submit} className='border-t border-bright/8 p-3'>
                <div className='flex items-end gap-2 rounded-2xl border border-bright/10 bg-bright/[0.045] p-2'>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
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
                        type='submit'
                        disabled={!canSend}
                        aria-label='Send message'
                        className='grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-bright text-background transition hover:bg-bright/88 disabled:cursor-default disabled:opacity-35'
                    >
                        <ArrowUp className='h-4 w-4' />
                    </button>
                </div>
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

function buildPrompt(prompt: string, share: Share, editingContent: string, treePaths: string[]) {
    return [
        'You are Hanasand AI in a browser chat panel for the active /s share.',
        'Help like a coding agent. Be concise. For pure conversation, answer normally.',
        'When the user asks for project changes, return complete replacement content for every changed or new file using Hanasand tool tags.',
        'Tool format:',
        '<hanasand-tool>{"action":"upsert_share","path":"src/app/page.tsx","content":"complete file content"}</hanasand-tool>',
        'You may emit several tool tags in one answer. Do not emit partial diffs. Prefer small, cohesive files over one giant file. Include package/config files when a bot, API, or app needs them.',
        `Current share: ${share.id} (${share.path})`,
        treePaths.length ? `Project files:\n${treePaths.join('\n')}` : null,
        `Current file content:\n${editingContent.slice(0, 22000)}`,
        `User request:\n${prompt}`,
    ].filter(Boolean).join('\n\n')
}

function buildContext(share: Share, editingContent: string, treePaths: string[], messages: Message[]) {
    return JSON.stringify({
        share: { id: share.id, path: share.path, alias: share.alias, parent: share.parent },
        tree: treePaths,
        currentContent: editingContent.slice(0, 22000),
        recentMessages: messages.slice(-8).map(({ role, content }) => ({ role, content })),
    })
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
