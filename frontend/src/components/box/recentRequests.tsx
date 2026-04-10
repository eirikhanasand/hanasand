import RecentRequest from './recentRequest'
import { RequestHistoryEntry } from './types'

type RecentRequestsProps = {
    recentRequests: RequestHistoryEntry[]
    activeRequestId?: string | null
    onSelect: (request: RequestHistoryEntry) => void
}

export default function RecentRequests({
    recentRequests,
    activeRequestId,
    onSelect
}: RecentRequestsProps) {
    if (!recentRequests.length) {
        return (
            <div className='grid h-full place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-bright/45'>
                No requests yet.
            </div>
        )
    }

    return (
        <div className='grid h-full max-h-full gap-2 overflow-auto pr-1'>
            {recentRequests.map((req) => (
                <RecentRequest
                    key={req.id}
                    req={req}
                    active={activeRequestId === req.id}
                    onClick={() => onSelect(req)}
                />
            ))}
        </div>
    )
}
