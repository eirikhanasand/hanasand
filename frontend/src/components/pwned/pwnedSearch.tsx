import { useEffect, useRef, useState } from 'react'
import randomId from '../../utils/random/randomId'
import config from '@/config'
import Marquee from '../marquee/marquee'
import { CheckCircle2, FileText, LoaderCircle, ShieldAlert } from 'lucide-react'

type PwnedSearchProps = {
    breached: boolean
    breachCount: number | null
    password: string
}

type BreachMessage = {
    type: 'update'
    timestamp: string
    ok?: boolean
    file?: string
    line?: number
    offset?: number
    source?: string
    done?: boolean
}

type BreachFile = {
    file: string
    line?: number
    offset?: number
    source?: string
}

export default function PwnedSearch({ breached, breachCount, password }: PwnedSearchProps) {
    const [id, setId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const ref = useRef<HTMLDivElement | null>(null)
    const [breachFiles, setBreachFiles] = useState<BreachFile[]>([])
    const uniqueBreachFiles = Array.from(
        new Map(breachFiles.map(b => [`${b.file}:${b.line ?? ''}:${b.offset ?? ''}`, b])).values()
    )

    useEffect(() => {
        setId(randomId())
    }, [])

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_wss}/pwned/${randomId()}`)

        ws.onopen = () => {
            setLoading(true)
            ws.send(JSON.stringify({ password }))
        }

        ws.onclose = () => {
            setLoading(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
        }

        ws.onmessage = async (event) => {
            try {
                let data: string

                if (event.data instanceof Blob) {
                    data = await event.data.text()
                } else {
                    data = event.data as string
                }

                const msg = JSON.parse(data) as BreachMessage
                if (msg) {
                    if (msg.done) {
                        setLoading(false)
                    }

                    if (msg.file) {
                        setBreachFiles(prev => [...prev, {
                            file: msg.file!,
                            line: msg.line,
                            offset: msg.offset,
                            source: msg.source
                        }])
                    }
                }
            } catch (error) {
                console.error(`Invalid message from server: ${error}`)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, password])

    const suffix = uniqueBreachFiles.length > 0
        ? `and exists in the following ${uniqueBreachFiles.length} files.`
        : `but the ${breachCount === 1 ? 'dataset is' : 'datasets are'} currently not publicly available.`

    const text = uniqueBreachFiles.length === 0 && loading
        ? 'Searching indexed files...'
        : uniqueBreachFiles.length === 1
            ? `Found in ${formatBreachLocation(uniqueBreachFiles[0])}.`
            : `Found ${breachCount} ${breachCount === 1 ? 'time' : 'times'}, ${suffix}`

    return (
        <div className='grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
            {breached ? (
                <div className='relative grid gap-3'>
                    <div className='flex items-start gap-3 rounded-lg border border-red-400/15 bg-red-500/8 p-3 text-sm text-red-100'>
                        <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-red-300' />
                        <p className='min-w-0 leading-6'>{text}</p>
                    </div>
                    {uniqueBreachFiles.length > 0 && (
                        <div className='grid max-h-60 gap-1 overflow-auto rounded-lg border border-white/10 bg-black/12 p-2'>
                            <div className='grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 px-2 py-1 text-xs font-medium uppercase tracking-[0.16em] text-bright/34'>
                                <span>File</span>
                                <span className='text-right'>Line</span>
                            </div>
                            <div className='grid gap-1'>
                                {uniqueBreachFiles.map((breach) => (<div key={`${breach.file}:${breach.line ?? ''}:${breach.offset ?? ''}`} className='grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2 rounded-md bg-white/[0.035] px-2 py-2 text-sm'>
                                    <div className='flex min-w-0 items-center gap-2 text-bright/72'>
                                        <FileText className='h-4 w-4 shrink-0 text-bright/35' />
                                        <Marquee className='min-w-0 truncate' innerClassName='text-bright/72 text-sm break-all' text={breach.file} />
                                    </div>
                                    <span className='text-right font-mono text-xs text-bright/55'>
                                        {formatBreachLine(breach)}
                                    </span>
                                </div>))}
                            </div>
                        </div>
                    )}
                    <div ref={ref} className='min-w-full grid place-items-center'>
                        {loading && (
                            <div key={ref.current?.offsetWidth} className='flex items-center gap-2 text-xs text-bright/38'>
                                <LoaderCircle className='h-3.5 w-3.5 animate-spin' />
                                Checking detailed file matches
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className='flex items-start gap-3 rounded-lg border border-emerald-400/15 bg-emerald-500/8 p-3 text-sm text-emerald-100'>
                    <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-emerald-300' />
                    <p className='leading-6'>No exact matches found in the indexed breach data.</p>
                </div>
            )}
        </div>
    )
}

function formatBreachLocation(breach: BreachFile) {
    const line = breach.line ? `:${breach.line}` : ''
    const offset = !breach.line && typeof breach.offset === 'number' ? ` byte ${breach.offset}` : ''
    return `${breach.file}${line}${offset}`
}

function formatBreachLine(breach: BreachFile) {
    if (breach.line) {
        return breach.line
    }

    if (typeof breach.offset === 'number') {
        return `byte ${breach.offset}`
    }

    return breach.source ?? 'found'
}
