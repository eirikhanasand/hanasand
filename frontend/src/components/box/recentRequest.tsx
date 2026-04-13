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
            className={`grid w-full gap-1.5 rounded-lg border px-2.5 py-2 text-left transition ${active ? 'border-orange-300/45 bg-orange-300/10' : 'border-white/8 bg-white/4 hover:bg-white/7'}`}
        >
            <div className='flex items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className={`${color} rounded-md px-1.5 py-0.5 text-[10px] font-semibold`}>{req.method}</span>
                    <span className='truncate text-[13px] text-bright/88'>{req.url}</span>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold ${statusColor}`}>
                    {req.status ? req.status : req.error ? 'Error' : 'Draft'}
                </span>
            </div>
            <div className='flex items-center justify-between gap-3 text-[11px] text-bright/45'>
                <span>{prettyDate(req.createdAt)}</span>
                {req.elapsedMs !== undefined && <span>{req.elapsedMs} ms</span>}
            </div>
        </button>
    )
}
