import createClient from 'openapi-fetch'
import type { paths } from '../generated/publicTiApi.d.ts'

export function createPublicTiClient(options: {
    baseUrl?: string
    apiKey?: string
    session?: { id: string, token: string }
    fetch?: typeof fetch
} = {}) {
    const headers: Record<string, string> = {}
    if (options.apiKey) headers['X-API-Key'] = options.apiKey
    if (options.session) {
        headers.id = options.session.id
        headers.Authorization = `Bearer ${options.session.token}`
    }
    return createClient<paths>({
        baseUrl: options.baseUrl ?? 'https://api.hanasand.com/api/v1',
        headers,
        fetch: options.fetch,
    })
}
