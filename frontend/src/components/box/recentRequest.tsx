import prettyDate from '@/utils/date/prettyDate'
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
            className={`group grid w-[13.5rem] shrink-0 gap-1 rounded-lg border px-2.5 py-2 text-left transition ${active ? 'border-orange-300/35 bg-orange-300/8' : 'border-white/8 bg-white/3 hover:bg-white/6'}`}
        >
            <div className='flex items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className={`${color} rounded px-1.5 py-0.5 text-[10px] font-semibold text-white`}>{req.method}</span>
                    <span className='truncate text-xs text-bright/82'>{req.url}</span>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold ${statusColor}`}>
                    {req.status ? req.status : req.error ? 'Error' : 'Draft'}
                </span>
            </div>
            <div className='flex items-center justify-between gap-3 text-[11px] text-bright/45'>
                <span>{prettyDate(req.createdAt)}</span>
                <span>{req.elapsedMs !== undefined ? `${req.elapsedMs} ms` : req.requestSource === 'vm' ? 'Terminal' : 'Browser'}</span>
            </div>
            <div className='mt-1 flex items-center gap-1 opacity-80 transition group-hover:opacity-100'>
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
                    className='inline-flex h-6 items-center gap-1 rounded-full bg-white/7 px-2 text-[10px] text-bright/70 hover:bg-white/12 hover:text-bright'
                >
                    <Play className='h-3 w-3' />
                    Resend
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
