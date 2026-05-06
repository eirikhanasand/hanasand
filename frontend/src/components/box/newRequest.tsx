import config from '@/config'
import RequestMetricCard from '@/components/box/requestMetricCard'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import {
    formatHeaders,
    formatRequestLine,
    normalizeRequestHeaders,
    sendFromBrowser,
    sendViaShareVm,
    withRequestDetails,
} from '@/utils/box/requestTool'
import { Bot, ChevronDown, Clock3, ImageIcon, Play, Plus, Server, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HeaderRow, RequestDraft, RequestHistoryEntry, ToolResponse } from './types'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'])

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
    const [headers, setHeaders] = useState<HeaderRow[]>(normalizeHeaderRows(initialRequest.headers))
    const [body, setBody] = useState(initialRequest.body)
    const [tab, setTab] = useState<'headers' | 'body' | 'ai'>('headers')
    const [responseTab, setResponseTab] = useState<ResponseTab>('response')
    const [runs, setRuns] = useState<RequestRun[]>([])
    const [activeRunId, setActiveRunId] = useState<string | null>(null)
    const [aiPrompt, setAiPrompt] = useState('Explain this response and suggest a next request.')
    const [aiResponse, setAiResponse] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const lastRunTokenRef = useRef(runToken)

    useEffect(() => {
        setMethod(initialRequest.method)
        setUrl(initialRequest.url)
        setHeaders(normalizeHeaderRows(initialRequest.headers))
        setBody(initialRequest.body)
    }, [initialRequest.body, initialRequest.headers, initialRequest.method, initialRequest.url, selectedRequestId])

    const normalizedHeaders = useMemo(() => normalizeHeaderRows(headers), [headers])
    const headerPlan = useMemo(() => normalizeRequestHeaders(buildRequestHeaders(normalizedHeaders)), [normalizedHeaders])
    const usableHeaders = headerPlan.headers

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

            const enrichedResponse = sanitizeToolResponse(withRequestDetails({
                ...data,
                warnings: [...headerPlan.warnings, ...(data.warnings || [])],
            }, request))

            setRuns((current) => current.map((run) => run.id === runId
                ? { ...run, loading: false, response: enrichedResponse }
                : run))

            onRequestComplete({
                id: selectedRequestId ?? runId,
                method,
                url,
                headers: normalizedHeaders,
                body,
                createdAt: new Date().toISOString(),
                status: enrichedResponse.status,
                statusText: enrichedResponse.statusText,
                elapsedMs: enrichedResponse.elapsed_ms,
                error: enrichedResponse.error,
                requestSource: share?.alias ? 'vm' : 'browser',
            })
        } catch (error) {
            const enrichedResponse = sanitizeToolResponse(withRequestDetails({
                error: error instanceof Error ? error.message : String(error),
            }, request))
            setRuns((current) => current.map((run) => run.id === runId
                ? { ...run, loading: false, response: enrichedResponse }
                : run))
        }
    }, [body, headerPlan.warnings, method, normalizedHeaders, onRequestComplete, selectedRequestId, share?.alias, usableHeaders, url])

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

        setAiLoading(true)
        setAiResponse('')
        try {
            const context = {
                activeRequest: {
                    method,
                    url,
                    headers: usableHeaders,
                    body,
                    warnings: headerPlan.warnings,
                },
                response: response ?? null,
                recentRuns: runs.slice(0, 4).map((run) => ({
                    method: run.method,
                    url: run.url,
                    loading: run.loading,
                    status: run.response?.status,
                    statusText: run.response?.statusText,
                    error: run.response?.error,
                    warnings: run.response?.warnings,
                })),
            }
            const result = await fetch(`${config.url.api}/tools/ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    id,
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    prompt: [
                        aiPrompt,
                        'Use the request context below. Explain what happened in plain language, suggest the next request or UI action, and call out likely tool issues separately from target-service issues.',
                    ].join('\n\n'),
                    context: JSON.stringify(context, null, 2),
                    maxTokens: 1200,
                }),
            })
            const data = await result.json().catch(() => ({}))
            setAiResponse(redactSensitiveText(data.message || data.suggestion || data.error || 'No AI response.'))
        } catch (error) {
            setAiResponse(error instanceof Error ? error.message : String(error))
        } finally {
            setAiLoading(false)
        }
    }

    function updateHeader(index: number, field: keyof HeaderRow, value: string) {
        setHeaders((prev) => normalizeHeaderRows(prev).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
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
        <div className='grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 overflow-hidden'>
            <form onSubmit={send} className='grid gap-2 rounded-lg border border-bright/8 bg-black/12 p-2'>
                <div className='grid gap-2 md:grid-cols-[86px_minmax(0,1fr)_74px]'>
                    <label className='relative min-w-0'>
                        <span className='sr-only'>Method</span>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className='h-10 w-full cursor-pointer appearance-none rounded-full border border-bright/10 bg-white/[0.045] px-3 pr-8 text-xs font-semibold text-bright outline-none focus:border-orange-300/45'>
                            {METHODS.map((item) => <option key={item} value={item} className='bg-background'>{item}</option>)}
                        </select>
                        <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bright/45' />
                    </label>
                    <input
                        ref={inputRef}
                        className='h-10 min-w-0 rounded-full border border-bright/10 bg-white/[0.045] px-3 text-sm text-bright outline-none focus:border-orange-300/45'
                        placeholder='https://api.example.com/v1/users'
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                    />
                    <button type='submit' className='flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-orange-300 px-3 text-[11px] font-semibold text-background hover:bg-orange-200'>
                        <Play className='h-3.5 w-3.5' />
                        Run
                    </button>
                </div>

                <div className='min-w-0 rounded-lg border border-bright/8 bg-black/18 px-3 py-2 font-mono text-[11px] leading-4 text-bright/60'>
                    <span className='mr-2 text-bright/32'>{method}</span>
                    <span className='break-all'>{url || 'Enter a request URL.'}</span>
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

            <section className='grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-lg border border-bright/8 bg-black/12 p-2'>
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

                <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                    {(['response', 'preview', 'headers', 'request'] as const).map((item) => (
                        <button key={item} type='button' onClick={() => setResponseTab(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${responseTab === item ? 'bg-white/12 text-bright' : 'text-bright/50 hover:bg-white/7 hover:text-bright/75'}`}>
                            {item === 'preview' ? <span className='inline-flex items-center gap-1'><ImageIcon className='h-3 w-3' /> Preview</span> : item}
                        </button>
                    ))}
                </div>

                <div className='grid min-h-0 overflow-hidden rounded-lg bg-black/22'>
                    {responseTab === 'response' && (
                        <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-bright/80'>
                            {activeRun?.loading ? 'Request is running...' : response ? formatResponseBody(response) : 'Response will appear here.'}
                        </pre>
                    )}

                    {responseTab === 'preview' && (
                        <div className='grid min-h-32 place-items-center overflow-auto p-4 text-xs text-bright/55'>
                            {previewUrl ? (
                                <img src={previewUrl} alt='Response preview' className='max-h-64 max-w-full rounded-lg object-contain' />
                            ) : 'Image previews appear for image URLs or image responses.'}
                        </div>
                    )}

                    {responseTab === 'headers' && (
                        <pre className='min-h-32 overflow-auto whitespace-pre-wrap wrap-break-word p-4 text-xs leading-5 text-bright/75'>
                            {response?.headers ? formatHeaders(response.headers) : 'Response headers will appear here.'}
                        </pre>
                    )}

                    {responseTab === 'request' && (
                        <div className='grid min-h-32 gap-3 overflow-auto p-4 text-xs text-bright/80'>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request line</span>
                                <pre className='whitespace-pre-wrap wrap-break-word rounded-lg bg-white/5 p-3'>{formatRequestLine(response?.request)}</pre>
                            </div>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request headers</span>
                                <pre className='whitespace-pre-wrap wrap-break-word rounded-lg bg-white/5 p-3'>{formatHeaders(response?.request?.headers)}</pre>
                            </div>
                            <div className='grid gap-1'>
                                <span className='text-[11px] uppercase tracking-[0.24em] text-bright/40'>Request body</span>
                                <pre className='whitespace-pre-wrap wrap-break-word rounded-lg bg-white/5 p-3'>{response?.request?.body || 'No request body.'}</pre>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className='grid min-h-0 gap-2 overflow-hidden rounded-lg border border-bright/8 bg-black/12 p-2'>
                {tab === 'headers' && (
                    <div className='grid max-h-40 min-h-0 content-start gap-2 overflow-auto pr-1'>
                        {normalizedHeaders.map((header, index) => (
                            <div key={index} className='grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px]'>
                                <input value={header.key} onChange={(e) => updateHeader(index, 'key', e.target.value)} placeholder='Header' className='min-w-0 rounded-lg border border-bright/10 bg-white/[0.025] px-3 py-2 text-sm outline-none' />
                                <input value={header.value} onChange={(e) => updateHeader(index, 'value', e.target.value)} placeholder='Value' className='min-w-0 rounded-lg border border-bright/10 bg-white/[0.025] px-3 py-2 text-sm outline-none' />
                                <button type='button' onClick={() => setHeaders((prev) => normalizeHeaderRows(prev).length === 1 ? [{ key: '', value: '' }] : normalizeHeaderRows(prev).filter((_, rowIndex) => rowIndex !== index))} className='grid cursor-pointer place-items-center rounded-lg text-red-200/70 hover:bg-red-500/10 hover:text-red-100'>
                                    <Trash2 className='h-4 w-4' />
                                </button>
                            </div>
                        ))}
                        <button type='button' onClick={() => setHeaders((prev) => [...normalizeHeaderRows(prev), { key: '', value: '' }])} className='flex w-fit cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-bright/60 hover:bg-white/8 hover:text-bright/80'>
                            <Plus className='h-3.5 w-3.5' />
                            Add header
                        </button>
                    </div>
                )}

                {tab === 'body' && (
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='JSON, text or form body' className='min-h-32 rounded-lg border border-bright/10 bg-white/[0.025] p-3 font-mono text-sm text-bright outline-none' />
                )}

                {tab === 'ai' && (
                    <div className='grid min-h-0 gap-3 lg:grid-rows-[auto_auto_minmax(0,1fr)]'>
                        <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className='min-h-24 rounded-lg border border-bright/10 bg-white/[0.025] p-3 text-sm text-bright outline-none' />
                        <button type='button' onClick={askAi} disabled={aiLoading} className='flex w-fit cursor-pointer items-center gap-2 rounded-full bg-sky-400/12 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60'>
                            <Bot className='h-3.5 w-3.5' />
                            {aiLoading ? 'Asking...' : 'Ask AI'}
                        </button>
                        <pre className='max-h-32 min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-black/20 p-3 text-sm text-bright/70'>
                            {aiLoading ? 'Thinking through the request and response...' : aiResponse || 'AI notes will appear here.'}
                        </pre>
                    </div>
                )}
            </section>

            <div className='flex max-w-full gap-1.5 overflow-x-auto rounded-lg border border-bright/8 bg-black/12 p-2'>
                {runs.length ? runs.map((run) => (
                    <button
                        key={run.id}
                        type='button'
                        onClick={() => setActiveRunId(run.id)}
                        className={`grid w-40 shrink-0 gap-1 rounded-lg border px-2.5 py-2 text-left transition ${activeRun?.id === run.id ? 'border-orange-300/35 bg-orange-300/8' : 'border-white/8 bg-white/3 hover:bg-white/6'}`}
                    >
                        <span className='flex min-w-0 items-center gap-2 text-[11px] text-bright/78'>
                            <span className='font-semibold'>{run.method}</span>
                            <span className='truncate' title={run.url}>{shortUrlLabel(run.url)}</span>
                        </span>
                        <span className='truncate text-[10px] text-bright/45'>{run.loading ? 'Running' : run.response?.status || (run.response?.error ? 'Error' : 'Done')}</span>
                    </button>
                )) : (
                    <div className='rounded-lg border border-dashed border-bright/10 px-3 py-2 text-xs text-bright/45'>
                        Run a request to inspect the response.
                    </div>
                )}
            </div>
        </div>
    )
}

function normalizeHeaderRows(value: unknown): HeaderRow[] {
    if (!Array.isArray(value)) {
        return [{ key: '', value: '' }]
    }

    const rows = value.flatMap((row): HeaderRow[] => {
        if (!row || typeof row !== 'object') {
            return []
        }

        const item = row as Partial<HeaderRow>
        if (typeof item.key !== 'string') {
            return []
        }

        return [{
            key: item.key,
            value: typeof item.value === 'string' ? item.value : '',
        }]
    })

    return rows.length ? rows : [{ key: '', value: '' }]
}

function buildRequestHeaders(rows: HeaderRow[]) {
    return Object.fromEntries(
        rows
            .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
            .filter((row) => row.key && row.value)
            .map((row) => [row.key, row.value])
    )
}

function sanitizeToolResponse(response: ToolResponse): ToolResponse {
    const request = response.request
        ? {
            ...response.request,
            headers: redactHeaders(response.request.headers) ?? {},
        }
        : undefined

    return {
        ...response,
        error: response.error ? redactSensitiveText(response.error) : undefined,
        body: response.body ? redactSensitiveText(response.body) : response.body,
        raw: response.raw ? redactSensitiveText(response.raw) : response.raw,
        headers: response.headers ? redactHeaders(response.headers) : response.headers,
        request,
    }
}

function redactHeaders(headers?: Record<string, string>) {
    if (!headers) {
        return headers
    }

    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
            key,
            SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? '[redacted]' : redactSensitiveText(value),
        ])
    )
}

function redactSensitiveText(value: string) {
    return value.replace(/\bBearer\s+[^'\s]+/gi, 'Bearer [redacted]')
}

function formatResponseBody(response: ToolResponse) {
    const warnings = response.warnings?.length
        ? `Warnings:\n${response.warnings.join('\n')}\n\n`
        : ''

    if (response.error) {
        return `${warnings}${response.error}`
    }

    return `${warnings}${response.body || 'No response body.'}`
}

function shortUrlLabel(value: string) {
    try {
        const url = new URL(value)
        return `${url.host}${url.pathname}${url.search}`
    } catch {
        return value
    }
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
