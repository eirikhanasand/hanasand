export const RECENT_UPLOADS_STORAGE_KEY = 'hanasand.upload.recent.v1'

export type RecentUpload = {
    url: string
    createdAt: string
}

export function loadRecentUploads(): RecentUpload[] {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const raw = window.localStorage.getItem(RECENT_UPLOADS_STORAGE_KEY)
        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export function saveRecentUpload(url: string) {
    if (typeof window === 'undefined') {
        return
    }

    const next = [
        { url, createdAt: new Date().toISOString() },
        ...loadRecentUploads().filter((item) => item.url !== url)
    ].slice(0, 24)

    window.localStorage.setItem(RECENT_UPLOADS_STORAGE_KEY, JSON.stringify(next))
}
