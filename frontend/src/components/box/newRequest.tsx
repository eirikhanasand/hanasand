import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { Bot, Clock3, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HeaderRow, RequestDraft, RequestHistoryEntry, ToolResponse } from './types'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

type NewRequestProps = {
    initialRequest: RequestDraft
    selectedRequestId?: string | null
    onRequestComplete: (entry: RequestHistoryEntry) => void
}

export default function NewRequest({
    initialRequest,
    selectedRequestId,
    onRequestComplete,
}: NewRequestProps) {
    const [method, setMethod] = useState(initialRequest.method)
    const [url, setUrl] = useState(initialRequest.url)
    const [headers, setHeaders] = useState<HeaderRow[]>(initialRequest.headers.length ? initialRequest.headers : [{ key: '', value: '' }])
    const [body, setBody] = useState(initialRequest.body)
    const [tab, setTab] = useState<'headers' | 'body' | 'ai'>('headers')
    const [response, setResponse] = useState<ToolResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('Explain this response and suggest a next request.')
    const [aiResponse, setAiResponse] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        setMethod(initialRequest.method)
        setUrl(initialRequest.url)
        setHeaders(initialRequest.headers.length ? initialRequest.headers : [{ key: '', value: '' }])
        setBody(initialRequest.body)
        setResponse(null)
        setAiResponse('')
    }, [initialRequest, selectedRequestId])

    const usableHeaders = useMemo(
        () => Object.fromEntries(headers.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])),
        [headers]
    )

    async function send(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e?.preventDefault()
        const token = getCookie('access_token')
        const id = getCookie('id')

        setLoading(true)

        let data: ToolResponse
        if (token && id) {
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

        setResponse(data)
        setLoading(false)

        onRequestComplete({
            id: selectedRequestId ?? randomId(),
            method,
            url,
            headers,
            body,
            createdAt: new Date().toISOString(),
            status: data.status,
            statusText: data.statusText,
            elapsedMs: data.elapsed_ms,
            error: data.error
        })
    }

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

    return (
        <div className='grid h-full min-h-0 gap-3'>
            <form className='grid gap-3'>
                <div className='grid gap-2 lg:grid-cols-[88px_minmax(0,1fr)_78px]'>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className='cursor-pointer rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-[11px] font-semibold text-bright outline-none'>
                        {METHODS.map((item) => <option key={item} value={item} className='bg-background'>{item}</option>)}
                    </select>
                    <input
                        ref={inputRef}
                        className='rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-sm text-bright outline-none focus:border-orange-300/50'
                        placeholder='https://api.example.com/v1/users'
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                    />
                    <button onClick={send} disabled={loading} className='flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-orange-300 px-2.5 py-1.5 text-[11px] font-semibold text-background hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50'>
                        <Play className='h-3.5 w-3.5' />
                        {loading ? 'Sending' : 'Send'}
                    </button>
                </div>

                <div className='flex flex-wrap gap-2 text-xs font-medium text-bright/70'>
                    {(['headers', 'body', 'ai'] as const).map((item) => (
                        <button key={item} type='button' onClick={() => setTab(item)} className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] capitalize ${tab === item ? 'bg-white/12 text-bright' : 'bg-white/5 hover:bg-white/8'}`}>
                            {item}
                        </button>
                    ))}
                </div>
            </form>

            <div className='grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.95fr)]'>
                <section className='grid min-h-0 gap-3'>
                    {tab === 'headers' && (
                        <div className='grid gap-2'>
                            {headers.map((header, index) => (
                                <div key={index} className='grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px]'>
                                    <input value={header.key} onChange={(e) => updateHeader(index, 'key', e.target.value)} placeholder='Header' className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none' />
                                    <input value={header.value} onChange={(e) => updateHeader(index, 'value', e.target.value)} placeholder='Value' className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none' />
                                    <button type='button' onClick={() => setHeaders((prev) => prev.length === 1 ? [{ key: '', value: '' }] : prev.filter((_, rowIndex) => rowIndex !== index))} className='grid cursor-pointer place-items-center rounded-lg bg-red-500/10 text-red-200 hover:bg-red-500/20'>
                                        <Trash2 className='h-4 w-4' />
                                    </button>
                                </div>
                            ))}
                            <button type='button' onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])} className='flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-white/6 px-3 py-1.5 text-[11px] text-bright/70 hover:bg-white/10'>
                                <Plus className='h-3.5 w-3.5' />
                                Add header
                            </button>
                        </div>
                    )}

                    {tab === 'body' && (
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='JSON, text or form body' className='min-h-56 rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-bright outline-none' />
                    )}

                    {tab === 'ai' && (
                        <div className='grid gap-3'>
                            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className='min-h-28 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-bright outline-none' />
                            <button type='button' onClick={askAi} className='flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-sky-400/15 px-3 py-1.5 text-[11px] font-semibold text-sky-100 hover:bg-sky-400/25'>
                                <Bot className='h-3.5 w-3.5' />
                                Ask AI
                            </button>
                            {aiResponse && <pre className='whitespace-pre-wrap rounded-xl bg-white/5 p-4 text-sm text-bright/70'>{aiResponse}</pre>}
                        </div>
                    )}
                </section>

                <section className='grid min-h-0 gap-3 rounded-xl border border-white/10 bg-white/5 p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3 text-xs font-semibold'>
                        <span>Status: <span className={response?.ok ? 'text-emerald-300' : 'text-red-300'}>{response?.status ? `${response.status} ${response.statusText || ''}` : response?.error ? 'Error' : 'Not sent'}</span></span>
                        {!getCookie('access_token') && (
                            <span className='text-[11px] text-bright/45'>Browser mode</span>
                        )}
                        {response?.elapsed_ms !== undefined && <span className='flex items-center gap-1 text-bright/60'><Clock3 className='h-3.5 w-3.5' /> {response.elapsed_ms} ms</span>}
                    </div>
                    <pre className='max-h-92 min-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-bright/70'>
                        {response ? response.error || response.body || JSON.stringify(response, null, 2) : 'Response will appear here.'}
                    </pre>
                </section>
            </div>
        </div>
    )
}

async function sendFromBrowser({
    method,
    url,
    headers,
    body,
}: {
    method: string
    url: string
    headers: Record<string, string>
    body: string
}): Promise<ToolResponse> {
    const normalizedMethod = method.toUpperCase()
    const started = performance.now()

    try {
        const response = await fetch(url, {
            method: normalizedMethod,
            headers,
            body: ['GET', 'HEAD'].includes(normalizedMethod) ? undefined : body,
        })

        const text = await response.text()
        return {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            elapsed_ms: Math.round(performance.now() - started),
            headers: Object.fromEntries(response.headers.entries()),
            body: text,
        }
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
        }
    }
}
