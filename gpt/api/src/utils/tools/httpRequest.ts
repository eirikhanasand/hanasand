const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

type HttpRequestArgs = {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeoutMs?: number
    expectStatus?: number
    expectText?: string
    expectJsonKey?: string
}

type HttpRequestAssertionResult = {
    name: 'status' | 'text' | 'json_key'
    passed: boolean
    detail: string
}

type HttpRequestResult = {
    url: string
    method: string
    ok: boolean
    status: number
    statusText: string
    elapsedMs: number
    headers: Record<string, string>
    body: string
    excerpt: string
    contentType: string | null
    jsonSummary: string | null
    assertions: HttpRequestAssertionResult[]
}

function safeExcerpt(body: string, limit = 4000) {
    return body.length > limit ? `${body.slice(0, limit)}\n...<truncated>` : body
}

function summarizeJson(value: unknown, depth = 0): string {
    if (value === null) return 'null'
    if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 157)}...` : value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
        if (depth >= 2) return `[array(${value.length})]`
        return `[${value.slice(0, 5).map((entry) => summarizeJson(entry, depth + 1)).join(', ')}${value.length > 5 ? ', ...' : ''}]`
    }
    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>
        const entries = Object.entries(objectValue).slice(0, 8)
        const rendered = entries.map(([key, entry]) => `${key}: ${depth >= 2 ? '[object]' : summarizeJson(entry, depth + 1)}`)
        return `{ ${rendered.join(', ')}${Object.keys(objectValue).length > entries.length ? ', ...' : ''} }`
    }
    return String(value)
}

function hasJsonPath(value: unknown, keyPath: string) {
    const segments = keyPath.split('.').map((segment) => segment.trim()).filter(Boolean)
    if (!segments.length) {
        return false
    }

    let current: unknown = value
    for (const segment of segments) {
        if (Array.isArray(current)) {
            const index = Number(segment)
            if (!Number.isInteger(index) || index < 0 || index >= current.length) {
                return false
            }
            current = current[index]
            continue
        }

        if (!current || typeof current !== 'object' || !(segment in current)) {
            return false
        }

        current = (current as Record<string, unknown>)[segment]
    }

    return true
}

export default async function httpRequest(args: HttpRequestArgs): Promise<HttpRequestResult> {
    if (!args.url?.trim()) {
        throw new Error('http_request requires a url.')
    }

    const method = (args.method || 'GET').toUpperCase()
    if (!ALLOWED_METHODS.has(method)) {
        throw new Error(`Unsupported HTTP method: ${method}`)
    }

    const target = new URL(args.url)
    if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error('Only http and https requests are supported.')
    }

    const controller = new AbortController()
    const timeoutMs = Math.max(1000, Math.min(args.timeoutMs ?? 15000, 120000))
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = performance.now()

    try {
        const response = await fetch(target, {
            method,
            headers: args.headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : args.body,
            signal: controller.signal,
        })

        const body = await response.text()
        const contentType = response.headers.get('content-type')
        let parsedJson: unknown = null
        let jsonSummary: string | null = null

        if (contentType?.includes('application/json')) {
            try {
                parsedJson = JSON.parse(body)
                jsonSummary = summarizeJson(parsedJson)
            } catch {
                jsonSummary = '<invalid json body>'
            }
        }

        const assertions: HttpRequestAssertionResult[] = []
        if (typeof args.expectStatus === 'number') {
            assertions.push({
                name: 'status',
                passed: response.status === args.expectStatus,
                detail: `Expected status ${args.expectStatus}, received ${response.status}.`,
            })
        }

        if (args.expectText) {
            const passed = body.includes(args.expectText)
            assertions.push({
                name: 'text',
                passed,
                detail: passed
                    ? `Response contains expected text "${args.expectText}".`
                    : `Response does not contain expected text "${args.expectText}".`,
            })
        }

        if (args.expectJsonKey) {
            const passed = parsedJson ? hasJsonPath(parsedJson, args.expectJsonKey) : false
            assertions.push({
                name: 'json_key',
                passed,
                detail: parsedJson
                    ? `JSON path ${args.expectJsonKey} ${passed ? 'was present' : 'was missing'}.`
                    : `Response was not valid JSON, so path ${args.expectJsonKey} could not be checked.`,
            })
        }

        return {
            url: target.toString(),
            method,
            ok: response.ok && assertions.every((assertion) => assertion.passed),
            status: response.status,
            statusText: response.statusText,
            elapsedMs: Math.round(performance.now() - startedAt),
            headers: Object.fromEntries(response.headers.entries()),
            body,
            excerpt: safeExcerpt(body),
            contentType,
            jsonSummary,
            assertions,
        }
    } finally {
        clearTimeout(timeout)
    }
}
