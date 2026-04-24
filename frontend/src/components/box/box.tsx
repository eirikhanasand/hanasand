import { Menu, X } from 'lucide-react'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import RecentRequests from './recentRequests'
import NewRequest from './newRequest'
import { loadScopedRequestHistory, saveScopedRequestHistory } from './storage'
import { RequestDraft, RequestHistoryEntry } from './types'

type BoxProps = {
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
    share: Share | null
}

const EMPTY_DRAFT: RequestDraft = {
    method: 'GET',
    url: 'https://api.hanasand.com/api/',
    headers: [{ key: '', value: '' }],
    body: ''
}

export default function Box({ box, setBox, share }: BoxProps) {
    const [sidebar, setSidebar] = useState(true)
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
    const recentRequests = useMemo(
        () => (box ? loadScopedRequestHistory(share?.alias || share?.id || null) : []),
        [box, share?.alias, share?.id]
    )
    const selectedRequest = useMemo(
        () => recentRequests.find((request) => request.id === selectedRequestId) || recentRequests[0] || null,
        [recentRequests, selectedRequestId]
    )

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
        const next = [entry, ...recentRequests.filter((item) => item.id !== entry.id && !(item.method === entry.method && item.url === entry.url && item.body === entry.body))]
        saveScopedRequestHistory(next, share?.alias || share?.id || null)
        setSelectedRequestId(entry.id)
    }

    if (!box) {
        return null
    }

    return (
        <div className='absolute right-3 top-18 z-40 grid w-[min(72rem,calc(100vw-2rem))] grid-cols-1 items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]'>
            {sidebar && (
                <aside className='grid min-h-0 gap-2 self-start rounded-xl border border-white/10 bg-bright/3 p-2.5 backdrop-blur-md lg:h-[min(36rem,72vh)]'>
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
                        activeRequestId={selectedRequestId ?? selectedRequest?.id ?? null}
                        onSelect={(request) => setSelectedRequestId(request.id)}
                    />
                </aside>
            )}
            <section className={`
                grid min-h-0 gap-2 self-start rounded-xl border border-white/10
                bg-bright/3 p-2.5 backdrop-blur-md lg:h-[min(36rem,72vh)]
            `}>
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
                    key={selectedRequest?.id ?? 'new-request'}
                    initialRequest={requestDraft}
                    selectedRequestId={selectedRequest?.id ?? null}
                    onRequestComplete={handleHistoryUpdate}
                    share={share}
                />
            </section>
        </div>
    )
}
