import { Menu, X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
import RecentRequests from './recentRequests'
import NewRequest from './newRequest'
import { loadRequestHistory, saveRequestHistory } from './storage'
import { RequestDraft, RequestHistoryEntry } from './types'

type BoxProps = {
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
}

const EMPTY_DRAFT: RequestDraft = {
    method: 'GET',
    url: 'https://api.hanasand.com/api/',
    headers: [{ key: '', value: '' }],
    body: ''
}

export default function Box({ box, setBox }: BoxProps) {
    const [sidebar, setSidebar] = useState(true)
    const [recentRequests, setRecentRequests] = useState<RequestHistoryEntry[]>([])
    const [selectedRequest, setSelectedRequest] = useState<RequestHistoryEntry | null>(null)

    useEffect(() => {
        if (!box) {
            return
        }

        const history = loadRequestHistory()
        setRecentRequests(history)
        setSelectedRequest(history[0] ?? null)
    }, [box])

    const requestDraft = useMemo<RequestDraft>(() => {
        if (!selectedRequest) {
            return EMPTY_DRAFT
        }

        return {
            method: selectedRequest.method,
            url: selectedRequest.url,
            headers: selectedRequest.headers,
            body: selectedRequest.body
        }
    }, [selectedRequest])

    function handleHistoryUpdate(entry: RequestHistoryEntry) {
        setRecentRequests((prev) => {
            const next = [entry, ...prev.filter((item) => item.id !== entry.id && !(item.method === entry.method && item.url === entry.url && item.body === entry.body))]
            saveRequestHistory(next)
            return next
        })
        setSelectedRequest(entry)
    }

    if (!box) {
        return null
    }

    return (
        <div className='absolute right-3 top-18 z-40 grid h-[min(36rem,72vh)] w-[min(60rem,calc(100vw-2rem))] grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]'>
            {sidebar && (
                <aside className='grid h-full min-h-0 gap-2 rounded-xl border border-white/10 bg-bright/3 p-2.5 backdrop-blur-md'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h1 className='text-sm font-semibold text-bright'>History</h1>
                            <p className='text-xs text-bright/45'>Recent requests on this device</p>
                        </div>
                        <button type='button' onClick={() => setSidebar(false)} className='grid h-8 w-8 place-items-center rounded-md border border-white/10 text-bright/65 hover:bg-white/8'>
                            <X className='h-4 w-4' />
                        </button>
                    </div>
                    <RecentRequests
                        recentRequests={recentRequests}
                        activeRequestId={selectedRequest?.id ?? null}
                        onSelect={setSelectedRequest}
                    />
                </aside>
            )}
                <section className='grid h-full min-h-0 gap-2 rounded-xl border border-white/10 bg-bright/3 p-2.5 backdrop-blur-md'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <h1 className='text-sm font-semibold text-bright'>HTTP Workbench</h1>
                        <p className='text-xs text-bright/45'>Request, inspect, and iterate from one place</p>
                    </div>
                    <div className='flex items-center gap-2'>
                        {!sidebar && (
                            <button type='button' onClick={() => setSidebar(true)} className='grid h-8 w-8 place-items-center rounded-md border border-white/10 text-bright/65 hover:bg-white/8'>
                                <Menu className='h-4 w-4' />
                            </button>
                        )}
                        <button type='button' onClick={() => setBox(false)} className='grid h-8 w-8 place-items-center rounded-md border border-white/10 text-bright/65 hover:bg-white/8'>
                            <X className='h-4 w-4' />
                        </button>
                    </div>
                </div>
                <NewRequest
                    initialRequest={requestDraft}
                    selectedRequestId={selectedRequest?.id ?? null}
                    onRequestComplete={handleHistoryUpdate}
                />
            </section>
        </div>
    )
}
