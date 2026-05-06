import { Play, Trash2 } from 'lucide-react'
import requestColor from './requestColor'
import { RequestHistoryEntry } from './types'

type RecentRequestProps = {
    req: RequestHistoryEntry
    active: boolean
    onClick: () => void
    onRun: () => void
    onDelete: () => void
}

export default function RecentRequest({ req, active, onClick, onRun, onDelete }: RecentRequestProps) {
    const color = requestColor(req.method)
    const statusColor = req.error
        ? 'text-red-300'
        : req.status && req.status < 400
            ? 'text-emerald-300'
            : 'text-amber-200'

    return (
        <div
            role='button'
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
            className={`group flex h-8 w-[min(18rem,72vw)] shrink-0 items-center gap-2 rounded-full border px-2 text-left transition ${active ? 'border-orange-300/35 bg-orange-300/8' : 'border-white/8 bg-white/3 hover:bg-white/6'}`}
            title={`${req.method} ${req.url}`}
        >
            <span className={`${color} shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white`}>{req.method}</span>
            <span className='min-w-0 flex-1 truncate text-xs text-bright/78'>{shortUrlLabel(req.url)}</span>
            <span className={`shrink-0 text-[10px] font-semibold ${statusColor}`}>
                {req.status ? req.status : req.error ? 'ERR' : ''}
            </span>
            <div className='flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100'>
                <span
                    role='button'
                    tabIndex={0}
                    onClick={(event) => {
                        event.stopPropagation()
                        onRun()
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            onRun()
                        }
                    }}
                    className='grid h-6 w-6 place-items-center rounded-full text-bright/50 hover:bg-white/10 hover:text-bright'
                    aria-label={`Resend ${req.method} ${req.url}`}
                >
                    <Play className='h-3 w-3' />
                </span>
                <span
                    role='button'
                    tabIndex={0}
                    onClick={(event) => {
                        event.stopPropagation()
                        onDelete()
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            event.stopPropagation()
                            onDelete()
                        }
                    }}
                    className='grid h-6 w-6 place-items-center rounded-full text-bright/42 hover:bg-red-500/10 hover:text-red-200'
                    aria-label={`Delete ${req.method} ${req.url}`}
                >
                    <Trash2 className='h-3 w-3' />
                </span>
            </div>
        </div>
    )
}

function shortUrlLabel(value: string) {
    try {
        const url = new URL(value)
        return `${url.host}${url.pathname}${url.search}`
    } catch {
        return value
    }
}
