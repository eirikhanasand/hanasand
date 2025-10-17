import { useEffect, useState } from 'react'
import randomId from '../../utils/random/randomId'
import config from '@/config'

type PwnedSearchProps = {
    breached: boolean
    breachCount: number | null
    password: string
}

type BreachMessage = {
    type: "update"
    timestamp: string
    ok?: boolean
    file?: string
    line?: number
    done?: boolean
}

export default function PwnedSearch({ breached, breachCount, password }: PwnedSearchProps) {
    const [id, setId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [breachFiles, setBreachFiles] = useState<BreachFile[]>([])
    const uniqueBreachFiles = Array.from(
        new Map(breachFiles.map(b => [b.file, b])).values()
    )

    useEffect(() => {
        setId(randomId())
    }, [])

    useEffect(() => {
        if (!id) return

        const ws = new WebSocket(`${config.url.api_ws}/pwned/ws/${randomId()}`)

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

                console.log("RECEIVED MESSAGE", JSON.parse(data))

                const msg = JSON.parse(data) as BreachMessage
                if (msg) {
                    if (msg.done) setLoading(false)
                    if ('file' in msg && 'line' in msg) setBreachFiles(prev => [...prev, { file: msg.file!, line: msg.line! }])
                }
            } catch (err) {
                console.error('Invalid message from server:', err)
            }
        }

        return () => {
            ws.close()
        }
    }, [id, password])

    const suffix = uniqueBreachFiles.length > 0 ? `and exists in the following ${uniqueBreachFiles.length} files.` : `but the ${breachCount === 1 ? 'dataset is' : 'datasets are'} currently not publicly available.`
    const text = uniqueBreachFiles.length === 0 && loading 
        ? 'Loading...' 
        : uniqueBreachFiles.length === 1
            ? `The password exists in file '${uniqueBreachFiles[0].file}:${uniqueBreachFiles[0].line}'.`
            : `The password has been pwned ${breachCount} ${breachCount === 1 ? 'time' : 'times'}, ${suffix}`


    return (
        <div className='flex gap-2 items-center rounded-xl min-w-[10rem]'>
            {breached ? (
                <div className='relative grid gap-4 place-items-center max-w-fit min-w-1/3'>
                    <div className='flex gap-2 max-w-xs text-center'>
                        <h1 className={breached ? 'text-red-500' : ''}>{text}</h1>
                    </div>
                    {uniqueBreachFiles.length > 0 && <div className='bg-extralight rounded-lg p-2 max-h-[8rem] overflow-auto z-10'>
                        {uniqueBreachFiles.map((breach) => (<h1 key={breach.file} className='text-gray-200'>{breach.file}:{breach.line}</h1>))}
                    </div>}
                    {loading && <div className="min-w-[10rem] w-full h-[2px] shadow-red-500/50 loading-line" />}
                </div>
            ) : (
                <h1 className='text-green-500 text-center w-full'>No hits found!</h1>
            )}
        </div>
    )
}
