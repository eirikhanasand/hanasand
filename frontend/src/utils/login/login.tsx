import fetchWithRetry from '@/utils/fetchWithRetry'

export class PendingDeletionError extends Error {
    id: string
    deletionScheduledAt: string
    restoreToken: string

    constructor(data: { id?: string, deletion_scheduled_at?: string, restore_token?: string, error?: string }) {
        super(data.error || 'Account pending deletion.')
        this.name = 'PendingDeletionError'
        this.id = data.id || ''
        this.deletionScheduledAt = data.deletion_scheduled_at || ''
        this.restoreToken = data.restore_token || ''
    }
}

export default async function login(id: string, password: string) {
    const response = await fetchWithRetry('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, password }),
        timeoutMs: 10000,
        retries: 2,
    })

    const responseText = await response.text()
    const data = parseResponse(responseText)

    if (response.status === 423 && data?.pending_deletion) {
        throw new PendingDeletionError(data)
    }

    if (!response.ok) {
        throw new Error(normalizeLoginError(responseText))
    }

    return data
}

function parseResponse(responseText: string) {
    try {
        return JSON.parse(responseText)
    } catch {
        return null
    }
}

function normalizeLoginError(errorText: string) {
    try {
        const parsed = JSON.parse(errorText)
        return parsed?.error || errorText
    } catch {
        return errorText
    }
}
