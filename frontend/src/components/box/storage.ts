import { HeaderRow, RequestHistoryEntry, VariableRow } from './types'

export const REQUEST_HISTORY_STORAGE_KEY = 'hanasand.share.request-history.v1'
export const REQUEST_VARIABLE_STORAGE_KEY = 'hanasand.share.request-variables.v1'

export function loadRequestHistory(): RequestHistoryEntry[] {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const raw = window.localStorage.getItem(REQUEST_HISTORY_STORAGE_KEY)
        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
            return []
        }

        return parsed.map(normalizeRequestHistoryEntry).filter(Boolean) as RequestHistoryEntry[]
    } catch {
        return []
    }
}

export function saveRequestHistory(history: RequestHistoryEntry[]) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(REQUEST_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 30)))
}

export function shareRequestHistoryKey(shareId?: string | null) {
    return shareId ? `${REQUEST_HISTORY_STORAGE_KEY}.${shareId}` : REQUEST_HISTORY_STORAGE_KEY
}

export function loadScopedRequestHistory(shareId?: string | null) {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const raw = window.localStorage.getItem(shareRequestHistoryKey(shareId))
        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.map(normalizeRequestHistoryEntry).filter(Boolean) as RequestHistoryEntry[]
            : []
    } catch {
        return []
    }
}

export function saveScopedRequestHistory(history: RequestHistoryEntry[], shareId?: string | null) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(shareRequestHistoryKey(shareId), JSON.stringify(history.slice(0, 30)))
}

export function shareRequestVariablesKey(shareId?: string | null) {
    return shareId ? `${REQUEST_VARIABLE_STORAGE_KEY}.${shareId}` : REQUEST_VARIABLE_STORAGE_KEY
}

export function loadScopedRequestVariables(shareId?: string | null) {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const raw = window.localStorage.getItem(shareRequestVariablesKey(shareId))
        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.map(normalizeVariableRow).filter(Boolean) as VariableRow[]
            : []
    } catch {
        return []
    }
}

export function saveScopedRequestVariables(variables: VariableRow[], shareId?: string | null) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(
        shareRequestVariablesKey(shareId),
        JSON.stringify(variables.map(normalizeVariableRow).filter(Boolean).slice(0, 24))
    )
}

function normalizeRequestHistoryEntry(value: unknown): RequestHistoryEntry | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const item = value as Partial<RequestHistoryEntry>
    if (!item.method || !item.url) {
        return null
    }

    return {
        id: typeof item.id === 'string' ? item.id : `${item.method}-${item.url}`,
        method: String(item.method).toUpperCase(),
        url: String(item.url),
        headers: normalizeHeaderRows(item.headers),
        body: typeof item.body === 'string' ? item.body : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        status: typeof item.status === 'number' ? item.status : undefined,
        statusText: typeof item.statusText === 'string' ? item.statusText : undefined,
        elapsedMs: typeof item.elapsedMs === 'number' ? item.elapsedMs : undefined,
        error: typeof item.error === 'string' ? redactSensitiveText(item.error) : undefined,
        requestSource: item.requestSource === 'vm' || item.requestSource === 'browser' ? item.requestSource : undefined,
    }
}

function normalizeHeaderRows(value: unknown): HeaderRow[] {
    if (!Array.isArray(value)) {
        return [{ key: '', value: '' }]
    }

    const rows = value.flatMap((row): HeaderRow[] => {
        if (!row || typeof row !== 'object') {
            return []
        }

        const item = row as Partial<HeaderRow>
        if (typeof item.key !== 'string') {
            return []
        }

        return [{
            key: item.key,
            value: typeof item.value === 'string' ? redactSensitiveText(item.value) : '',
        }]
    })

    return rows.length ? rows : [{ key: '', value: '' }]
}

function normalizeVariableRow(value: unknown): VariableRow | null {
    if (!value || typeof value !== 'object') {
        return null
    }

    const item = value as Partial<VariableRow>
    const key = typeof item.key === 'string' ? item.key.trim() : ''
    if (!key) {
        return null
    }

    return {
        key,
        value: typeof item.value === 'string' ? redactSensitiveText(item.value) : '',
    }
}

function redactSensitiveText(value: string) {
    return value.replace(/\bBearer\s+[^'\s]+/gi, 'Bearer [redacted]')
}
