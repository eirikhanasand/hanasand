import { PanelTopClose, PanelTopOpen, X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
import RecentRequests from './recentRequests'
import NewRequest from './newRequest'
import { closeDetachedBox, detachBoxForShare } from './detachedStorage'
import { loadScopedRequestHistory, saveScopedRequestHistory } from './storage'
import { RequestDraft, RequestHistoryEntry } from './types'

type BoxProps = {
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
    share: Share | null
    detached?: boolean
}

const EMPTY_DRAFT: RequestDraft = {
    method: 'GET',
    url: 'https://api.hanasand.com/api/',
    headers: [{ key: '', value: '' }],
    body: ''
}

export default function Box({ box, setBox, share, detached = false }: BoxProps) {
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

    const wrapperClass = detached
        ? 'fixed bottom-4 right-4 z-100 w-[min(68rem,calc(100vw-2rem))]'
        : 'relative h-full min-h-0 w-full'

    const panelClass = detached
        ? 'grid max-h-[min(48rem,calc(100vh-7rem))] min-h-[30rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-xl border border-bright/10 bg-background/96 p-2 shadow-2xl shadow-black/45 backdrop-blur-md'
        : 'grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden rounded-lg border border-bright/8 bg-black/10 p-2'

    return (
        <div className={wrapperClass}>
            <section className={panelClass}>
                <div className='flex min-w-0 items-center justify-between gap-2 rounded-lg border border-bright/8 bg-black/12 px-2 py-1.5'>
                    <RecentRequests
                        recentRequests={recentRequests}
                        activeRequestId={selectedRequestId ?? selectedRequest?.id ?? null}
                        onSelect={(request) => setSelectedRequestId(request.id)}
                        onRun={handleHistoryRun}
                        onDelete={handleHistoryDelete}
                    />
                    <div className='flex shrink-0 items-center gap-1'>
                        <button
                            type='button'
                            onClick={() => {
                                if (detached) {
                                    closeDetachedBox()
                                    setBox(false)
                                } else {
                                    detachBoxForShare(share)
                                    setBox(false)
                                }
                            }}
                            className='grid h-8 w-8 place-items-center rounded-full text-bright/55 hover:bg-white/8 hover:text-bright'
                            aria-label={detached ? 'Attach request workbench' : 'Detach request workbench'}
                        >
                            {detached ? <PanelTopClose className='h-4 w-4' /> : <PanelTopOpen className='h-4 w-4' />}
                        </button>
                        <button type='button' onClick={() => {
                            if (detached) {
                                closeDetachedBox()
                            }
                            setBox(false)
                        }} className='grid h-8 w-8 place-items-center rounded-full text-bright/55 hover:bg-white/8 hover:text-bright' aria-label='Close requests'>
                            <X className='h-4 w-4' />
                        </button>
                    </div>
                </div>
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
