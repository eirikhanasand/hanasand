import config from '@/config'

import type { ToolResponse } from '@/components/box/types'

const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

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
    const normalized = normalizeRequestHeaders(headers)
    const result = await fetch(`${config.url.cdn}/share/request/${shareAlias}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ method, url, headers: normalized.headers, body }),
    })

    return withWarnings(
        await result.json().catch(() => ({ error: 'Invalid response.' })),
        normalized.warnings
    )
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
    const normalized = normalizeRequestHeaders(headers)

    try {
        const response = await fetch(url, {
            method: normalizedMethod,
            headers: normalized.headers,
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
            warnings: normalized.warnings,
        }
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
            warnings: normalized.warnings,
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

export function normalizeRequestHeaders(headers: Record<string, string>) {
    const normalized: Record<string, string> = {}
    const warnings: string[] = []

    for (const [rawKey, rawValue] of Object.entries(headers || {})) {
        const key = rawKey.trim()
        const value = String(rawValue ?? '').trim()
        if (!key || !value) {
            continue
        }

        if (!HEADER_NAME_PATTERN.test(key)) {
            warnings.push(`Skipped invalid header name: ${key}`)
            continue
        }

        if (!isValidHeaderValue(value)) {
            warnings.push(`Skipped invalid header value for ${key}.`)
            continue
        }

        normalized[key] = value
    }

    return { headers: normalized, warnings }
}

function isValidHeaderValue(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code === 9) {
            continue
        }
        if (code < 32 || code > 255 || code === 127) {
            return false
        }
    }

    return true
}

function withWarnings(response: ToolResponse, warnings: string[]) {
    return warnings.length
        ? { ...response, warnings: [...warnings, ...(response.warnings || [])] }
        : response
}
