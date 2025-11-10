import { useEffect, useRef, useState } from 'react'
import randomId from '../../utils/random/randomId'
import config from '@/config'
import Marquee from '../marquee/marquee'

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
    done?: boolean
}

export default function PwnedSearch({ breached, breachCount, password }: PwnedSearchProps) {
    const [id, setId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const ref = useRef<HTMLDivElement | null>(null)
    const [breachFiles, setBreachFiles] = useState<BreachFile[]>([])
    const uniqueBreachFiles = Array.from(
        new Map(breachFiles.map(b => [b.file, b])).values()
    )

    useEffect(() => {
        setId(randomId())
    }, [])

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_ws}/pwned/${randomId()}`)

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

                    if ('file' in msg && 'line' in msg) {
                        setBreachFiles(prev => [...prev, { file: msg.file!, line: msg.line! }])
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
        ? 'Loading...'
        : uniqueBreachFiles.length === 1
            ? `The password exists in file '${uniqueBreachFiles[0].file}:${uniqueBreachFiles[0].line}'.`
            : `The password has been pwned ${breachCount} ${breachCount === 1 ? 'time' : 'times'}, ${suffix}`

    return (
        <div className='grid gap-2 place-items-center rounded-xl min-w-40'>
            {breached ? (
                <div className='relative grid gap-4 place-items-center max-w-fit min-w-1/3'>
                    <div className='flex gap-2 max-w-xs text-center'>
                        <h1 className={breached ? 'text-red-500 text-xs md:text-base' : ''}>{text}</h1>
                    </div>
                    {uniqueBreachFiles.length > 0 && (
                        <div className=' rounded-lg p-2 max-h-40 md:max-h-60 overflow-auto z-10 grid gap-1 w-full max-w-full'>
                            <div className='flex gap-2 bg-dark/50 rounded-sm px-2 py-1'>
                                <h1 className='text-bright/90 text-xs md:text-base break-all flex-1 font-bold'>File</h1>
                                <h1 className='text-bright/90 text-xs md:text-base break-all text-right font-bold'>Line</h1>
                            </div>
                            <div className='grid gap-1 w-full max-w-full overflow-hidden'>
                                {uniqueBreachFiles.map((breach) => (<div key={breach.file} className='flex gap-2 rounded-sm bg-dark/50 px-2 py-1 min-w-0 w-full max-w-full'>
                                    <Marquee className='truncate flex-1 ' innerClassName='text-bright/80 text-xs md:text-base break-all' text={breach.file} />
                                    <h1 className='text-bright/80 text-xs md:text-base break-all w-fit min-w-fit'>{breach.line}</h1>
                                </div>))}
                            </div>
                        </div>
                    )}
                    <div ref={ref} className='min-w-full grid place-items-center'>
                        {loading && (
                            <div key={ref.current?.offsetWidth} className='h-0.5 bg-red-500 loading-line w-1/3' />
                        )}
                    </div>
                </div>
            ) : (
                <h1 className='text-green-500 text-center w-full'>No hits found!</h1>
            )}
        </div>
    )
}
