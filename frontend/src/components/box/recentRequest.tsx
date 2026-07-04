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
        ? 'text-ui-danger'
        : req.status && req.status < 400
            ? 'text-ui-success'
            : 'text-ui-warning'

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
            className={`group flex h-8 w-[min(18rem,72vw)] shrink-0 items-center gap-2 rounded-full border px-2 text-left transition ${active ? 'border-ui-primary/35 bg-ui-primary/10' : 'border-ui-border bg-ui-panel hover:bg-ui-raised'}`}
            title={`${req.method} ${req.url}`}
        >
            <span className={`${color} shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-ui-canvas`}>{req.method}</span>
            <span className='min-w-0 flex-1 truncate text-xs text-ui-text'>{shortUrlLabel(req.url)}</span>
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
                    className='grid h-6 w-6 place-items-center rounded-full text-ui-muted hover:bg-ui-raised hover:text-ui-text'
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
                    className='grid h-6 w-6 place-items-center rounded-full text-ui-muted hover:bg-ui-danger/10 hover:text-ui-danger'
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
