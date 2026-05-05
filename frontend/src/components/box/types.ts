export type HeaderRow = { key: string, value: string }

export type ToolResponse = {
    status?: number
    statusText?: string
    ok?: boolean
    elapsed_ms?: number
    headers?: Record<string, string>
    body?: string
    raw?: string
    error?: string
    request?: {
        method: string
        url: string
        headers: Record<string, string>
        body: string
    }
}

export type DetachedBoxShare = Pick<Share, 'id' | 'alias' | 'path'> & Partial<Share>

export type RequestDraft = {
    method: string
    url: string
    headers: HeaderRow[]
    body: string
}

export type RequestHistoryEntry = {
    id: string
    method: string
    url: string
    headers: HeaderRow[]
    body: string
    createdAt: string
    status?: number
    statusText?: string
    elapsedMs?: number
    error?: string
    requestSource?: 'browser' | 'vm'
}

export type DetachedBoxState = {
    open: boolean
    share: DetachedBoxShare | null
}
