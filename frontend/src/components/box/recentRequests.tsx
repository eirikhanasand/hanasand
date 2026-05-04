import RecentRequest from './recentRequest'
import { RequestHistoryEntry } from './types'

type RecentRequestsProps = {
    recentRequests: RequestHistoryEntry[]
    activeRequestId?: string | null
    onSelect: (request: RequestHistoryEntry) => void
    onRun: (request: RequestHistoryEntry) => void
    onDelete: (id: string) => void
}

export default function RecentRequests({
    recentRequests,
    activeRequestId,
    onSelect,
    onRun,
    onDelete,
}: RecentRequestsProps) {
    if (!recentRequests.length) {
        return (
            <div className='rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-bright/45'>
                Previous requests will appear here.
            </div>
        )
    }

    return (
        <div className='flex max-w-full gap-2 overflow-x-auto pb-1'>
            {recentRequests.map((req) => (
                <RecentRequest
                    key={req.id}
                    req={req}
                    active={activeRequestId === req.id}
                    onClick={() => onSelect(req)}
                    onRun={() => onRun(req)}
                    onDelete={() => onDelete(req.id)}
                />
            ))}
        </div>
    )
}
