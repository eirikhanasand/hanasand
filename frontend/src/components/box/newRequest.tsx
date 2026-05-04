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
import { Bot, Clock3, Play, Plus, Server, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
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

type ResponseTab = 'response' | 'headers' | 'request'

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
    const [response, setResponse] = useState<ToolResponse | null>(null)
    const [loading, setLoading] = useState(false)
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

    const executionMode = share?.alias
        ? 'Share VM'
        : getCookie('access_token')
            ? 'Workspace API'
            : 'Browser mode'

    const send = useCallback(async (e?: MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault()
        const token = getCookie('access_token')
        const id = getCookie('id')

        setLoading(true)

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
                    body: JSON.stringify({ method, url, headers: usableHeaders, body }),
                })
                data = await result.json().catch(() => ({ error: 'Invalid response.' }))
            } else {
                data = await sendFromBrowser({
                    method,
                    url,
                    headers: usableHeaders,
                    body,
                })
            }

            const enrichedResponse = withRequestDetails(data, {
                method,
                url,
                headers: usableHeaders,
                body,
            })

            setResponse(enrichedResponse)
            setResponseTab('response')

            onRequestComplete({
                id: selectedRequestId ?? randomId(),
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
            }, {
                method,
                url,
                headers: usableHeaders,
                body,
            })
            setResponse(enrichedResponse)
            setResponseTab('response')
        } finally {
            setLoading(false)
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

    const responseStatus = response?.status
        ? `${response.status} ${response.statusText || ''}`.trim()
        : response?.error
            ? 'Error'
            : 'Not sent'

    return (
        <div className='grid min-h-0 gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(310px,0.85fr)] lg:items-stretch'>
            <section className='grid min-h-0 gap-3 self-start'>
                <form className='grid gap-2'>
                    <div className='grid gap-2 lg:grid-cols-[84px_minmax(0,1fr)_82px]'>
                        <select value={method} onChange={(e) => setMethod(e.target.value)} className='cursor-pointer rounded-full border border-white/10 bg-white/4 px-3 py-2 text-[11px] font-semibold text-bright outline-none'>
                            {METHODS.map((item) => <option key={item} value={item} className='bg-background'>{item}</option>)}
                        </select>
                        <input
                            ref={inputRef}
                            className='rounded-full border border-white/10 bg-white/4 px-3 py-2 text-sm text-bright outline-none focus:border-orange-300/45'
                            placeholder='https://api.example.com/v1/users'
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />
                        <button onClick={send} disabled={loading} className='flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-orange-300 px-3 py-2 text-[11px] font-semibold text-background hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50'>
                            <Play className='h-3.5 w-3.5' />
                            {loading ? 'Running' : 'Run'}
                        </button>
                    </div>

                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                            {(['headers', 'body', 'ai'] as const).map((item) => (
                                <button key={item} type='button' onClick={() => setTab(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${tab === item ? 'bg-white/12 text-bright' : 'text-bright/50 hover:bg-white/7 hover:text-bright/75'}`}>
                                    {item}
                                </button>
                            ))}
                        </div>
                        <div className='inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] text-bright/55'>
                            <Server className='h-3.5 w-3.5' />
                            {executionMode}
                        </div>
                    </div>
                </form>

                <div className='grid min-h-0 gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                    {tab === 'headers' && (
                        <div className='grid max-h-44 min-h-0 content-start gap-2 overflow-auto pr-1'>
                            {headers.map((header, index) => (
                                <div key={index} className='grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px]'>
                                    <input value={header.key} onChange={(e) => updateHeader(index, 'key', e.target.value)} placeholder='Header' className='rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none' />
                                    <input value={header.value} onChange={(e) => updateHeader(index, 'value', e.target.value)} placeholder='Value' className='rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none' />
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
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='JSON, text or form body' className='min-h-40 rounded-xl border border-white/10 bg-transparent p-4 font-mono text-sm text-bright outline-none' />
                    )}

                    {tab === 'ai' && (
                        <div className='grid min-h-0 gap-3 lg:grid-rows-[auto_auto_minmax(0,1fr)]'>
                            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className='min-h-24 rounded-xl border border-white/10 bg-transparent p-4 text-sm text-bright outline-none' />
                            <button type='button' onClick={askAi} className='flex w-fit cursor-pointer items-center gap-2 rounded-full bg-sky-400/12 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/20'>
                                <Bot className='h-3.5 w-3.5' />
                                Ask AI
                            </button>
                            <pre className='max-h-32 min-h-0 overflow-auto whitespace-pre-wrap rounded-xl bg-black/20 p-4 text-sm text-bright/70'>
                                {aiResponse || 'AI notes will appear here.'}
                            </pre>
                        </div>
                    )}
                </div>
            </section>

            <section className='grid min-h-0 gap-3 self-start rounded-xl border border-white/10 bg-white/[0.035] p-3 lg:grid-rows-[auto_auto_minmax(0,1fr)]'>
                <div className='grid gap-2 sm:grid-cols-3'>
                    <RequestMetricCard
                        label='Status'
                        value={responseStatus}
                        tone={response?.ok ? 'good' : response?.error ? 'bad' : 'neutral'}
                    />
                    <RequestMetricCard label='Source' value={executionMode} tone='neutral' />
                    <RequestMetricCard
                        label='Latency'
                        value={response?.elapsed_ms !== undefined ? `${response.elapsed_ms} ms` : 'Pending'}
                        tone='neutral'
                        icon={<Clock3 className='h-3.5 w-3.5' />}
                    />
                </div>

                <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                    {(['response', 'headers', 'request'] as const).map((item) => (
                        <button key={item} type='button' onClick={() => setResponseTab(item)} className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] capitalize ${responseTab === item ? 'bg-white/12 text-bright' : 'text-bright/50 hover:bg-white/7 hover:text-bright/75'}`}>
                            {item}
                        </button>
                    ))}
                </div>

                <div className='grid min-h-0 overflow-hidden rounded-xl bg-black/20'>
                    {responseTab === 'response' && (
                        <pre className='max-h-72 min-h-44 overflow-auto whitespace-pre-wrap p-4 text-xs text-bright/80'>
                            {response ? response.error || response.body || 'No response body.' : 'Response will appear here.'}
                        </pre>
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
