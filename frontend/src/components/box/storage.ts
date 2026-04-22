import { RequestHistoryEntry } from './types'

export const REQUEST_HISTORY_STORAGE_KEY = 'hanasand.share.request-history.v1'

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

        return parsed
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
        return Array.isArray(parsed) ? parsed : []
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
