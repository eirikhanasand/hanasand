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
            <div className='min-w-0 flex-1 truncate px-1 text-xs text-bright/38'>
                No saved requests
            </div>
        )
    }

    return (
        <div className='flex min-w-0 flex-1 gap-1.5 overflow-x-auto'>
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
