import config from '@/config'
import RequestMetricCard from '@/components/box/requestMetricCard'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import {
    formatHeaders,
    formatRequestLine,
    sendFromBrowser,
    sendViaShareVm,
    withRequestDetails,
} from '@/utils/box/requestTool'
import { Bot, Clock3, ImageIcon, Play, Plus, Server, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HeaderRow, RequestDraft, RequestHistoryEntry, ToolResponse } from './types'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

type NewRequestProps = {
    initialRequest: RequestDraft
    selectedRequestId?: string | null
    runToken: number
    onRequestComplete: (entry: RequestHistoryEntry) => void
    share: Share | null
}

type ResponseTab = 'response' | 'preview' | 'headers' | 'request'

type RequestRun = {
    id: string
    method: string
    url: string
    startedAt: string
    loading: boolean
    response: ToolResponse | null
}

export default function NewRequest({
    initialRequest,
    selectedRequestId,
    runToken,
    onRequestComplete,
    share,
}: NewRequestProps) {
    const [method, setMethod] = useState(initialRequest.method)
    const [url, setUrl] = useState(initialRequest.url)
    const [headers, setHeaders] = useState<HeaderRow[]>(initialRequest.headers.length ? initialRequest.headers : [{ key: '', value: '' }])
    const [body, setBody] = useState(initialRequest.body)
    const [tab, setTab] = useState<'headers' | 'body' | 'ai'>('headers')
    const [responseTab, setResponseTab] = useState<ResponseTab>('response')
    const [runs, setRuns] = useState<RequestRun[]>([])
    const [activeRunId, setActiveRunId] = useState<string | null>(null)
    const [aiPrompt, setAiPrompt] = useState('Explain this response and suggest a next request.')
    const [aiResponse, setAiResponse] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)
    const lastRunTokenRef = useRef(runToken)

    useEffect(() => {
        setMethod(initialRequest.method)
        setUrl(initialRequest.url)
        setHeaders(initialRequest.headers.length ? initialRequest.headers : [{ key: '', value: '' }])
        setBody(initialRequest.body)
    }, [initialRequest.body, initialRequest.headers, initialRequest.method, initialRequest.url, selectedRequestId])

    const usableHeaders = useMemo(
        () => Object.fromEntries(headers.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])),
        [headers]
    )

    const activeRun = useMemo(
        () => runs.find((run) => run.id === activeRunId) || runs[0] || null,
        [activeRunId, runs]
    )
    const response = activeRun?.response ?? null
    const hasRunningRequests = runs.some((run) => run.loading)
    const previewUrl = getImagePreviewUrl(response, activeRun?.url || url)

    const executionMode = share?.alias
        ? 'Share VM'
        : getCookie('access_token')
            ? 'Workspace API'
            : 'Browser mode'

    const send = useCallback(async (e?: FormEvent) => {
        e?.preventDefault()
        const token = getCookie('access_token')
        const id = getCookie('id')
        const runId = randomId()
        const request = {
            method,
            url,
            headers: usableHeaders,
            body,
        }
        const startedAt = new Date().toISOString()

        setRuns((current) => [{
            id: runId,
            method,
            url,
            startedAt,
            loading: true,
            response: null,
        }, ...current].slice(0, 8))
        setActiveRunId(runId)
        setResponseTab('response')

        try {
            let data: ToolResponse
            if (share?.alias) {
                data = await sendViaShareVm({
                    shareAlias: share.alias,
                    method,
                    url,
                    headers: usableHeaders,
                    body,
                })
            } else if (token && id) {
                const result = await fetch(`${config.url.api}/tools/http/request`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        id,
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(request),
                })
                data = await result.json().catch(() => ({ error: 'Invalid response.' }))
            } else {
                data = await sendFromBrowser(request)
            }

            const enrichedResponse = withRequestDetails(data, request)

            setRuns((current) => current.map((run) => run.id === runId
                ? { ...run, loading: false, response: enrichedResponse }
                : run))

            onRequestComplete({
                id: selectedRequestId ?? runId,
                method,
                url,
                headers,
                body,
                createdAt: new Date().toISOString(),
                status: enrichedResponse.status,
                statusText: enrichedResponse.statusText,
                elapsedMs: enrichedResponse.elapsed_ms,
                error: enrichedResponse.error,
                requestSource: share?.alias ? 'vm' : 'browser'
            })
        } catch (error) {
            const enrichedResponse = withRequestDetails({
                error: error instanceof Error ? error.message : String(error),
            }, request)
            setRuns((current) => current.map((run) => run.id === runId
                ? { ...run, loading: false, response: enrichedResponse }
                : run))
        }
    }, [body, headers, method, onRequestComplete, selectedRequestId, share?.alias, usableHeaders, url])

    useEffect(() => {
        if (runToken === lastRunTokenRef.current) {
            return
        }
        lastRunTokenRef.current = runToken
        void send()
    }, [runToken, send])

    async function askAi() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return setAiResponse('Login required.')
        }

        const result = await fetch(`${config.url.api}/tools/ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                id,
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ prompt: aiPrompt, context: JSON.stringify(response ?? {}) }),
        })
        const data = await result.json().catch(() => ({}))
        setAiResponse(data.message || data.suggestion || data.error || 'No AI response.')
    }

    function updateHeader(index: number, field: keyof HeaderRow, value: string) {
        setHeaders((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
    }

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const responseStatus = activeRun?.loading
        ? 'Running'
        : response?.status
            ? `${response.status} ${response.statusText || ''}`.trim()
            : response?.error
                ? 'Error'
                : 'Not sent'

    return (
        <div className='grid min-h-0 gap-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.78fr)] xl:items-stretch'>
            <section className='grid min-h-0 gap-2 self-start'>
                <form onSubmit={send} className='grid gap-2 rounded-lg border border-bright/8 bg-black/12 p-2'>
                    <div className='grid gap-2 lg:grid-cols-[78px_minmax(0,1fr)_84px]'>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className='cursor-pointer rounded-full border border-bright/10 bg-white/[0.045] px-3 py-2 text-[11px] font-semibold text-bright outline-none'>
                            {METHODS.map((item) => <option key={item} value={item} className='bg-background'>{item}</option>)}
                        </select>
                        <input
                            ref={inputRef}
                            className='min-w-0 rounded-full border border-bright/10 bg-white/[0.045] px-3 py-2 text-sm text-bright outline-none focus:border-orange-300/45'
                            placeholder='https://api.example.com/v1/users'
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />
                        <button type='submit' className='flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-orange-300 px-3 py-2 text-[11px] font-semibold text-background hover:bg-orange-200'>
                            <Play className='h-3.5 w-3.5' />
                            Run
                        </button>
                    </div>

                    <div className='flex flex-wrap items-center justify-between gap-2 px-1'>
                        <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                            {(['headers', 'body', 'ai'] as const).map((item) => (
                                <button key={item} type='button' onClick={() => setTab(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${tab === item ? 'bg-white/12 text-bright' : 'text-bright/50 hover:bg-white/7 hover:text-bright/75'}`}>
                                    {item}
                                </button>
                            ))}
                        </div>
                        <div className='inline-flex items-center gap-2 rounded-full border border-bright/10 px-3 py-1 text-[11px] text-bright/55'>
                            <Server className='h-3.5 w-3.5' />
                            {hasRunningRequests ? 'Running requests' : executionMode}
                        </div>
                    </div>
                </form>

                <div className='grid min-h-0 gap-3 overflow-hidden rounded-lg border border-bright/8 bg-black/12 p-2'>
                    {tab === 'headers' && (
                        <div className='grid max-h-40 min-h-0 content-start gap-2 overflow-auto pr-1'>
                            {headers.map((header, index) => (
                                <div key={index} className='grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px]'>
                                    <input value={header.key} onChange={(e) => updateHeader(index, 'key', e.target.value)} placeholder='Header' className='min-w-0 rounded-lg border border-bright/10 bg-white/[0.025] px-3 py-2 text-sm outline-none' />
                                    <input value={header.value} onChange={(e) => updateHeader(index, 'value', e.target.value)} placeholder='Value' className='min-w-0 rounded-lg border border-bright/10 bg-white/[0.025] px-3 py-2 text-sm outline-none' />
                                    <button type='button' onClick={() => setHeaders((prev) => prev.length === 1 ? [{ key: '', value: '' }] : prev.filter((_, rowIndex) => rowIndex !== index))} className='grid cursor-pointer place-items-center rounded-lg text-red-200/70 hover:bg-red-500/10 hover:text-red-100'>
                                        <Trash2 className='h-4 w-4' />
                                    </button>
                                </div>
                            ))}
                            <button type='button' onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])} className='flex w-fit cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-bright/60 hover:bg-white/8 hover:text-bright/80'>
                                <Plus className='h-3.5 w-3.5' />
                                Add header
                            </button>
                        </div>
                    )}

                    {tab === 'body' && (
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='JSON, text or form body' className='min-h-40 rounded-lg border border-bright/10 bg-white/[0.025] p-3 font-mono text-sm text-bright outline-none' />
                    )}

                    {tab === 'ai' && (
                        <div className='grid min-h-0 gap-3 lg:grid-rows-[auto_auto_minmax(0,1fr)]'>
                            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className='min-h-24 rounded-lg border border-bright/10 bg-white/[0.025] p-3 text-sm text-bright outline-none' />
                            <button type='button' onClick={askAi} className='flex w-fit cursor-pointer items-center gap-2 rounded-full bg-sky-400/12 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/20'>
                                <Bot className='h-3.5 w-3.5' />
                                Ask AI
                            </button>
                            <pre className='max-h-32 min-h-0 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-sm text-bright/70'>
                                {aiResponse || 'AI notes will appear here.'}
                            </pre>
                        </div>
                    )}
                </div>
            </section>

            <section className='grid min-h-0 gap-2 self-start rounded-lg border border-bright/8 bg-black/12 p-2 xl:grid-rows-[auto_auto_auto_minmax(0,1fr)]'>
                <div className='grid gap-2 sm:grid-cols-3'>
                    <RequestMetricCard
                        label='Status'
                        value={responseStatus}
                        tone={response?.ok ? 'good' : response?.error ? 'bad' : 'neutral'}
                    />
                    <RequestMetricCard label='Source' value={executionMode} tone='neutral' />
                    <RequestMetricCard
                        label='Latency'
                        value={response?.elapsed_ms !== undefined ? `${response.elapsed_ms} ms` : activeRun?.loading ? 'Running' : 'Pending'}
                        tone='neutral'
                        icon={<Clock3 className='h-3.5 w-3.5' />}
                    />
                </div>

                <div className='flex max-w-full gap-1.5 overflow-x-auto'>
                    {runs.length ? runs.map((run) => (
                        <button
                            key={run.id}
                            type='button'
                            onClick={() => setActiveRunId(run.id)}
                            className={`grid w-40 shrink-0 gap-1 rounded-lg border px-2.5 py-2 text-left transition ${activeRun?.id === run.id ? 'border-orange-300/35 bg-orange-300/8' : 'border-white/8 bg-white/3 hover:bg-white/6'}`}
                        >
                            <span className='flex min-w-0 items-center gap-2 text-[11px] text-bright/78'>
                                <span className='font-semibold'>{run.method}</span>
                                <span className='truncate'>{run.url}</span>
                            </span>
                            <span className='text-[10px] text-bright/45'>{run.loading ? 'Running' : run.response?.status || run.response?.error || 'Done'}</span>
                        </button>
                    )) : (
                        <div className='rounded-lg border border-dashed border-bright/10 px-3 py-2 text-xs text-bright/45'>
                            Run a request to inspect the response.
                        </div>
                    )}
                </div>

                <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                    {(['response', 'preview', 'headers', 'request'] as const).map((item) => (
                        <button key={item} type='button' onClick={() => setResponseTab(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${responseTab === item ? 'bg-white/12 text-bright' : 'text-bright/50 hover:bg-white/7 hover:text-bright/75'}`}>
                            {item === 'preview' ? <span className='inline-flex items-center gap-1'><ImageIcon className='h-3 w-3' /> Preview</span> : item}
                        </button>
                    ))}
                </div>

                <div className='grid min-h-0 overflow-hidden rounded-lg bg-black/22'>
                    {responseTab === 'response' && (
                        <pre className='max-h-72 min-h-44 overflow-auto whitespace-pre-wrap p-4 text-xs text-bright/80'>
                            {activeRun?.loading ? 'Request is running...' : response ? response.error || response.body || 'No response body.' : 'Response will appear here.'}
                        </pre>
                    )}

                    {responseTab === 'preview' && (
                        <div className='grid max-h-72 min-h-44 place-items-center overflow-auto p-4 text-xs text-bright/55'>
                            {previewUrl ? (
                                <img src={previewUrl} alt='Response preview' className='max-h-64 max-w-full rounded-lg object-contain' />
                            ) : 'Image previews appear for image URLs or image responses.'}
                        </div>
                    )}

                    {responseTab === 'headers' && (
                        <pre className='max-h-72 min-h-44 overflow-auto whitespace-pre-wrap p-4 text-xs text-bright/75'>
                            {response?.headers ? formatHeaders(response.headers) : 'Response headers will appear here.'}
                        </pre>
                    )}

                    {responseTab === 'request' && (
                        <div className='grid max-h-72 min-h-44 gap-4 overflow-auto p-4 text-xs text-bright/80'>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request line</span>
                                <pre className='whitespace-pre-wrap rounded-lg bg-white/5 p-3'>{formatRequestLine(response?.request)}</pre>
                            </div>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request headers</span>
                                <pre className='whitespace-pre-wrap rounded-lg bg-white/5 p-3'>{formatHeaders(response?.request?.headers)}</pre>
                            </div>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request body</span>
                                <pre className='whitespace-pre-wrap rounded-lg bg-white/5 p-3'>{response?.request?.body || 'No request body.'}</pre>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

function getImagePreviewUrl(response: ToolResponse | null, requestUrl: string) {
    const contentType = Object.entries(response?.headers || {})
        .find(([key]) => key.toLowerCase() === 'content-type')?.[1] || ''

    if (contentType.toLowerCase().startsWith('image/')) {
        return requestUrl
    }

    if (isImageUrl(requestUrl)) {
        return requestUrl
    }

    const body = response?.body?.trim()
    if (body && isImageUrl(body)) {
        return body
    }

    return null
}

function isImageUrl(value: string) {
    try {
        const url = new URL(value)
        return /\.(apng|avif|gif|jpe?g|png|svg|webp)(?:$|\?)/i.test(url.pathname + url.search)
    } catch {
        return false
    }
}
