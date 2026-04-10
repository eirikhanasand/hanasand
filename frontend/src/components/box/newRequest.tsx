import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { Bot, Clock3, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type HeaderRow = { key: string, value: string }
type ToolResponse = {
    status?: number
    statusText?: string
    ok?: boolean
    elapsed_ms?: number
    headers?: Record<string, string>
    body?: string
    error?: string
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export default function NewRequest() {
    const [method, setMethod] = useState('GET')
    const [url, setUrl] = useState('https://api.hanasand.com/api/')
    const [headers, setHeaders] = useState<HeaderRow[]>([{ key: '', value: '' }])
    const [body, setBody] = useState('')
    const [tab, setTab] = useState<'headers' | 'body' | 'ai'>('headers')
    const [response, setResponse] = useState<ToolResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('Explain this response and suggest a next request.')
    const [aiResponse, setAiResponse] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)

    const usableHeaders = Object.fromEntries(headers.filter(row => row.key.trim()).map(row => [row.key.trim(), row.value]))

    async function send(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e?.preventDefault()
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setResponse({ error: 'You need to be logged in to use the API workbench.' })
            return
        }

        setLoading(true)
        const result = await fetch(`${config.url.api}/tools/http/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                id,
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ method, url, headers: usableHeaders, body }),
        })
        const data = await result.json().catch(() => ({ error: 'Invalid response.' }))
        setResponse(data)
        setLoading(false)
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
        setHeaders(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
    }

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    return (
        <div className='grid h-full gap-4'>
            <form className='grid gap-3'>
                <div className='grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_120px]'>
                    <select value={method} onChange={e => setMethod(e.target.value)} className='cursor-pointer rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-bright outline-none'>
                        {METHODS.map(item => <option key={item} value={item} className='bg-background'>{item}</option>)}
                    </select>
                    <input
                        ref={inputRef}
                        className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-bright outline-none focus:border-orange-300/50'
                        placeholder='https://api.example.com/v1/users'
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                    />
                    <button onClick={send} disabled={loading} className='flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-orange-300 px-4 py-3 text-sm font-semibold text-background hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50'>
                        <Play className='h-4 w-4' />
                        {loading ? 'Sending' : 'Send'}
                    </button>
                </div>

                <div className='flex flex-wrap gap-2 text-sm font-medium text-bright/70'>
                    {(['headers', 'body', 'ai'] as const).map(item => (
                        <button key={item} type='button' onClick={() => setTab(item)} className={`cursor-pointer rounded-full px-4 py-2 capitalize ${tab === item ? 'bg-white/12 text-bright' : 'bg-white/5 hover:bg-white/8'}`}>
                            {item}
                        </button>
                    ))}
                </div>
            </form>

            {tab === 'headers' && (
                <div className='grid gap-2'>
                    {headers.map((header, index) => (
                        <div key={index} className='grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]'>
                            <input value={header.key} onChange={e => updateHeader(index, 'key', e.target.value)} placeholder='Header' className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none' />
                            <input value={header.value} onChange={e => updateHeader(index, 'value', e.target.value)} placeholder='Value' className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none' />
                            <button type='button' onClick={() => setHeaders(prev => prev.filter((_, rowIndex) => rowIndex !== index))} className='grid cursor-pointer place-items-center rounded-xl bg-red-500/10 text-red-200 hover:bg-red-500/20'>
                                <Trash2 className='h-4 w-4' />
                            </button>
                        </div>
                    ))}
                    <button type='button' onClick={() => setHeaders(prev => [...prev, { key: '', value: '' }])} className='flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-white/6 px-3 py-2 text-sm text-bright/70 hover:bg-white/10'>
                        <Plus className='h-4 w-4' />
                        Add header
                    </button>
                </div>
            )}

            {tab === 'body' && (
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder='JSON, text or form body' className='min-h-52 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-bright outline-none' />
            )}

            {tab === 'ai' && (
                <div className='grid gap-3'>
                    <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className='min-h-28 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-bright outline-none' />
                    <button type='button' onClick={askAi} className='flex w-fit cursor-pointer items-center gap-2 rounded-2xl bg-sky-400/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-400/25'>
                        <Bot className='h-4 w-4' />
                        Ask AI
                    </button>
                    {aiResponse && <pre className='whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm text-bright/70'>{aiResponse}</pre>}
                </div>
            )}

            <section className='grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4'>
                <div className='flex flex-wrap items-center gap-4 text-sm font-semibold'>
                    <span>Status: <span className={response?.ok ? 'text-emerald-300' : 'text-red-300'}>{response?.status ? `${response.status} ${response.statusText || ''}` : response?.error ? 'Error' : 'Not sent'}</span></span>
                    {response?.elapsed_ms !== undefined && <span className='flex items-center gap-1 text-bright/60'><Clock3 className='h-4 w-4' /> {response.elapsed_ms} ms</span>}
                </div>
                <pre className='max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-4 text-xs text-bright/70'>
                    {response ? response.error || response.body || JSON.stringify(response, null, 2) : 'Response will appear here.'}
                </pre>
            </section>
        </div>
    )
}
