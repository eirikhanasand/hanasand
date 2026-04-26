import config from '@/config'

import type { ToolResponse } from '@/components/box/types'

export async function sendViaShareVm({
    shareAlias,
    method,
    url,
    headers,
    body,
}: {
    shareAlias: string
    method: string
    url: string
    headers: Record<string, string>
    body: string
}): Promise<ToolResponse> {
    const result = await fetch(`${config.url.cdn}/share/request/${shareAlias}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ method, url, headers, body }),
    })

    return result.json().catch(() => ({ error: 'Invalid response.' }))
}

export async function sendFromBrowser({
    method,
    url,
    headers,
    body,
}: {
    method: string
    url: string
    headers: Record<string, string>
    body: string
}): Promise<ToolResponse> {
    const normalizedMethod = method.toUpperCase()
    const started = performance.now()

    try {
        const response = await fetch(url, {
            method: normalizedMethod,
            headers,
            body: ['GET', 'HEAD'].includes(normalizedMethod) ? undefined : body,
        })

        const text = await response.text()
        return {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            elapsed_ms: Math.round(performance.now() - started),
            headers: Object.fromEntries(response.headers.entries()),
            body: text,
        }
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
        }
    }
}

export function withRequestDetails(response: ToolResponse, request: NonNullable<ToolResponse['request']>): ToolResponse {
    return {
        ...response,
        request: response.request ?? request,
    }
}

export function formatHeaders(headers?: Record<string, string>) {
    if (!headers || Object.keys(headers).length === 0) {
        return 'No headers.'
    }

    return Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
}

export function formatRequestLine(request?: ToolResponse['request']) {
    if (!request) {
        return 'Request details will appear here.'
    }

    return `${request.method} ${request.url}`
}
