import { X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
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
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
    const [recentRequests, setRecentRequests] = useState<RequestHistoryEntry[]>([])
    const [runToken, setRunToken] = useState(0)
    const historyScope = share?.alias || share?.id || null
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

    useEffect(() => {
        if (!box) {
            return
        }
        const loaded = loadScopedRequestHistory(historyScope)
        setRecentRequests(loaded)
        setSelectedRequestId((current) => current && loaded.some((request) => request.id === current) ? current : loaded[0]?.id ?? null)
    }, [box, historyScope])

    function handleHistoryUpdate(entry: RequestHistoryEntry) {
        const next = [entry, ...recentRequests.filter((item) => item.id !== entry.id && !(item.method === entry.method && item.url === entry.url && item.body === entry.body))]
        saveScopedRequestHistory(next, historyScope)
        setRecentRequests(next)
        setSelectedRequestId(entry.id)
    }

    function handleHistoryDelete(id: string) {
        const next = recentRequests.filter((request) => request.id !== id)
        saveScopedRequestHistory(next, historyScope)
        setRecentRequests(next)
        setSelectedRequestId((current) => current === id ? next[0]?.id ?? null : current)
    }

    function handleHistoryRun(request: RequestHistoryEntry) {
        setSelectedRequestId(request.id)
        setRunToken((current) => current + 1)
    }

    if (!box) {
        return null
    }

    return (
        <div className='absolute right-3 top-18 z-40 w-[min(58rem,calc(100vw-2rem))]'>
            <section className='grid max-h-[min(40rem,74vh)] min-h-0 gap-3 overflow-hidden rounded-xl border border-white/10 bg-background/95 p-3 shadow-2xl shadow-black/35 backdrop-blur-md'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <h1 className='text-sm font-semibold text-bright'>Requests</h1>
                        <p className='text-xs text-bright/45'>Runs through the connected terminal when a share VM is available.</p>
                    </div>
                    <button type='button' onClick={() => setBox(false)} className='grid h-8 w-8 place-items-center rounded-full text-bright/55 hover:bg-white/8 hover:text-bright' aria-label='Close requests'>
                        <X className='h-4 w-4' />
                    </button>
                </div>
                <RecentRequests
                    recentRequests={recentRequests}
                    activeRequestId={selectedRequestId ?? selectedRequest?.id ?? null}
                    onSelect={(request) => setSelectedRequestId(request.id)}
                    onRun={handleHistoryRun}
                    onDelete={handleHistoryDelete}
                />
                <NewRequest
                    initialRequest={requestDraft}
                    selectedRequestId={selectedRequest?.id ?? null}
                    runToken={runToken}
                    onRequestComplete={handleHistoryUpdate}
                    share={share}
                />
            </section>
        </div>
    )
}
