import type { AppSettings, GptClient, MailOverview, ShareSummary } from '../types'

function headers(settings: AppSettings) {
    return {
        'Content-Type': 'application/json',
        Authorization: settings.authToken ? `Bearer ${settings.authToken}` : '',
        id: settings.userId || '',
    }
}

export async function fetchMailOverview(settings: AppSettings, mailboxId?: string | null, messageId?: string | null) {
    if (!settings.apiBaseUrl || !settings.authToken || !settings.userId) {
        throw new Error('Configure the API URL, auth token, and user id first.')
    }

    const search = new URLSearchParams()
    if (mailboxId) search.set('mailboxId', mailboxId)
    if (messageId) search.set('messageId', messageId)

    const response = await fetch(`${settings.apiBaseUrl}/mail/overview?${search.toString()}`, {
        headers: headers(settings),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to load mail overview.')
    }

    return response.json() as Promise<MailOverview>
}

export async function postMailAction(settings: AppSettings, messageId: string, action: string, targetMailboxId?: string) {
    const response = await fetch(`${settings.apiBaseUrl}/mail/message/${messageId}/action`, {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ action, targetMailboxId }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to update message.')
    }
}

export async function createMailbox(settings: AppSettings, name: string) {
    const response = await fetch(`${settings.apiBaseUrl}/mail/mailboxes`, {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ name }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Unable to create mailbox.')
    }
}

export async function triggerServerAction(url: string, settings?: AppSettings) {
    const response = await fetch(url, {
        method: 'POST',
        headers: settings ? headers(settings) : undefined,
    })

    if (!response.ok) {
        throw new Error(`Action failed with status ${response.status}`)
    }

    return response.text().catch(() => 'Done')
}

export async function askCodex(settings: AppSettings, prompt: string, context?: string) {
    if (!settings.apiBaseUrl || !settings.authToken || !settings.userId) {
        throw new Error('Configure API URL, auth token, and user id to use Codex in-app.')
    }

    const response = await fetch(`${settings.apiBaseUrl}${settings.codexApiPath}`, {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({ prompt, context }),
    })

    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to reach the Codex tool endpoint.'))
    }

    return String(body.message || body.suggestion || body.error || 'No response.')
}

export async function fetchAiModels(settings: AppSettings) {
    const response = await fetch(`${settings.apiBaseUrl}/ai/models`, {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to load model status.'))
    }

    const connected = Array.isArray(body.connected) ? body.connected as GptClient[] : []
    return connected
}

export async function fetchUserShares(settings: AppSettings) {
    if (!settings.authToken || !settings.userId) {
        throw new Error('Configure auth token and user id to load shares.')
    }

    const response = await fetch(`${settings.cdnBaseUrl}/share/user/${settings.userId}`, {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ([]))
    if (!response.ok) {
        throw new Error('Unable to load shares.')
    }

    return Array.isArray(body) ? body as ShareSummary[] : []
}

export async function createShare(settings: AppSettings, payload: { id: string; content: string; name?: string; path?: string; type?: string }) {
    if (!settings.authToken || !settings.userId) {
        throw new Error('Configure auth token and user id to create shares.')
    }

    const response = await fetch(`${settings.cdnBaseUrl}/share`, {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    if (!response.ok) {
        throw new Error(String(body.error || 'Unable to create share.'))
    }

    return body as ShareSummary
}

export async function fetchTopDomains(settings: AppSettings) {
    const response = await fetch(`${settings.cdnBaseUrl}/traffic/tps?fresh=1`, {
        headers: headers(settings),
    })
    const body = await response.json().catch(() => ([]))
    if (!response.ok) {
        throw new Error('Unable to load domain activity.')
    }

    return Array.isArray(body) ? body.slice(0, 5) as Array<{ name: string; tps?: number }> : []
}
