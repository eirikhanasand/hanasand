import prettyDate from '@/utils/date/prettyDate'
import requestColor from './requestColor'
import { RequestHistoryEntry } from './types'

type RecentRequestProps = {
    req: RequestHistoryEntry
    active: boolean
    onClick: () => void
}

export default function RecentRequest({ req, active, onClick }: RecentRequestProps) {
    const color = requestColor(req.method)
    const statusColor = req.error
        ? 'text-red-300'
        : req.status && req.status < 400
            ? 'text-emerald-300'
            : 'text-amber-200'

    return (
        <button
            type='button'
            onClick={onClick}
            className={`grid w-full gap-2 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-orange-300/45 bg-orange-300/10' : 'border-white/8 bg-white/4 hover:bg-white/7'}`}
        >
            <div className='flex items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className={`${color} rounded-md px-2 py-1 text-[11px] font-semibold`}>{req.method}</span>
                    <span className='truncate text-sm text-bright/88'>{req.url}</span>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${statusColor}`}>
                    {req.status ? req.status : req.error ? 'Error' : 'Draft'}
                </span>
            </div>
            <div className='flex items-center justify-between gap-3 text-xs text-bright/45'>
                <span>{prettyDate(req.createdAt)}</span>
                {req.elapsedMs !== undefined && <span>{req.elapsedMs} ms</span>}
            </div>
        </button>
    )
}
