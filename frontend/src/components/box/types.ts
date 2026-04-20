export type HeaderRow = { key: string, value: string }

export type ToolResponse = {
    status?: number
    statusText?: string
    ok?: boolean
    elapsed_ms?: number
    headers?: Record<string, string>
    body?: string
    error?: string
}

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
}
