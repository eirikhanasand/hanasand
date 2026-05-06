'use client'

import { aiClientRequest } from '@/utils/ai/client'
import randomId from '@/utils/random/randomId'
import { findTreeFileId, listTreePaths } from '@/components/ai/shareTree'
import { updateShare } from '@/utils/share/put'
import { ArrowUp, Check, Code2, Loader2, Sparkles } from 'lucide-react'
import { Dispatch, FormEvent, SetStateAction, useMemo, useRef, useState } from 'react'

type ShareChatProps = {
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    tree?: Tree | null
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
}

type Message = {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    createdAt: string
}

type PendingEdit = {
    id: string
    shareId: string
    path: string
    beforeContent: string
    content: string
    status: 'pending' | 'applying' | 'applied' | 'error'
    error?: string
}

type ToolCall = {
    action?: string
    shareId?: string
    path?: string
    content?: string
}

export default function ShareChat({
    share,
    setShare,
    tree,
    editingContent,
    setEditorPatch,
}: ShareChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null)
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
            const response = await aiClientRequest('/tools/ai', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: buildPrompt(trimmed, share, editingContent, treePaths),
                    context: buildContext(share, editingContent, treePaths, messages),
                    maxTokens: 4200,
                }),
            })
            const data = await response.json().catch(() => ({}))
            const rawContent = data.message || data.suggestion || data.error || 'No response.'
            const toolCalls = parseToolCalls(rawContent)
            const nextEdit = toolCalls.find((call) => call.action === 'update_share' && call.content)
            const visibleContent = stripToolTags(rawContent).trim() || (nextEdit ? 'Prepared a change.' : rawContent)

            setMessages((current) => [...current, {
                id: randomId(),
                role: response.ok ? 'assistant' : 'tool',
                content: visibleContent,
                createdAt: new Date().toISOString(),
            }])

            if (nextEdit?.content) {
                const targetShareId = nextEdit.shareId || (nextEdit.path ? findTreeFileId(tree || null, nextEdit.path) : null) || share.id
                setPendingEdit({
                    id: randomId(),
                    shareId: targetShareId,
                    path: nextEdit.path || share.path,
                    beforeContent: targetShareId === share.id ? editingContent : '',
                    content: nextEdit.content,
                    status: 'pending',
                })
            }
        } catch (error) {
            setMessages((current) => [...current, {
                id: randomId(),
                role: 'tool',
                content: error instanceof Error ? error.message : 'The chat request failed.',
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
        const updated = await updateShare(pendingEdit.shareId, {
            content: pendingEdit.content,
            path: pendingEdit.path,
        })
        if (!updated) {
            setPendingEdit((current) => current ? { ...current, status: 'error', error: 'Unable to update the share.' } : current)
            return
        }

        if (pendingEdit.shareId === share.id) {
            setShare(updated)
            setEditorPatch({ value: updated.content, nonce: Date.now() })
        }
        setPendingEdit((current) => current ? { ...current, status: 'applied' } : current)
        setMessages((current) => [...current, {
            id: randomId(),
            role: 'tool',
            content: `Applied ${updated.path || pendingEdit.path}.`,
            createdAt: new Date().toISOString(),
        }])
    }

    return (
        <section className='flex h-[calc(100%-3.5rem)] min-h-[32rem] flex-col overflow-hidden rounded-lg border border-bright/8 bg-black/10'>
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

            <div className='flex-1 space-y-3 overflow-y-auto px-3 py-4'>
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
            </div>

            {pendingEdit ? (
                <div className='border-t border-bright/8 bg-black/14 p-3'>
                    <div className='mb-2 flex items-center justify-between gap-3'>
                        <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-bright/82'>
                            <Code2 className='h-4 w-4 text-[#ffb15f]' />
                            <span className='truncate'>{pendingEdit.path}</span>
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
                    <pre className='max-h-44 overflow-auto rounded-lg border border-bright/8 bg-black/24 p-2 text-xs leading-5 text-bright/68'>
                        {buildDiff(pendingEdit.beforeContent, pendingEdit.content)}
                    </pre>
                    {pendingEdit.error ? <p className='mt-2 text-xs text-red-300'>{pendingEdit.error}</p> : null}
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

function buildPrompt(prompt: string, share: Share, editingContent: string, treePaths: string[]) {
    return [
        'You are Hanasand AI in a browser chat panel for the active /s share.',
        'Help like a coding agent. Be concise. When the user asks for an edit, return the complete updated file using exactly one update_share tool tag.',
        'Tool format:',
        '<hanasand-tool>{"action":"update_share","path":"current path","content":"complete updated file content"}</hanasand-tool>',
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
            return [JSON.parse(match[1]) as ToolCall]
        } catch {
            return []
        }
    })
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
