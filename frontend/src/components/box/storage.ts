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
